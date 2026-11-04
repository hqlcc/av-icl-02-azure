const { app } = require('@azure/functions');
const { insertEvent } = require('../lib/database');
const { createQueueHandler } = require('../lib/handlers');

app.storageQueue('salvarSentimento', {
  queueName: 'sentimentos',
  connection: 'AzureWebJobsStorage',
  handler: createQueueHandler({ insertEvent })
});
