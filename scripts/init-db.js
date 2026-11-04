const fs = require('node:fs');
const path = require('node:path');
const sql = require('mssql');
const { databaseConfig } = require('../src/lib/database');
const { required } = require('../src/lib/services');

async function main() {
  // SQL_USER/PASSWORD são de administrador somente neste processo de implantação.
  const pool = await new sql.ConnectionPool(databaseConfig()).connect();
  try {
    await pool.request().batch(fs.readFileSync(path.join(__dirname, '../sql/schema.sql'), 'utf8'));
    const username = required('SQL_APP_USER');
    const password = required('SQL_APP_PASSWORD');
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

main().catch(error => { console.error('Inicialização SQL falhou:', error.code || error.name); process.exitCode = 1; });
