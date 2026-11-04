const { makeEvent, parseEvent } = require('./domain');

function createTimerHandler({ fetchComment, analyzeSentiment, queueOutput }) {
  return async function coletarComentario(timer, context) {
    if (timer.isPastDue) context.warn('Execução do timer atrasada.');
    const collectedAt = new Date().toISOString();
    const comment = await fetchComment();
    const analysis = await analyzeSentiment(comment.text);
    const event = makeEvent(comment, analysis, { collectedAt });
    context.extraOutputs.set(queueOutput, JSON.stringify(event));
    context.log('Análise preparada para a fila.', { eventId: event.eventId, sentiment: event.sentiment });
  };
}

function createQueueHandler({ insertEvent }) {
  return async function salvarSentimento(message, context) {
    const event = parseEvent(message);
    const inserted = await insertEvent(event);
    context.log(inserted ? 'Sentimento salvo no SQL.' : 'Reentrega ignorada: evento já salvo.', { eventId: event.eventId });
  };
}

function createHttpHandler({ getTotals }) {
  return async function totaisSentimentos(_request, context) {
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
    try {
      return { status: 200, headers, jsonBody: await getTotals() };
    } catch (error) {
      // Não expor credenciais/host SQL nem devolver zeros que pareçam resultados reais.
      context.error('Consulta SQL indisponível.', { code: error.code || 'UNKNOWN' });
      return { status: 503, headers, jsonBody: { error: 'Não foi possível consultar os totais. Tente novamente.' } };
    }
  };
}

module.exports = { createTimerHandler, createQueueHandler, createHttpHandler };
