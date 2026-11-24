require('dotenv').config();
const fs = require('fs');
const { Writable } = require('stream');
const mongoose = require('mongoose');
require('../server/models/Customer');
require('../server/models/ServiceOrder');
const Certificate = require('../server/models/Certificate');
const { streamCertificatePdf } = require('../server/utils/certificatePdf');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const certificate = await Certificate.findOne({ certificateNumber: 'FOR-2026-00005' }).populate('customer serviceOrder').lean();
  if (!certificate) throw new Error('Certificado de teste nao encontrado.');
  const output = fs.createWriteStream('test-certificate-altimeter.pdf');
  const response = new Writable({ write(chunk, encoding, callback) { output.write(chunk, encoding, callback); } });
  response.setHeader = () => {};
  response.on('finish', async () => { output.end(); await mongoose.disconnect(); console.log('PDF_REGENERADO'); });
  streamCertificatePdf(certificate, response);
})().catch((error) => { console.error(error.message); process.exit(1); });
