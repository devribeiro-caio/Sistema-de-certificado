const fs = require('fs');
const path = require('path');

const share = '\\\\srvformis\\Laboratorio(G.T)';
const userDirectory = fs.readdirSync(share, { withFileTypes: true }).find((entry) => entry.isDirectory() && entry.name.startsWith('Usu'))?.name;
const root = path.join(share, userDirectory || 'Usuários', '1. Certificados', '1.2 - Certificados', '2026');
const workbookExtensions = new Set(['.xls', '.xlsx', '.xlsm']);

function walk(directory, entries = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath, entries);
    else if (workbookExtensions.has(path.extname(entry.name).toLowerCase())) entries.push({ directory, name: entry.name, fullPath });
  }
  return entries;
}

if (!fs.existsSync(root)) throw new Error(`Caminho nao encontrado: ${root}`);

const workbooks = walk(root);
const directories = [...new Set(workbooks.map((item) => item.directory))];
const grouped = new Map();
for (const workbook of workbooks) grouped.set(workbook.directory, [...(grouped.get(workbook.directory) || []), workbook.name]);

console.log(JSON.stringify({
  root,
  directoriesWithWorkbooks: directories.length,
  workbooks: workbooks.length,
  groups: [...grouped.entries()].map(([directory, files]) => ({ directory, files }))
}, null, 2));
