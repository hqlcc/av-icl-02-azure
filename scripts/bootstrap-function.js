// Presente somente no pacote temporário de instalação, protegido pela chave mestra.
// O deploy definitivo substitui este pacote pelo que contém as três funções da prova.
const { app } = require('@azure/functions');
const { databaseConfig } = require('../src/lib/database');
const { initializeDatabase } = require('./init-db');

app.http('instalarTabela', {
  authLevel: 'admin', methods: ['POST'], route: 'instalar-tabela',
  handler: async request => {
    const { adminUser, adminPassword } = await request.json();
    if (typeof adminUser !== 'string' || typeof adminPassword !== 'string') return { status: 400 };
    const runtimeConfig = databaseConfig();
    try {
      await initializeDatabase({ ...runtimeConfig, user: adminUser, password: adminPassword }, runtimeConfig.user, runtimeConfig.password);
      return { jsonBody: { initialized: true } };
    } catch (error) {
      return { status: 503, jsonBody: { code: error.code || 'SQL', number: error.number || 0 } };
    }
  }
});
