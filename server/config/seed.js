const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Customer = require('../models/Customer');
const EquipmentModel = require('../models/EquipmentModel');
const CertificateTemplate = require('../models/CertificateTemplate');
const ServiceOrder = require('../models/ServiceOrder');

async function seedDatabase() {
  const email = String(process.env.ADMIN_EMAIL || 'lab@formis.com.br').toLowerCase();
  if (process.env.ADMIN_PASSWORD && !await User.findOne({ email })) {
    await User.create({ name: 'Laboratorio Formis', email, passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12), role: 'ADMIN' });
    console.log('Administrador inicial criado.');
  }

  const customer = await Customer.findOneAndUpdate(
    { externalId: 'DEMO-001' },
    { $setOnInsert: { legalName: 'Cliente demonstracao Formis', tradeName: 'Cliente Demo', email: 'cliente@formis.demo', document: '00.000.000/0001-00' } },
    { new: true, upsert: true }
  );
  const model = await EquipmentModel.findOneAndUpdate(
    { code: 'FOR-550' },
    { $setOnInsert: { name: 'Termometro infravermelho FOR-550', manufacturer: 'Formis' } },
    { new: true, upsert: true }
  );
  await CertificateTemplate.findOneAndUpdate(
    { equipmentModel: model._id },
    { $setOnInsert: { title: 'Certificado de Calibracao - FOR-550', revision: 'REV. 01', measurementFields: [
      { key: 'range', label: 'Faixa avaliada', unit: 'C', required: true },
      { key: 'reference', label: 'Padrao de referencia', unit: '', required: true },
      { key: 'result', label: 'Resultado', unit: 'C', required: true },
      { key: 'uncertainty', label: 'Incerteza', unit: 'C', required: true }
    ] } }, { upsert: true }
  );

  const barometer = await EquipmentModel.findOneAndUpdate(
    { code: 'ALTIMETER' },
    { $set: {
      name: 'Bafometro Digital - 8 IN 1 Digital Altimeter',
      manufacturer: 'ALTIMETER',
      aliases: ['BAFOMETRO', 'BAFOMETRO DIGITAL', '8 IN 1 DIGITAL ALTIMETER', '8 IN 1 - DIGITAL ALTIMETER']
    } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  await CertificateTemplate.findOneAndUpdate(
    { equipmentModel: barometer._id },
    { $set: {
      title: 'Certificado de Calibracao - Bafometro Digital',
      revision: 'REV. 01',
      templateKey: 'barometer-altimeter',
      sourceWorkbook: 'Bafometro Digital - Altimeter.xls',
      introText: 'O procedimento de calibracao baseia-se na comparacao a padroes certificados junto a Rede Brasileira de Calibracao do Inmetro. Foram realizadas series de leituras em carregamento e descarregamento.',
      measurementConfig: {
        indicationRange: '600 a 1100 hPa',
        calibratedRange: '600 a 1100 hPa',
        points: [540, 620, 700, 780, 860, 940, 1020, 1100],
        columns: ['referenceLoading', 'readingLoading', 'errorLoading', 'uncertaintyLoading', 'referenceUnloading', 'readingUnloading', 'errorUnloading', 'uncertaintyUnloading']
      },
      measurementFields: [
        { key: 'temperature', label: 'Temperatura', unit: 'C', required: true },
        { key: 'humidity', label: 'Umidade', unit: '%UR', required: true },
        { key: 'traceability', label: 'Rastreabilidade', unit: '', required: true }
      ],
      active: true
    } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  await ServiceOrder.findOneAndUpdate(
    { number: 'OS-2026-0001' },
    { $setOnInsert: { customer: customer._id, equipment: { modelCode: 'FOR-550', modelName: model.name, serialNumber: 'FOR550-0001', description: 'Termometro infravermelho para calibracao' }, openedAt: new Date(), source: 'DEMO' } },
    { upsert: true }
  );
}

module.exports = { seedDatabase };
