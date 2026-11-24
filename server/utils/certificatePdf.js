const PDFDocument = require('pdfkit');

function writeBarometerResults(document, certificate) {
  const points = certificate.measurements?.points || [];
  if (!points.length) return;
  const columns = [['Ponto', 'point'], ['VC Carga', 'referenceLoading'], ['VM Carga', 'readingLoading'], ['Erro Carga', 'errorLoading'], ['Incerteza Carga', 'uncertaintyLoading'], ['VC Desc.', 'referenceUnloading'], ['VM Desc.', 'readingUnloading'], ['Erro Desc.', 'errorUnloading'], ['Incerteza Desc.', 'uncertaintyUnloading']];
  const widths = [42, 52, 58, 48, 62, 52, 58, 48, 62];
  const left = 50;
  document.moveDown().fillColor('#10252d').fontSize(11).text('RESULTADOS DE CALIBRACAO').moveDown(.4);
  let y = document.y;
  let x = left;
  document.fontSize(7);
  columns.forEach(([label], index) => { document.rect(x, y, widths[index], 18).fill('#10252d'); document.fillColor('#fff').text(label, x + 3, y + 6, { width: widths[index] - 6 }); x += widths[index]; });
  y += 18;
  points.forEach((point) => { x = left; columns.forEach(([_, key], index) => { document.rect(x, y, widths[index], 17).strokeColor('#d5dde0').stroke(); document.fillColor('#26363d').text(String(point[key] ?? point.point ?? '-'), x + 3, y + 5, { width: widths[index] - 6 }); x += widths[index]; }); y += 17; });
  document.y = y + 8;
}

function streamCertificatePdf(certificate, res) {
  const document = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=${certificate.certificateNumber}.pdf`);
  document.pipe(res);
  document.fillColor('#10252d').fontSize(20).text('FORMIS', { continued: true }).fillColor('#e45435').text(' CERTIFICA');
  document.moveDown(.4).fillColor('#10252d').fontSize(15).text(certificate.templateSnapshot.title);
  document.fontSize(9).fillColor('#4b5b62').text(`Certificado: ${certificate.certificateNumber}  |  Revisao: ${certificate.templateSnapshot.revision}`);
  document.moveDown().strokeColor('#d5dde0').moveTo(50, document.y).lineTo(545, document.y).stroke().moveDown();
  document.fillColor('#10252d').fontSize(11).text('IDENTIFICACAO').fontSize(10).fillColor('#26363d');
  document.text(`Cliente: ${certificate.customer.legalName}`).text(`Ordem de servico: ${certificate.serviceOrder.number}`).text(`Equipamento: ${certificate.equipment.modelName || certificate.equipment.modelCode}`).text(`Modelo: ${certificate.equipment.modelCode}    Serie: ${certificate.equipment.serialNumber || 'Nao informada'}`);
  if (certificate.equipment.manufacturer) document.text(`Fabricante: ${certificate.equipment.manufacturer}`);
  if (certificate.equipment.description) document.text(`Descricao: ${certificate.equipment.description}`);
  document.moveDown().text(certificate.templateSnapshot.introText);
  document.x = 50;
  if (certificate.templateSnapshot.templateKey === 'barometer-altimeter') {
    document.moveDown().fillColor('#10252d').fontSize(11).text('CONDICOES DA CALIBRACAO').moveDown(.3);
    certificate.templateSnapshot.measurementFields.forEach((field) => document.fontSize(10).fillColor('#26363d').text(`${field.label}: ${certificate.measurements?.[field.key] || '-'}${field.unit ? ` ${field.unit}` : ''}`));
    writeBarometerResults(document, certificate);
  } else {
    document.moveDown().fillColor('#10252d').fontSize(11).text('RESULTADOS').moveDown(.4);
    certificate.templateSnapshot.measurementFields.forEach((field) => document.fontSize(10).fillColor('#26363d').text(`${field.label}: ${certificate.measurements?.[field.key] || '-'}${field.unit ? ` ${field.unit}` : ''}`));
  }
  document.x = 50;
  if (certificate.notes) document.moveDown().text(`Observacoes: ${certificate.notes}`);
  document.x = 50;
  document.moveDown(2).strokeColor('#d5dde0').moveTo(50, document.y).lineTo(260, document.y).stroke().moveDown(.25).fontSize(9).fillColor('#4b5b62').text('Laboratorio Formis Instrumentos de Medicao').text(`Emissao: ${new Intl.DateTimeFormat('pt-BR').format(certificate.issuedAt)}`).moveDown().fontSize(8).text(`Codigo de verificacao: ${certificate.publicCode}`);
  document.end();
}

module.exports = { streamCertificatePdf };
