const { randomUUID } = require('node:crypto');

const SENTIMENTS = Object.freeze(['positive', 'neutral', 'negative']);

function parseComment(payload) {
  // Contrato observado no endpoint fornecido pelo professor: { id, comentario }.
  if (!payload || typeof payload.comentario !== 'string' || !payload.comentario.trim()) {
    throw new Error('Resposta inválida: esperado { id, comentario: texto não vazio }.');
  }
  const text = payload.comentario.trim();
  // Limite conservador para documentos síncronos e para o tamanho da mensagem.
  if (text.length > 5000) throw new Error('Comentário excede o limite de 5000 caracteres.');
  const sourceId = payload.id == null ? null : String(payload.id);
  if (sourceId !== null && sourceId.length > 100) throw new Error('ID de origem muito longo.');
  return { sourceId, text };
}

function validateScores(scores) {
  if (!scores || SENTIMENTS.some(key => !Number.isFinite(scores[key]) || scores[key] < 0 || scores[key] > 1)) {
    throw new Error('Scores de confiança inválidos.');
  }
}

function normalizeSentiment(result) {
  validateScores(result.confidenceScores);
  if (SENTIMENTS.includes(result.sentiment)) return result.sentiment;
  if (result.sentiment !== 'mixed') throw new Error('Sentimento não reconhecido.');
  // Adaptação explícita ao enunciado: maior score; empate no maior score => neutral.
  const scores = result.confidenceScores;
  const maximum = Math.max(...SENTIMENTS.map(key => scores[key]));
  const winners = SENTIMENTS.filter(key => scores[key] === maximum);
  return winners.length === 1 ? winners[0] : 'neutral';
}

function makeEvent(comment, analysis, metadata = {}) {
  return {
    version: 1,
    eventId: metadata.eventId ?? randomUUID(),
    sourceId: comment.sourceId,
    text: comment.text,
    sentiment: normalizeSentiment(analysis),
    originalSentiment: analysis.sentiment,
    confidenceScores: analysis.confidenceScores,
    collectedAt: metadata.collectedAt ?? new Date().toISOString()
  };
}

function parseEvent(input) {
  const event = typeof input === 'string' ? JSON.parse(input) : input;
  if (!event || event.version !== 1 || typeof event.eventId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(event.eventId)) {
    throw new Error('Mensagem de fila inválida: versão ou eventId.');
  }
  if (typeof event.text !== 'string' || !event.text.trim() || event.text.length > 5000 ||
      (event.sourceId !== null && (typeof event.sourceId !== 'string' || event.sourceId.length > 100))) {
    throw new Error('Mensagem de fila inválida: comentário.');
  }
  if (!SENTIMENTS.includes(event.sentiment) || ![...SENTIMENTS, 'mixed'].includes(event.originalSentiment)) {
    throw new Error('Mensagem de fila inválida: sentimento.');
  }
  validateScores(event.confidenceScores);
  if (event.sentiment !== normalizeSentiment({ sentiment: event.originalSentiment, confidenceScores: event.confidenceScores })) {
    throw new Error('Mensagem de fila inválida: classificação inconsistente.');
  }
  if (typeof event.collectedAt !== 'string' || !Number.isFinite(Date.parse(event.collectedAt))) {
    throw new Error('Mensagem de fila inválida: data.');
  }
  return event;
}

module.exports = { SENTIMENTS, parseComment, normalizeSentiment, makeEvent, parseEvent };
