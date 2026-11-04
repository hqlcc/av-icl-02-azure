const test = require('node:test');
const assert = require('node:assert/strict');
const sql = require('mssql');
const { makeEvent } = require('../src/lib/domain');

// Substitui somente o transporte SQL para verificar parâmetros, erros e reentrega.
const recorded = [];
let queryResult = { recordset: [{ positive: 0, neutral: 0, negative: 0 }] };
let queryError;
class FakePool {
  on() {}
  async connect() { return this; }
  request() {
    const inputs = {};
    return {
      input(name, _type, value) { inputs[name] = value; return this; },
      async query(statement) {
        recorded.push({ inputs, statement });
        if (queryError) throw queryError;
        return queryResult;
      }
    };
  }
}
sql.ConnectionPool = FakePool;
Object.assign(process.env, { SQL_SERVER: 'test.invalid', SQL_DATABASE: 'test', SQL_USER: 'test', SQL_PASSWORD: 'test-fixture-only' });
const { insertEvent, getTotals, databaseConfig } = require('../src/lib/database');
const event = () => makeEvent({ sourceId: '1', text: "'); DROP TABLE dbo.Sentimentos;--" }, {
  sentiment: 'negative', confidenceScores: { positive: 0.01, neutral: 0.01, negative: 0.98 }
});

test('SQL usa parâmetros para que um comentário não seja interpretado como comando', async () => {
  const value = event();
  assert.equal(await insertEvent(value), true);
  const last = recorded.at(-1);
  assert.equal(last.inputs.comment, value.text);
  assert.equal(last.inputs.eventId, value.eventId);
  assert.ok(!last.statement.includes(value.text));
});

test('reentrega com violação de chave é ignorada, mas falhas reais são propagadas', async () => {
  for (const number of [2627, 2601]) {
    queryError = Object.assign(new Error('duplicate'), { number });
    assert.equal(await insertEvent(event()), false);
  }
  queryError = Object.assign(new Error('connection lost'), { code: 'ESOCKET' });
  await assert.rejects(insertEvent(event()), /connection lost/);
  queryError = undefined;
});

test('totais SQL são retornados como números com somente três chaves', async () => {
  queryResult = { recordset: [{ positive: '13', neutral: '4', negative: '2' }] };
  assert.deepEqual(await getTotals(), { positive: 13, neutral: 4, negative: 2 });
});

test('conexão exige TLS e valida o certificado do SQL', () => {
  assert.deepEqual(databaseConfig().options, { encrypt: true, trustServerCertificate: false });
});
