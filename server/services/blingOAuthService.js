const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const envPath = path.resolve(__dirname, '../../.env');
const authorizeUrl = 'https://www.bling.com.br/Api/v3/oauth/authorize';
const tokenUrl = 'https://www.bling.com.br/Api/v3/oauth/token';

function redirectUri() { return process.env.BLING_REDIRECT_URI || `http://localhost:${process.env.PORT || 3333}/api/bling/oauth/callback`; }
function makeState() {
  const payload = Buffer.from(JSON.stringify({ issuedAt: Date.now() })).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.JWT_SECRET || 'formis-oauth-state').update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
function validState(state) {
  if (!state || !state.includes('.')) return false;
  const [payload, signature] = state.split('.');
  const expected = crypto.createHmac('sha256', process.env.JWT_SECRET || 'formis-oauth-state').update(payload).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  return Date.now() - data.issuedAt < 10 * 60 * 1000;
}
function authorizationUrl() {
  if (!process.env.BLING_CLIENT_ID) throw new Error('Configure BLING_CLIENT_ID no arquivo .env.');
  return `${authorizeUrl}?${new URLSearchParams({ response_type: 'code', client_id: process.env.BLING_CLIENT_ID, state: makeState() }).toString()}`;
}
function saveTokens(tokens) {
  let source = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  for (const [key, value] of Object.entries({ BLING_ACCESS_TOKEN: tokens.access_token, BLING_REFRESH_TOKEN: tokens.refresh_token || '' })) {
    const line = `${key}=${value || ''}`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    source = pattern.test(source) ? source.replace(pattern, line) : `${source.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(envPath, source);
  process.env.BLING_ACCESS_TOKEN = tokens.access_token;
  if (tokens.refresh_token) process.env.BLING_REFRESH_TOKEN = tokens.refresh_token;
}
async function exchangeCode(code) {
  if (!process.env.BLING_CLIENT_ID || !process.env.BLING_CLIENT_SECRET) throw new Error('Configure BLING_CLIENT_ID e BLING_CLIENT_SECRET no arquivo .env.');
  const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() });
  const response = await axios.post(tokenUrl, body.toString(), { auth: { username: process.env.BLING_CLIENT_ID, password: process.env.BLING_CLIENT_SECRET }, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 });
  saveTokens(response.data);
  return response.data;
}
module.exports = { authorizationUrl, exchangeCode, redirectUri, validState };
