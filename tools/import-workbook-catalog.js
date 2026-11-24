const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();
const EquipmentModel = require('../server/models/EquipmentModel');
const CertificateTemplate = require('../server/models/CertificateTemplate');

const share = '\\\\srvformis\\Laboratorio(G.T)';
const userDirectory = fs.readdirSync(share, { withFileTypes: true }).find((entry) => entry.isDirectory() && entry.name.startsWith('Usu'))?.name;
const root = path.join(share, userDirectory || 'Usuários', '1. Certificados', '1.2 - Certificados', '2026');
const extensions = new Set(['.xls', '.xlsx', '.xlsm']);

function slug(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase().slice(0, 48) || 'EQUIPAMENTO';
}

function collect(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(fullPath, files);
    else if (extensions.has(path.extname(entry.name).toLowerCase())) files.push({ directory, name: entry.name });
  }
  return files;
}

async function run() {
  const files = collect(root);
  const groups = new Map();
  for (const file of files) groups.set(file.directory, [...(groups.get(file.directory) || []), file.name]);
  let createdModels = 0;
  let createdTemplates = 0;
  for (const [directory, workbookNames] of groups) {
    const folderName = path.basename(directory);
    const code = slug(folderName);
    let model = code === 'BAROMETRO'
      ? await EquipmentModel.findOne({ code: 'ALTIMETER' })
      : await EquipmentModel.findOne({ $or: [{ code }, { aliases: folderName.toUpperCase() }] });
    if (!model) {
      model = await EquipmentModel.create({ code, name: folderName, manufacturer: 'Formis', aliases: [folderName] });
      createdModels++;
    }
    const existingTemplate = await CertificateTemplate.findOne({ equipmentModel: model._id });
    if (!existingTemplate) {
      await CertificateTemplate.create({
        equipmentModel: model._id,
        title: `Certificado - ${folderName}`,
        revision: 'PENDENTE',
        templateKey: 'generic-xls',
        sourceWorkbook: workbookNames[0],
        sourceDirectory: directory,
        importStatus: 'PENDING_MAPPING',
        introText: 'Modelo importado do arquivo Excel do laboratorio. O mapeamento dos campos ainda precisa ser conferido.',
        measurementFields: [],
        active: false
      });
      createdTemplates++;
    }
  }
  console.log(JSON.stringify({ directories: groups.size, workbooks: files.length, createdModels, createdTemplates }));
}

if (!fs.existsSync(root)) throw new Error(`Caminho nao encontrado: ${root}`);
mongoose.connect(process.env.MONGODB_URI).then(run).then(() => mongoose.disconnect()).catch((error) => { console.error(error.message); process.exit(1); });
