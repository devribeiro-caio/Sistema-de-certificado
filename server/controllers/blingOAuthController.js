const { authorizationUrl, exchangeCode, redirectUri, validState } = require('../services/blingOAuthService');
function html(title, message, success = false) { return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:Arial,sans-serif;padding:40px;color:#10252d"><h1>${title}</h1><p>${message}</p>${success ? '<p>Voce pode fechar esta aba e voltar ao sistema Formis Certifica.</p>' : ''}</body></html>`; }
function start(_req, res, next) { try { return res.redirect(authorizationUrl()); } catch (error) { return next(error); } }
async function callback(req, res) {
  try {
    if (req.query.error) return res.status(400).send(html('Autorizacao nao concluida', 'O Bling recusou ou cancelou a autorizacao.'));
    if (!validState(req.query.state)) return res.status(400).send(html('Callback invalido', 'O estado de seguranca expirou ou nao confere. Inicie a autorizacao novamente.'));
    if (!req.query.code) return res.status(400).send(html('Codigo ausente', 'O Bling nao retornou o codigo de autorizacao.'));
    await exchangeCode(req.query.code);
    return res.send(html('Bling conectado', `A autorizacao foi concluida com sucesso. Callback configurado em ${redirectUri()}.`, true));
  } catch (error) {
    const detail = error.response?.data?.error?.description || error.response?.data?.error || error.message;
    return res.status(502).send(html('Falha ao conectar com o Bling', detail));
  }
}
module.exports = { callback, start };
