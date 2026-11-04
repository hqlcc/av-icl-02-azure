# Demonstração e explicação da solução

## Roteiro de aproximadamente três minutos

1. Abra o repositório e mostre a tabela de requisitos do README.
2. Na Function App, mostre as três funções e o cron de seis campos `*/10 * * * * *`.
3. Explique que o timer busca um comentário, usa o Azure AI Language e envia a análise para a fila.
4. Mostre a fila `sentimentos`. Ela pode estar vazia porque a consumidora processa mensagens rapidamente; use os logs para mostrar os eventos processados.
5. Mostre a tabela e execute as consultas abaixo no editor SQL.
6. Abra o endpoint público. Compare os valores com a consulta SQL e atualize depois de algumas coletas.
7. Mostre `docs/COMANDOS_EXECUTADOS.md` e a evidência JSON produzida pelo teste real.

## Consultas de conferência

```sql
SELECT Sentimento, COUNT_BIG(*) AS Total
FROM dbo.Sentimentos
GROUP BY Sentimento;

SELECT TOP (10) EventId, SourceId, Comentario, Sentimento,
       SentimentoOriginal, ColetadoEm, RegistradoEm
FROM dbo.Sentimentos
ORDER BY RegistradoEm DESC;

SELECT COUNT_BIG(*) AS TotalRegistros FROM dbo.Sentimentos;
```

## Perguntas que vale saber responder

**Por que usar uma fila?** Ela separa a coleta/análise da gravação. Se o banco estiver temporariamente indisponível, a mensagem pode ser processada de novo sem perder o resultado já enfileirado.

**O que aciona cada função?** O timer usa agendamento; a consumidora é acionada pela fila; a consulta é acionada por uma requisição HTTP GET.

**O resultado HTTP é calculado onde?** No SQL, somando os registros de cada categoria. Não é um contador em memória nem um número fixo.

**E se uma mensagem for entregue duas vezes?** O UUID da coleta é chave primária. A violação de duplicidade é reconhecida e não incrementa o total novamente.

**E se o mesmo comentário aparecer em uma coleta futura?** Essa é uma nova coleta e recebe outro UUID. O endpoint do professor é aleatório; não foi pedido contar apenas textos únicos.

**Por que armazenar o sentimento original?** A API também pode devolver `mixed`. Preservar esse rótulo e os scores permite conferir a regra usada para adequar o resultado às três classes da prova.

**Por que o JSON usa aspas nas chaves?** Objetos JavaScript podem omiti-las em código, mas JSON válido exige aspas. Os campos continuam sendo `positive`, `neutral` e `negative`.

**Por que Node.js?** As três funções usam o mesmo runtime; o SDK oficial acessa o Cognitive Service e o cliente `mssql` conecta ao SQL Server sem instalação de driver ODBC nativo.
