const { TextAnalyticsClient, AzureKeyCredential } = require('@azure/ai-text-analytics');
const { parseComment } = require('./domain');

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Configuração ausente: ${name}`);
  return value;
}

async function fetchComment() {
  const url = process.env.COMMENTS_URL || 'https://backend-n75y.onrender.com/comentarios';
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    // O endpoint do Render pode precisar de tempo para sair de um cold start.
    signal: AbortSignal.timeout(60000)
  });
  if (!response.ok) throw new Error(`Endpoint de comentários retornou HTTP ${response.status}.`);
  return parseComment(await response.json());
}

let languageClient;
async function analyzeSentiment(text) {
  languageClient ??= new TextAnalyticsClient(required('LANGUAGE_ENDPOINT'), new AzureKeyCredential(required('LANGUAGE_KEY')), {
    retryOptions: { maxRetries: 2, maxRetryDelayInMs: 3000 }
  });
  const [result] = await languageClient.analyzeSentiment([text], 'pt', {
    disableServiceLogs: true,
    abortSignal: AbortSignal.timeout(20000)
  });
  if (!result || result.error) {
    throw new Error(`Falha na análise de sentimento: ${result?.error?.code || 'resposta vazia'}.`);
  }
  return result;
}

module.exports = { required, fetchComment, analyzeSentiment };
