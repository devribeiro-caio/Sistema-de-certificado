# Formis Certifica

Portal para emissao e consulta de certificados de calibracao da Formis Instrumentos de Medicao.

## Executar localmente

1. Inicie o MongoDB com `docker compose up -d` ou informe uma instancia no arquivo `.env`.
2. Instale as dependencias com `npm install`.
3. Execute `npm run dev`.
4. Abra `http://localhost:5173`.

## Fluxo principal

- O laboratorio consulta uma OS, por exemplo `OS-2026-0001` no ambiente inicial.
- O modelo do equipamento da OS encontra o modelo de certificado correspondente.
- O laboratorio informa os resultados e emite o PDF.
- O cliente cria sua conta somente com o e-mail importado do cadastro do Bling e consulta os certificados da propria empresa.

## Bling

A integracao importa uma ordem de servico pela API v3 oficial: primeiro consulta `GET /ordens/servico` com o filtro `numero`, depois consulta `GET /ordens/servico/{id}` usando o ID retornado pela listagem. Nao configure `BLING_SERVICE_ORDER_PATH`: essa rota antiga nao corresponde ao recurso oficial atual.

### Variaveis no Render

- `BLING_CLIENT_ID`: ID da aplicacao OAuth criada no portal de desenvolvedores do Bling.
- `BLING_CLIENT_SECRET`: segredo da mesma aplicacao.
- `BLING_REDIRECT_URI`: URL publica exata cadastrada na aplicacao, no formato `https://SEU-DOMINIO/api/bling/oauth/callback`.
- `BLING_TOKEN_ENCRYPTION_KEY`: segredo estavel e aleatorio recomendado para cifrar tokens no MongoDB. Se omitido, o sistema deriva a chave de `JWT_SECRET` ou, como ultimo fallback, de `BLING_CLIENT_SECRET`.
- `JWT_SECRET`: mantenha o valor estavel; ele tambem assina o estado OAuth e pode servir como chave de cifragem quando nao houver `BLING_TOKEN_ENCRYPTION_KEY`.
- `MONGODB_URI`: conexao MongoDB ja usada pelo portal; os tokens OAuth ficam cifrados nessa base.

`BLING_BASE_URL` e opcional; por padrao e `https://api.bling.com.br/Api/v3`. `BLING_ACCESS_TOKEN` fica somente como compatibilidade de emergencia: nao permite renovacao automatica e deve ser substituido pela conexao OAuth. Nao publique nem envie os valores secretos em mensagens.

### Conectar ou reconectar

1. No portal de desenvolvedores do Bling, cadastre exatamente a URL configurada em `BLING_REDIRECT_URI`.
2. Salve as variaveis no Render e faca o deploy da versao corrigida.
3. Acesse `https://SEU-DOMINIO/api/bling/oauth/start`, entre no Bling e autorize a aplicacao.
4. A tela “Bling conectado” confirma que os tokens foram salvos. O access token e o refresh token ficam cifrados no MongoDB; o sistema renova o access token automaticamente antes do vencimento.
5. Nao altere `BLING_TOKEN_ENCRYPTION_KEY` (nem a chave de fallback) depois da conexao. Se ela for trocada, os tokens ja salvos nao poderao ser decifrados e sera necessario reconectar.

A consulta de uma OS nao encontrada no cache usa a listagem oficial por numero e importa os dados do detalhe para o cache local. O endpoint `POST /api/bling/orders/sync` continua disponivel para uma integracao autorizada enviar uma OS manualmente.
