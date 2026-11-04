const sql = require('mssql');
const { required } = require('./services');

function databaseConfig() {
  return {
    server: required('SQL_SERVER'), database: required('SQL_DATABASE'),
    user: required('SQL_USER'), password: required('SQL_PASSWORD'),
    options: { encrypt: true, trustServerCertificate: false },
    pool: { max: 3, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 15000, requestTimeout: 20000
  };
}

let poolPromise;
async function getPool() {
  if (!poolPromise) {
    const pool = new sql.ConnectionPool(databaseConfig());
    pool.on('error', () => { poolPromise = undefined; });
    poolPromise = pool.connect().catch(error => { poolPromise = undefined; throw error; });
  }
  return poolPromise;
}

async function insertEvent(event) {
  const pool = await getPool();
  const request = pool.request()
    .input('eventId', sql.UniqueIdentifier, event.eventId)
    .input('sourceId', sql.NVarChar(100), event.sourceId)
    .input('comment', sql.NVarChar(sql.MAX), event.text)
    .input('sentiment', sql.VarChar(8), event.sentiment)
    .input('originalSentiment', sql.VarChar(8), event.originalSentiment)
    .input('positive', sql.Decimal(6, 5), event.confidenceScores.positive)
    .input('neutral', sql.Decimal(6, 5), event.confidenceScores.neutral)
    .input('negative', sql.Decimal(6, 5), event.confidenceScores.negative)
    .input('collectedAt', sql.DateTime2, new Date(event.collectedAt));
  try {
    await request.query(`
      INSERT INTO dbo.Sentimentos
        (EventId, SourceId, Comentario, Sentimento, SentimentoOriginal,
         ScorePositive, ScoreNeutral, ScoreNegative, ColetadoEm)
      VALUES (@eventId, @sourceId, @comment, @sentiment, @originalSentiment,
              @positive, @neutral, @negative, @collectedAt);
    `);
    return true;
  } catch (error) {
    // Entrega da fila é "pelo menos uma vez". A PK torna a repetição idempotente.
    if (error.number === 2627 || error.number === 2601) return false;
    throw error; // O runtime deve reenfileirar; não engolir falhas de banco.
  }
}

async function getTotals() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      COALESCE(SUM(CASE WHEN Sentimento = 'positive' THEN CAST(1 AS BIGINT) ELSE 0 END), 0) AS positive,
      COALESCE(SUM(CASE WHEN Sentimento = 'neutral'  THEN CAST(1 AS BIGINT) ELSE 0 END), 0) AS neutral,
      COALESCE(SUM(CASE WHEN Sentimento = 'negative' THEN CAST(1 AS BIGINT) ELSE 0 END), 0) AS negative
    FROM dbo.Sentimentos;
  `);
  const row = result.recordset[0];
  return { positive: Number(row.positive), neutral: Number(row.neutral), negative: Number(row.negative) };
}

module.exports = { databaseConfig, insertEvent, getTotals };
