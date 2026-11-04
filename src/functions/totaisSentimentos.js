const { app } = require('@azure/functions');
const { getTotals } = require('../lib/database');
const { createHttpHandler } = require('../lib/handlers');

app.http('totaisSentimentos', {
  route: 'sentimentos/totais',
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: createHttpHandler({ getTotals })
});
