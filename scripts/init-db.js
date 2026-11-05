const fs = require('node:fs');
const path = require('node:path');
const sql = require('mssql');
const { databaseConfig } = require('../src/lib/database');
const { required } = require('../src/lib/services');

async function initializeDatabase(config, username, password) {
  const pool = await new sql.ConnectionPool(config).connect();
  try {
    await pool.request().batch(fs.readFileSync(path.join(__dirname, '../sql/schema.sql'), 'utf8'));
    if (!/^[a-zA-Z][a-zA-Z0-9_]{2,63}$/.test(username)) throw new Error('Nome de usuário SQL inválido.');
    // CREATE USER não aceita parâmetro diretamente; QUOTENAME protege o SQL dinâmico.
    await pool.request()
      .input('username', sql.NVarChar(128), username)
      .input('password', sql.NVarChar(128), password)
      .query(`
        DECLARE @statement NVARCHAR(MAX);
        IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = @username)
          SET @statement = N'CREATE USER ' + QUOTENAME(@username) + N' WITH PASSWORD = ' + QUOTENAME(@password, '''') + N';';
        ELSE
          SET @statement = N'ALTER USER ' + QUOTENAME(@username) + N' WITH PASSWORD = ' + QUOTENAME(@password, '''') + N';';
        EXEC sp_executesql @statement;
        SET @statement = N'GRANT SELECT, INSERT ON OBJECT::dbo.Sentimentos TO ' + QUOTENAME(@username) + N';';
        EXEC sp_executesql @statement;
      `);
    console.log('Tabela criada/verificada. Usuário da aplicação com SELECT e INSERT.');
  } finally { await pool.close(); }
}

if (require.main === module) {
  initializeDatabase(databaseConfig(), required('SQL_APP_USER'), required('SQL_APP_PASSWORD'))
    .catch(error => { console.error('Inicialização SQL falhou:', error.code || error.name, error.number || ''); process.exitCode = 1; });
}
module.exports = { initializeDatabase };
