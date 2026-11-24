const mongoose = require('mongoose');

mongoose.set('bufferCommands', false);

async function connectDatabase() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/formis-certificados';
  await mongoose.connect(uri);
  console.log('MongoDB conectado.');
}

module.exports = { connectDatabase };
