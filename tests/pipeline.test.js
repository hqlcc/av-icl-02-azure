const test = require('node:test');
const assert = require('node:assert/strict');
const { parseComment, normalizeSentiment, makeEvent, parseEvent } = require('../src/lib/domain');
const { createTimerHandler, createQueueHandler, createHttpHandler } = require('../src/lib/handlers');
const { validateTotals } = require('../scripts/smoke');

const scores = { positive: 0.95, neutral: 0.04, negative: 0.01 };
const positive = { sentiment: 'positive', confidenceScores: scores };
const example = () => makeEvent({ sourceId: '21', text: 'A compra foi simples e não tive nenhum problema.' }, positive);
const context = () => ({ log() {}, warn() {}, error() {}, extraOutputs: { set() {} } });

test('interpreta o contrato real do endpoint e preserva o ID', () => {
  assert.deepEqual(parseComment({ id: 21, comentario: ' Ótimo! ' }), { sourceId: '21', text: 'Ótimo!' });
});

test('rejeita corpo inesperado, comentário vazio e texto excessivo', () => {
  for (const payload of [null, [], { comentario: ' ' }, { comentario: 3 }, { text: 'x' }, { comentario: 'x'.repeat(5001) }]) {
    assert.throws(() => parseComment(payload));
  }
});

test('preserva os três sentimentos aceitos no enunciado', () => {
  for (const sentiment of ['positive', 'neutral', 'negative']) {
    assert.equal(normalizeSentiment({ sentiment, confidenceScores: scores }), sentiment);
  }
});

test('mixed usa o maior score e empate vira neutral', () => {
  assert.equal(normalizeSentiment({ sentiment: 'mixed', confidenceScores: scores }), 'positive');
  assert.equal(normalizeSentiment({ sentiment: 'mixed', confidenceScores: { positive: 0.2, neutral: 0.1, negative: 0.7 } }), 'negative');
  assert.equal(normalizeSentiment({ sentiment: 'mixed', confidenceScores: { positive: 0.1, neutral: 0.8, negative: 0.1 } }), 'neutral');
  assert.equal(normalizeSentiment({ sentiment: 'mixed', confidenceScores: { positive: 0.5, neutral: 0, negative: 0.5 } }), 'neutral');
});

test('não inventa uma classificação quando a resposta da IA é inválida', () => {
  assert.throws(() => normalizeSentiment({ sentiment: 'unknown', confidenceScores: scores }));
  assert.throws(() => normalizeSentiment({ sentiment: 'positive', confidenceScores: {} }));
  assert.throws(() => normalizeSentiment({ sentiment: 'neutral', confidenceScores: { ...scores, neutral: NaN } }));
});

test('cada coleta ganha UUID próprio, mesmo com ID de origem repetido', () => {
  assert.notEqual(example().eventId, example().eventId);
});

test('fila aceita objeto e string JSON, preservando o mesmo eventId', () => {
  const event = example();
  assert.deepEqual(parseEvent(event), event);
  assert.deepEqual(parseEvent(JSON.stringify(event)), event);
});

test('fila rejeita JSON corrompido, data, versão, sentimento e scores inválidos', () => {
  const event = example();
  for (const value of ['not json', { ...event, eventId: 'x' }, { ...event, version: 2 }, { ...event, collectedAt: 'ontem' },
    { ...event, sentiment: 'mixed' }, { ...event, originalSentiment: 'negative' },
    { ...event, confidenceScores: { ...scores, positive: -1 } }]) {
    assert.throws(() => parseEvent(value));
  }
});

test('timer consulta, analisa o texto e publica o resultado no binding', async () => {
  const calls = [];
  const queueOutput = Symbol('queue');
  const handler = createTimerHandler({
    fetchComment: async () => { calls.push('fetch'); return { sourceId: '21', text: 'Excelente compra.' }; },
    analyzeSentiment: async text => { calls.push(text); return positive; },
    queueOutput
  });
  const ctx = context();
  let message;
  ctx.extraOutputs.set = (binding, value) => { assert.equal(binding, queueOutput); message = parseEvent(value); };
  await handler({ isPastDue: false }, ctx);
  assert.deepEqual(calls, ['fetch', 'Excelente compra.']);
  assert.equal(message.sentiment, 'positive');
  assert.equal(message.sourceId, '21');
});

test('falha da fonte não gera mensagem nem chamada à IA', async () => {
  let analyzed = false, published = false;
  const handler = createTimerHandler({ fetchComment: async () => { throw new Error('HTTP 503'); },
    analyzeSentiment: async () => { analyzed = true; }, queueOutput: {} });
  const ctx = context();
  ctx.extraOutputs.set = () => { published = true; };
  await assert.rejects(handler({}, ctx), /503/);
  assert.equal(analyzed, false);
  assert.equal(published, false);
});

test('falha da IA não gera uma classificação artificial', async () => {
  let published = false;
  const handler = createTimerHandler({ fetchComment: async () => ({ sourceId: '1', text: 'Bom' }),
    analyzeSentiment: async () => { throw new Error('Quota'); }, queueOutput: {} });
  const ctx = context(); ctx.extraOutputs.set = () => { published = true; };
  await assert.rejects(handler({}, ctx), /Quota/);
  assert.equal(published, false);
});

test('consumidor entrega o evento completo ao banco', async () => {
  let stored;
  const event = example();
  await createQueueHandler({ insertEvent: async value => { stored = value; return true; } })(JSON.stringify(event), context());
  assert.deepEqual(stored, event);
});

test('falha SQL propaga ao runtime para permitir nova tentativa', async () => {
  const handler = createQueueHandler({ insertEvent: async () => { throw new Error('SQL offline'); } });
  await assert.rejects(handler(example(), context()), /SQL offline/);
});

test('mensagem malformada não chega ao banco', async () => {
  let called = false;
  const handler = createQueueHandler({ insertEvent: async () => { called = true; } });
  await assert.rejects(handler('{}', context()));
  assert.equal(called, false);
});

test('HTTP retorna exatamente as três chaves e os números consultados', async () => {
  const totals = { positive: 0, neutral: 0, negative: 1 };
  const response = await createHttpHandler({ getTotals: async () => totals })({}, context());
  assert.equal(response.status, 200);
  assert.deepEqual(response.jsonBody, totals);
  assert.equal(response.headers['Cache-Control'], 'no-store');
});

test('banco vazio retorna contagens zero', async () => {
  const response = await createHttpHandler({ getTotals: async () => ({ positive: 0, neutral: 0, negative: 0 }) })({}, context());
  assert.deepEqual(response.jsonBody, { positive: 0, neutral: 0, negative: 0 });
});

test('HTTP devolve 503 sem expor credenciais e sem simular contagens', async () => {
  const response = await createHttpHandler({ getTotals: async () => { throw new Error('SQL_PASSWORD=segredo'); } })({}, context());
  assert.equal(response.status, 503);
  assert.doesNotMatch(JSON.stringify(response), /segredo/);
  assert.equal(response.jsonBody.positive, undefined);
});

test('smoke rejeita resposta com chaves extras, números negativos ou strings', () => {
  assert.equal(validateTotals({ positive: 2, neutral: 1, negative: 4 }), 7);
  for (const value of [{ positive: '1', neutral: 0, negative: 0 }, { positive: -1, neutral: 0, negative: 0 },
    { positive: 1, neutral: 0, negative: 0, total: 1 }]) assert.throws(() => validateTotals(value));
});
