require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const apiRoutes = require('./routes/apiRoutes');
const { connectDatabase } = require('./config/database');
const { seedDatabase } = require('./config/seed');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();
const port = Number(process.env.PORT || 3333);

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
app.use('/api', apiRoutes);
app.use(errorHandler);

async function startServer() {
  try {
    await connectDatabase();
    await seedDatabase();
    app.listen(port, () => console.log(`API Formis Certifica em http://localhost:${port}`));
  } catch (error) {
    console.error(`MongoDB indisponivel: ${error.message}`);
    process.exit(1);
  }
}

startServer();
