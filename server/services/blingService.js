const axios = require('axios');
const Customer = require('../models/Customer');
const ServiceOrder = require('../models/ServiceOrder');
const { getAccessToken } = require('./blingOAuthService');
const { normalizeOrderNumber } = require('../utils/formatters');

function integrationError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function firstNonEmpty(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') ?? '';
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function mapBlingOrder(payload, requestedNumber) {
  const source = payload?.data || payload || {};
  const customer = source.contato || source.cliente || {};
  const services = asArray(source.servicos);
  const parts = asArray(source.pecas);
  const legacyItems = asArray(source.itens || source.equipamentos);

  const serviceProductCode = firstNonEmpty(...services.map((line) => line?.produto?.codigo));
  const partProductCode = firstNonEmpty(...parts.map((line) => line?.produto?.codigo));
  const serviceLineCode = firstNonEmpty(...services.map((line) => line?.codigoProduto || line?.codigo));
  const partLineCode = firstNonEmpty(...parts.map((line) => line?.codigoProduto || line?.codigo));
  const equipment = source.equipamento;
  const equipmentText = typeof equipment === 'string'
    ? equipment
    : firstNonEmpty(equipment?.descricao, equipment?.nome, equipment?.modelo);
  const equipmentObjectCode = typeof equipment === 'object' && equipment
    ? firstNonEmpty(equipment.codigo, equipment.codigoModelo, equipment.referencia)
    : '';
  const legacyItem = legacyItems[0] || {};
  const legacyProduct = legacyItem.produto || {};
  const modelCode = firstNonEmpty(
    serviceProductCode,
    partProductCode,
    serviceLineCode,
    partLineCode,
    equipmentObjectCode,
    source.codigoEquipamento,
    legacyProduct.codigo,
    legacyItem.codigo,
    legacyItem.modelo,
    source.modelo,
    equipmentText
  );
  const modelName = firstNonEmpty(
    equipmentText,
    legacyProduct.descricao,
    legacyProduct.nome,
    legacyItem.descricao,
    legacyItem.nome,
    source.modelo,
    source.descricao
  );
  const serviceOrderId = firstNonEmpty(source.id, source.idOrdemServico);

  return {
    number: normalizeOrderNumber(firstNonEmpty(source.numero, source.numeroOrdem, requestedNumber)),
    blingId: String(serviceOrderId),
    customer: {
      externalId: String(firstNonEmpty(customer.id, customer.codigo)),
      legalName: firstNonEmpty(customer.nome, customer.razaoSocial, 'Cliente sem nome'),
      tradeName: firstNonEmpty(customer.fantasia),
      document: firstNonEmpty(customer.numeroDocumento, customer.documento, customer.cnpj, customer.cpf),
      email: firstNonEmpty(customer.email),
      phone: firstNonEmpty(customer.telefone, customer.celular)
    },
    equipment: {
      modelCode: String(modelCode),
      modelName: String(modelName),
      serialNumber: String(firstNonEmpty(source.numeroSerieEquipamento, source.numeroSerie, legacyItem.numeroSerie, legacyItem.serie)),
      description: String(firstNonEmpty(source.observacoes, equipmentText, legacyItem.descricao, source.descricao))
    },
    openedAt: firstNonEmpty(source.data, source.dataAbertura, source.dataEmissao) || new Date(),
    rawBling: source
  };
}

async function cacheMappedOrder(mapped, source = 'BLING') {
  if (!mapped.number) throw integrationError('A OS recebida nao possui numero.', 422);
  if (!mapped.equipment?.modelCode) {
    throw integrationError('A OS do Bling nao possui codigo/modelo do equipamento em equipamento, servicos ou pecas.', 422);
  }

  const customerData = { ...mapped.customer };
  for (const field of ['externalId', 'tradeName', 'document', 'email', 'phone']) {
    if (!customerData[field]) delete customerData[field];
  }

  let customer;
  const customerQuery = customerData.externalId
    ? { externalId: customerData.externalId }
    : customerData.email
      ? { email: customerData.email }
      : null;

  if (customerQuery) {
    customer = await Customer.findOneAndUpdate(
      customerQuery,
      { $set: customerData },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } else {
    customer = await Customer.create(customerData);
  }

  return ServiceOrder.findOneAndUpdate(
    { number: mapped.number },
    { $set: { blingId: mapped.blingId, customer: customer._id, equipment: mapped.equipment, openedAt: mapped.openedAt, rawBling: mapped.rawBling, source } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

function apiError(error, action) {
  const status = error.response?.status;
  if (status === 401) {
    return integrationError('O Bling recusou o access token. Reconecte a integracao em /api/bling/oauth/start; se estiver usando token manual, troque-o por OAuth.', 401);
  }
  if (status === 403) {
    return integrationError('O Bling negou permissao para consultar ordens de servico. Confira as permissoes/escopos da aplicacao e autorize novamente.', 403);
  }
  if (status === 404) {
    return integrationError(`O Bling retornou 404 ao ${action}. Confira a versao/base da API e o ID retornado pela listagem.`, 502);
  }
  if (status) return integrationError(`Falha ao ${action} no Bling (HTTP ${status}).`, 502);
  return integrationError(`Nao foi possivel comunicar com a API do Bling ao ${action}. ${error.message || ''}`.trim(), 502);
}

async function blingGet(url, params, action) {
  let accessToken = await getAccessToken();
  if (!accessToken) {
    throw integrationError('Integracao Bling sem credenciais. Configure o OAuth e conecte em /api/bling/oauth/start.', 503);
  }
  const options = (token) => ({
    params,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    timeout: 15000
  });

  try {
    const response = await axios.get(url, options(accessToken));
    return response.data;
  } catch (error) {
    if (error.response?.status !== 401) throw apiError(error, action);
    try {
      accessToken = await getAccessToken({ forceRefresh: true });
    } catch (refreshError) {
      throw refreshError;
    }
    try {
      const response = await axios.get(url, options(accessToken));
      return response.data;
    } catch (retryError) {
      throw apiError(retryError, action);
    }
  }
}

async function resolveServiceOrder(number) {
  const normalizedNumber = normalizeOrderNumber(number);
  const cached = await ServiceOrder.findOne({ number: normalizedNumber }).populate('customer');
  if (cached) return cached;

  const baseUrl = (process.env.BLING_BASE_URL || 'https://api.bling.com.br/Api/v3').replace(/\/+$/, '');
  const listPayload = await blingGet(
    `${baseUrl}/ordens/servico`,
    { numero: normalizedNumber, pagina: 1, limite: 100 },
    'consultar a lista de ordens de servico'
  );
  const orders = Array.isArray(listPayload?.data)
    ? listPayload.data
    : Array.isArray(listPayload)
      ? listPayload
      : [];
  const match = orders.find((item) => normalizeOrderNumber(item?.numero) === normalizedNumber);
  if (!match) return null;

  const blingId = firstNonEmpty(match.id, match.idOrdemServico);
  if (!blingId) throw integrationError('O Bling encontrou a OS, mas nao retornou o ID necessario para consultar os detalhes.', 502);

  const detailPayload = await blingGet(
    `${baseUrl}/ordens/servico/${encodeURIComponent(String(blingId))}`,
    undefined,
    'consultar os detalhes da ordem de servico'
  );
  const mapped = mapBlingOrder(detailPayload, normalizedNumber);
  if (!mapped.blingId) mapped.blingId = String(blingId);
  return (await cacheMappedOrder(mapped, 'BLING')).populate('customer');
}

module.exports = { cacheMappedOrder, mapBlingOrder, resolveServiceOrder };
