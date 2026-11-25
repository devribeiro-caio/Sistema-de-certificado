const crypto = require('crypto');
const axios = require('axios');
const BlingOAuthToken = require('../models/BlingOAuthToken');

const authorizeUrl = 'https://www.bling.com.br/Api/v3/oauth/authorize';
const tokenUrl = 'https://www.bling.com.br/Api/v3/oauth/token';
const refreshMarginMs = 60 * 1000;
let refreshInFlight = null;

function integrationError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function redirectUri() {
  return process.env.BLING_REDIRECT_URI || `http://localhost:${process.env.PORT || 3333}/api/bling/oauth/callback`;
}

function stateSecret() {
  return process.env.JWT_SECRET || process.env.BLING_CLIENT_SECRET || 'formis-oauth-state';
}

function makeState() {
  const payload = Buffer.from(JSON.stringify({ issuedAt: Date.now() })).toString('base64url');
  const signature = crypto.createHmac('sha256', stateSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function validState(state) {
  try {
    if (!state || typeof state !== 'string') return false;
    const parts = state.split('.');
    if (parts.length !== 2) return false;
    const [payload, signature] = parts;
    const expected = crypto.createHmac('sha256', stateSecret()).update(payload).digest('base64url');
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const age = Date.now() - Number(data.issuedAt);
    return Number.isFinite(age) && age >= 0 && age < 10 * 60 * 1000;
  } catch (_) {
    return false;
  }
}

function encryptionKey() {
  const material = process.env.BLING_TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET || process.env.BLING_CLIENT_SECRET;
  if (!material) {
    throw integrationError('Configure BLING_TOKEN_ENCRYPTION_KEY ou mantenha JWT_SECRET/BLING_CLIENT_SECRET estavel no Render para proteger os tokens do Bling.', 503);
  }
  return crypto.createHash('sha256').update(`formis-bling-token:v1:${material}`, 'utf8').digest();
}

function encryptToken(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

function decryptToken(value) {
  if (!value) return '';
  try {
    const parts = String(value).split('.');
    if (parts.length !== 3 || parts.some((part) => !part)) throw new Error('invalid format');
    const [iv, tag, ciphertext] = parts;
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
  } catch (_) {
    throw integrationError('Nao foi possivel descriptografar as credenciais do Bling. Mantenha BLING_TOKEN_ENCRYPTION_KEY/JWT_SECRET estavel e reconecte a integracao se a chave foi alterada.', 503);
  }
}

function authorizationUrl() {
  if (!process.env.BLING_CLIENT_ID || !process.env.BLING_CLIENT_SECRET) {
    throw integrationError('Configure BLING_CLIENT_ID e BLING_CLIENT_SECRET no Render.', 503);
  }
  const query = new URLSearchParams({ response_type: 'code', client_id: process.env.BLING_CLIENT_ID, state: makeState() });
  return `${authorizeUrl}?${query.toString()}`;
}

async function saveTokens(tokens) {
  const accessToken = String(tokens?.access_token || '');
  if (!accessToken) throw integrationError('O Bling nao retornou access_token na autorizacao.', 502);

  const expiresIn = Number(tokens.expires_in);
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw integrationError('O Bling nao informou a validade do access token; a conexao nao foi salva. Tente autorizar novamente.', 502);
  }

  const previous = await BlingOAuthToken.findOne({ key: 'bling' }).lean();
  const oldRefreshToken = previous?.refreshTokenCiphertext ? decryptToken(previous.refreshTokenCiphertext) : '';
  const refreshToken = String(tokens.refresh_token || oldRefreshToken);
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  await BlingOAuthToken.findOneAndUpdate(
    { key: 'bling' },
    {
      $set: {
        accessTokenCiphertext: encryptToken(accessToken),
        refreshTokenCiphertext: refreshToken ? encryptToken(refreshToken) : '',
        expiresAt,
        tokenType: String(tokens.token_type || previous?.tokenType || 'Bearer')
      },
      $unset: { accessToken: 1, refreshToken: 1 }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );

  return { expiresAt, hasRefreshToken: Boolean(refreshToken) };
}

async function exchangeCode(code) {
  if (!process.env.BLING_CLIENT_ID || !process.env.BLING_CLIENT_SECRET) {
    throw integrationError('Configure BLING_CLIENT_ID e BLING_CLIENT_SECRET no Render.', 503);
  }
  const body = new URLSearchParams({ grant_type: 'authorization_code', code: String(code), redirect_uri: redirectUri() });
  const response = await axios.post(tokenUrl, body.toString(), {
    auth: { username: process.env.BLING_CLIENT_ID, password: process.env.BLING_CLIENT_SECRET },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000
  });
  return saveTokens(response.data);
}

async function performRefresh() {
  if (!process.env.BLING_CLIENT_ID || !process.env.BLING_CLIENT_SECRET) {
    throw integrationError('Configure BLING_CLIENT_ID e BLING_CLIENT_SECRET no Render para renovar o token.', 503);
  }
  const stored = await BlingOAuthToken.findOne({ key: 'bling' }).lean();
  if (!stored?.refreshTokenCiphertext) {
    throw integrationError('A integracao Bling nao possui refresh token salvo. Reconecte em /api/bling/oauth/start.', 401);
  }

  const refreshToken = decryptToken(stored.refreshTokenCiphertext);
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });
  try {
    const response = await axios.post(tokenUrl, body.toString(), {
      auth: { username: process.env.BLING_CLIENT_ID, password: process.env.BLING_CLIENT_SECRET },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000
    });
    await saveTokens(response.data);
    const updated = await BlingOAuthToken.findOne({ key: 'bling' }).lean();
    if (!updated?.accessTokenCiphertext) throw integrationError('O novo access token nao foi persistido no MongoDB.', 503);
    return decryptToken(updated.accessTokenCiphertext);
  } catch (error) {
    if (error.statusCode) throw error;
    const status = error.response?.status;
    if (status === 400 || status === 401) {
      throw integrationError('O refresh token do Bling expirou ou foi revogado. Reconecte em /api/bling/oauth/start.', 401);
    }
    throw integrationError(`Falha ao renovar o token do Bling${status ? ` (HTTP ${status})` : ''}.`, 502);
  }
}

async function getAccessToken({ forceRefresh = false } = {}) {
  const stored = await BlingOAuthToken.findOne({ key: 'bling' }).lean();
  if (!stored) {
    if (forceRefresh && process.env.BLING_ACCESS_TOKEN) {
      throw integrationError('BLING_ACCESS_TOKEN manual nao possui renovacao automatica. Conecte o OAuth em /api/bling/oauth/start.', 401);
    }
    return process.env.BLING_ACCESS_TOKEN || null;
  }

  const expiresAt = stored.expiresAt ? new Date(stored.expiresAt).getTime() : 0;
  if (!forceRefresh && expiresAt > Date.now() + refreshMarginMs) {
    if (!stored.accessTokenCiphertext) throw integrationError('Token do Bling ausente no armazenamento. Reconecte em /api/bling/oauth/start.', 401);
    return decryptToken(stored.accessTokenCiphertext);
  }
  if (!stored.refreshTokenCiphertext) {
    throw integrationError('Token do Bling expirado ou sem validade conhecida e sem refresh token. Reconecte em /api/bling/oauth/start.', 401);
  }

  if (!refreshInFlight) refreshInFlight = performRefresh();
  const pending = refreshInFlight;
  try {
    return await pending;
  } finally {
    if (refreshInFlight === pending) refreshInFlight = null;
  }
}

module.exports = { authorizationUrl, exchangeCode, getAccessToken, redirectUri, validState };
