require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');
const { cacheMappedOrder, mapBlingOrder } = require('../server/services/blingService');

const api = 'http://localhost:3333/api';
const testOrder = {
  numero: 'OS-TEST-ALTIMETER-0001',
  id: 'TEST-ALTIMETER-0001',
  cliente: { id: 'TEST-FORMIS-001', nome: 'Cliente de Teste Formis', numeroDocumento: '00.000.000/0001-00', email: 'teste@formis.local' },
  itens: [{ codigo: 'ALTIMETER', descricao: 'Barometro Digital - 8 IN 1 Digital Altimeter', numeroSerie: 'TEST-2026-0001' }]
};
const points = [540, 620, 700, 780, 860, 940, 1020, 1100].map((point, index) => ({
  point,
  referenceLoading: point,
  readingLoading: (point + 0.2 - index * 0.03).toFixed(1),
  errorLoading: '0.2',
  uncertaintyLoading: '1.6',
  referenceUnloading: point,
  readingUnloading: (point - 0.1 + index * 0.02).toFixed(1),
  errorUnloading: '-0.1',
  uncertaintyUnloading: '1.4'
}));

async function request(path, options = {}) {
  const response = await fetch(`${api}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

(async () => {
  const session = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }) });
  const headers = { Authorization: `Bearer ${session.token}` };
  await mongoose.connect(process.env.MONGODB_URI);
  await cacheMappedOrder(mapBlingOrder(testOrder, testOrder.numero), 'BLING');
  await mongoose.disconnect();
  const measurements = { temperature: '23', humidity: '<80', traceability: 'Padrao Formis - teste', points };
  const certificate = await request('/certificates', { method: 'POST', headers, body: JSON.stringify({ orderNumber: testOrder.numero, measurements, notes: 'Certificado de teste - nao valido para uso comercial.' }) });
  const pdfResponse = await fetch(`${api}/certificates/${certificate._id}/pdf`, { headers });
  if (!pdfResponse.ok) throw new Error(`PDF HTTP ${pdfResponse.status}`);
  fs.writeFileSync('test-certificate-altimeter.pdf', Buffer.from(await pdfResponse.arrayBuffer()));
  console.log(JSON.stringify({ certificateNumber: certificate.certificateNumber, certificateId: certificate._id, orderNumber: testOrder.numero, pdf: 'test-certificate-altimeter.pdf' }));
})().catch((error) => { console.error(error.message); process.exit(1); });
