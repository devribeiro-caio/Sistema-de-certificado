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

Defina `BLING_ACCESS_TOKEN` no `.env` e ajuste `BLING_SERVICE_ORDER_PATH` conforme o recurso contratado no Bling. A API busca uma OS nao encontrada no cache local e a importa para o sistema. O endpoint `POST /api/bling/orders/sync` tambem permite que uma integracao ou webhook envie uma OS para o cache.
