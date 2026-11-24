const axios = require('axios');
const Customer = require('../models/Customer');
const ServiceOrder = require('../models/ServiceOrder');
const { normalizeOrderNumber } = require('../utils/formatters');

function mapBlingOrder(payload, requestedNumber) {
  const source = payload?.data || payload;
  const customer = source?.cliente || source?.contato || {};
  const items = source?.itens || source?.equipamentos || [];
  const item = Array.isArray(items) ? items[0] || {} : items;

  return {
    number: normalizeOrderNumber(source?.numero || source?.numeroOrdem || requestedNumber),
    blingId: String(source?.id || ''),
    customer: {
      externalId: String(customer?.id || customer?.codigo || ''),
      legalName: customer?.nome || customer?.razaoSocial || 'Cliente sem nome',
      tradeName: customer?.fantasia || '',
      document: customer?.numeroDocumento || customer?.cnpj || customer?.cpf || '',
      email: customer?.email || '',
      phone: customer?.telefone || ''
    },
    equipment: {
      modelCode: item?.codigo || item?.modelo || source?.modelo || '',
      modelName: item?.descricao || item?.nome || source?.descricao || '',
      serialNumber: item?.numeroSerie || item?.serie || source?.numeroSerie || '',
      description: item?.descricao || source?.observacoes || ''
    },
    openedAt: source?.data || source?.dataAbertura || new Date(),
    rawBling: source
  };
}

async function cacheMappedOrder(mapped, source = 'BLING') {
  if (!mapped.number || !mapped.equipment.modelCode) throw new Error('A OS recebida nao possui numero ou modelo do equipamento.');
  const customerQuery = mapped.customer.externalId ? { externalId: mapped.customer.externalId } : { email: mapped.customer.email };
  const customer = await Customer.findOneAndUpdate(customerQuery, { $set: mapped.customer }, { new: true, upsert: true, setDefaultsOnInsert: true });

  return ServiceOrder.findOneAndUpdate(
    { number: mapped.number },
    { $set: { blingId: mapped.blingId, customer: customer._id, equipment: mapped.equipment, openedAt: mapped.openedAt, rawBling: mapped.rawBling, source } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

async function resolveServiceOrder(number) {
  const normalizedNumber = normalizeOrderNumber(number);
  const cached = await ServiceOrder.findOne({ number: normalizedNumber }).populate('customer');
  if (cached) return cached;
  if (!process.env.BLING_ACCESS_TOKEN) return null;

  const path = (process.env.BLING_SERVICE_ORDER_PATH || '/servicos/ordens/{number}').replace('{number}', encodeURIComponent(normalizedNumber));
  const baseUrl = process.env.BLING_BASE_URL || 'https://api.bling.com.br/Api/v3';
  const response = await axios.get(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${process.env.BLING_ACCESS_TOKEN}` },
    timeout: 10000
  });

  return (await cacheMappedOrder(mapBlingOrder(response.data, number))).populate('customer');
}

module.exports = { cacheMappedOrder, mapBlingOrder, resolveServiceOrder };
