const assert = require('node:assert/strict');
const fs = require('node:fs');
const { setTimeout: delay } = require('node:timers/promises');

function validateTotals(value) {
  assert.deepEqual(Object.keys(value).sort(), ['negative', 'neutral', 'positive']);
  for (const count of Object.values(value)) assert.ok(Number.isSafeInteger(count) && count >= 0);
  return value.positive + value.neutral + value.negative;
}

async function main() {
  const url = process.argv[2] || process.env.TOTALS_URL;
  if (!url) throw new Error('Uso: npm run smoke -- https://HOST/api/sentimentos/totais');
  const read = async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000), cache: 'no-store' });
    assert.equal(response.status, 200, `HTTP inesperado: ${response.status}`);
    assert.match(response.headers.get('content-type') || '', /application\/json/);
    const data = await response.json();
    validateTotals(data);
    return data;
  };
  // A troca do pacote e a ativação do timer reiniciam o host na Azure.
  const deadline = Date.now() + 180000;
  let before;
  for (;;) {
    try {
      before = await read();
      break;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      console.log('Aguardando a primeira resposta válida da função:', error.message);
      await delay(10000);
    }
  }
  const started = Date.now();
  console.log('Totais iniciais:', before);
  for (let attempt = 1; attempt <= 12; attempt++) {
    await delay(10000);
    const after = await read();
    for (const key of Object.keys(before)) assert.ok(after[key] >= before[key], 'Contagem diminuiu.');
    if (validateTotals(after) > validateTotals(before)) {
      const evidence = { checkedAt: new Date().toISOString(), url, before, after, elapsedSeconds: Math.round((Date.now() - started) / 1000), result: 'PASS' };
      fs.mkdirSync('docs', { recursive: true });
      fs.writeFileSync('docs/evidencia-fluxo.json', JSON.stringify(evidence, null, 2) + '\n');
      console.log('PASS: endpoint válido e novos registros no banco.', after);
      return;
    }
    console.log(`Aguardando coleta/gravação (${attempt}/12)...`);
  }
  throw new Error('Os totais não cresceram em 120 s. Verifique timer, Language, fila e SQL.');
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { validateTotals };
