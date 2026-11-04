const { app, output } = require('@azure/functions');
const { fetchComment, analyzeSentiment } = require('../lib/services');
const { createTimerHandler } = require('../lib/handlers');

const queueOutput = output.storageQueue({ queueName: 'sentimentos', connection: 'AzureWebJobsStorage' });

app.timer('coletarComentario', {
  schedule: '*/10 * * * * *',
  runOnStartup: false,
  useMonitor: false,
  extraOutputs: [queueOutput],
  handler: createTimerHandler({ fetchComment, analyzeSentiment, queueOutput })
});
