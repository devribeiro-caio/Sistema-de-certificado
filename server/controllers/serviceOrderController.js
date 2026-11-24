const { cacheMappedOrder, mapBlingOrder, resolveServiceOrder } = require('../services/blingService');
const { templateForModelCode } = require('../services/templateService');

async function getServiceOrder(req, res, next) {
  try {
    const order = await resolveServiceOrder(req.params.number);
    if (!order) return res.status(404).json({ error: 'OS nao encontrada. Sincronize a OS pelo Bling ou confira o numero informado.' });
    const template = await templateForModelCode(order.equipment.modelCode);
    if (!template) return res.status(422).json({ error: `Nao existe modelo de certificado ativo para ${order.equipment.modelCode}.` });
    return res.json({ order, template });
  } catch (error) { return next(error); }
}

async function syncServiceOrder(req, res, next) {
  try {
    const order = await cacheMappedOrder(mapBlingOrder(req.body, req.body.number), 'MANUAL');
    return res.status(201).json(await order.populate('customer'));
  } catch (error) { return next(error); }
}

module.exports = { getServiceOrder, syncServiceOrder };
