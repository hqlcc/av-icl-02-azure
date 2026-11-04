# Problemas comuns

| Sintoma | Verificar |
| --- | --- |
| Deploy impedido por política, região ou quota | Assinatura selecionada, regiões permitidas e cotas de Flex Consumption/SQL. Não trocar automaticamente de assinatura. |
| F0 indisponível | Pode já existir um recurso gratuito na assinatura. Conferir os recursos existentes; não mudar para S sem avaliar custo. |
| Fonte de comentários demora | O Render pode ter cold start. O código aguarda até 60 s; o primeiro ciclo pode atrasar. |
| Language retorna 401/403 | Endpoint e chave devem pertencer ao mesmo recurso. Conferir as Application Settings sem copiá-las para o README. |
| Language retorna 429 | Limite de requisições ou cota. A coleta a cada 10 s usa 360 chamadas/hora; pausar fora da demonstração. |
| Nenhuma função aparece | `host.json` na raiz do ZIP, dependências presentes, `main` em `package.json`, Node.js 22 e runtime v4. Consultar logs de inicialização. |
| Timer não executa | `AzureWebJobs.coletarComentario.Disabled` deve ser `false`; verificar Storage e logs do host. |
| SQL: login failed | Credenciais do usuário contido devem usar o banco `sentimentos`, não `master`. Verificar inicialização da tabela/usuário. |
| SQL: IP não permitido | Conferir firewall. Para inicialização local, `DEPLOY_CLIENT_IP` deve ser o IPv4 de saída real. Regras podem levar alguns minutos para propagar. |
| Erro 503 no endpoint | A HTTP Function está acessível, mas não consultou SQL. Verificar tabela, conexão, credenciais e firewall. |
| Totais não crescem | Verificar timer, cota Language, fila `sentimentos` e `sentimentos-poison`. Depois de corrigir a causa, reprocessar mensagens problemáticas preservando `eventId`. |
| Valores só aparecem após alguns segundos | Fila e persistência são assíncronas. O HTTP mostra apenas registros já confirmados no SQL. |

Use Application Insights para acompanhar a mesma coleta pelo `eventId`. O código não registra o texto do comentário nem as chaves. O endpoint público de totais não expõe detalhes das falhas.

## Comandos de inspeção

```bash
source .deploy/resources.env
az functionapp function list --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" -o table
az resource list --resource-group "$RESOURCE_GROUP" --query "[].{name:name,type:type}" -o table
az sql db show --name "$SQL_DATABASE" --server "$SQL_SERVER_NAME" --resource-group "$RESOURCE_GROUP" --query status -o tsv
curl -i "$TOTALS_URL"
```

Evite imprimir todas as Application Settings: elas contêm credenciais. Nunca anexar `.deploy/secrets.env`, `local.settings.json`, arquivos `.env` ou um dump de configurações ao repositório.
