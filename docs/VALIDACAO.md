# Validação da atividade

| Verificação | Resultado registrado |
| --- | --- |
| Origem dos comentários | O endpoint do professor respondeu HTTP 200 com um objeto contendo `id` e `comentario`. O cliente da aplicação também leu um comentário desse serviço. |
| Testes automatizados | 22 aprovados em Node.js 22. [Saída local](TESTES_LOCAIS.txt) e [execução no GitHub Actions](https://github.com/hqlcc/av-icl-02-azure/actions/runs/41923596632). Em 05/11/2026, os mesmos 22 testes passaram em Node.js 24. |
| Infraestrutura Azure | Grupo de recursos, Storage Account, fila `sentimentos`, Azure AI Language F0, servidor SQL, banco `sentimentos` e Function App criados. [Histórico de comandos](COMANDOS_EXECUTADOS.md). |
| Publicação | Os pacotes do instalador SQL e das funções foram gerados e passaram pela verificação de integridade ZIP. O registro disponível termina antes do envio dos pacotes. |
| Acesso ao SQL | A primeira inicialização pelo terminal terminou com `ESOCKET`. A regra temporária de firewall foi removida. O script de retomada usa um instalador executado dentro da Function App. |
| Teste público | Em 05/11/2026, a tentativa de acesso à rota expirou na conexão. A confirmação da tabela, dos três triggers e de totais crescentes depende de uma publicação e de um teste na assinatura Azure. |

O teste integrado pode ser executado após a publicação:

```bash
source .deploy/resources.env
npm run smoke -- "$TOTALS_URL"
```

Ele exige HTTP 200, as três categorias e aumento do total entre duas leituras. O arquivo `docs/evidencia-fluxo.json` guarda o resultado real quando o teste passa.
