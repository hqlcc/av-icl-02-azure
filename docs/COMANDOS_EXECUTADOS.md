# Comandos efetivamente executados

Gerado durante a implantação. Segredos são substituídos por variáveis.

## Preparação da assinatura

A sessão foi autenticada com `az login --use-device-code --output none`. A política da assinatura permitiu Canada Central. Os serviços abaixo começaram a ser habilitados enquanto a primeira habilitação estava em andamento.

2026-11-04T22:15:59+00:00

```bash
az provider register --namespace Microsoft.Storage --only-show-errors --output none
```

Exit code: `0`.

2026-11-04T22:16:09+00:00

```bash
az provider register --namespace Microsoft.Sql --only-show-errors --output none
```

Exit code: `0`.

2026-11-04T22:16:20+00:00

```bash
az provider register --namespace Microsoft.CognitiveServices --only-show-errors --output none
```

Exit code: `0`.

2026-11-04T22:16:27+00:00

```bash
az provider register --namespace Microsoft.Insights --only-show-errors --output none
```

Exit code: `0`.

2026-11-04T22:16:33+00:00

```bash
az provider register --namespace Microsoft.OperationalInsights --only-show-errors --output none
```

Exit code: `0`.

## Execução de 2026-11-04T22:14:08Z


```bash
az account set --subscription "$AZURE_SUBSCRIPTION_ID"
```

Exit code: `0`.

```bash
az account show --query "{name:name,id:id}" -o json
```

Exit code: `0`.

```bash
az functionapp list-flexconsumption-locations -o table
```

Exit code: `0`.

```bash
az provider register --namespace Microsoft.Web --wait --only-show-errors
```

Exit code: `0`.

```bash
az provider register --namespace Microsoft.Storage --wait --only-show-errors
```

Exit code: `0`.

```bash
az provider register --namespace Microsoft.Sql --wait --only-show-errors
```

Exit code: `0`.

```bash
az provider register --namespace Microsoft.CognitiveServices --wait --only-show-errors
```

Exit code: `0`.

```bash
az provider register --namespace Microsoft.Insights --wait --only-show-errors
```

Exit code: `0`.

```bash
az provider register --namespace Microsoft.OperationalInsights --wait --only-show-errors
```

Exit code: `0`.

```bash
az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
```

Exit code: `0`.

```bash
az storage account create --name "$STORAGE_NAME" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --sku Standard_LRS --kind StorageV2 --allow-blob-public-access false --min-tls-version TLS1_2
```

Exit code: `0`.

```bash
az storage account show-connection-string --name "$STORAGE_NAME" --resource-group "$RESOURCE_GROUP" --query connectionString -o tsv # valor mantido em memória
```

Exit code: `0`.

```bash
az storage queue create --name sentimentos # conexão via AZURE_STORAGE_CONNECTION_STRING
```

Exit code: `0`.

```bash
az cognitiveservices account create --name "$LANGUAGE_NAME" --resource-group "$RESOURCE_GROUP" --location "$LANGUAGE_LOCATION" --kind TextAnalytics --sku F0 --custom-domain "$LANGUAGE_NAME" --yes
```

Exit code: `0`.

```bash
az cognitiveservices account show --name "$LANGUAGE_NAME" --resource-group "$RESOURCE_GROUP" --query properties.endpoint -o tsv
```

Exit code: `0`.

```bash
az cognitiveservices account keys list --name "$LANGUAGE_NAME" --resource-group "$RESOURCE_GROUP" --query key1 -o tsv # valor mantido em memória
```

Exit code: `0`.

```bash
az sql server create --name "$SQL_SERVER_NAME" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --admin-user "$SQL_ADMIN" --admin-password "$SQL_ADMIN_PASSWORD" --minimal-tls-version 1.2
```

Exit code: `0`.

```bash
az sql db create --name "$SQL_DATABASE" --server "$SQL_SERVER_NAME" --resource-group "$RESOURCE_GROUP" --service-objective Basic --backup-storage-redundancy Local
```

Exit code: `0`.

```bash
az sql server firewall-rule create --name AllowAzureServices --server "$SQL_SERVER_NAME" --resource-group "$RESOURCE_GROUP" --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0
```

Exit code: `0`.

```bash
az functionapp create --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --storage-account "$STORAGE_NAME" --flexconsumption-location "$LOCATION" --runtime node --runtime-version 22 --functions-version 4 --instance-memory 512 --maximum-instance-count 1
```

Exit code: `0`.

```bash
az functionapp config appsettings set --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --settings @ARQUIVO_TEMPORARIO_SEGURO --output none # contém as configurações; timer inicialmente desabilitado
```

Exit code: `0`.

```bash
python3 scripts/client-ip.py
```

Exit code: `0`.

```bash
az sql server firewall-rule create --name DeployClient --server "$SQL_SERVER_NAME" --resource-group "$RESOURCE_GROUP" --start-ip-address "$DEPLOY_CLIENT_IP" --end-ip-address "$DEPLOY_CLIENT_IP"
```

Exit code: `0`.

```bash
npm ci --ignore-scripts
```

Exit code: `0`.

```bash
npm test
```

Exit code: `0`.

```bash
npm run db:init # credenciais administrativas somente no ambiente deste processo
```

Exit code: `1`.

```bash
az sql server firewall-rule delete --name DeployClient --server "$SQL_SERVER_NAME" --resource-group "$RESOURCE_GROUP"
```

Exit code: `0`.

```bash
npm ci --ignore-scripts --no-fund --no-audit
```

Exit code: `0`.

```bash
npm test
```

Exit code: `0`.

```bash
npm run package
```

Exit code: `0`.

```bash
python3 scripts/bootstrap.py build
```

Exit code: `0`.

```bash
az functionapp show --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --query properties.defaultHostName -o tsv
```

O registro termina no comando acima, sem código de saída. A primeira tentativa de inicializar a tabela por conexão SQL direta retornou `ESOCKET`. A próxima etapa é publicar o instalador e as funções usando os recursos existentes.
