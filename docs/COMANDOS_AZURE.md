# Comandos de criação e configuração na Azure

Esta lista acompanha `scripts/provision.sh` e descreve os comandos **preparados** para execução. Não comprova que os recursos já foram criados. Consulte o [registro da execução autenticada](COMANDOS_EXECUTADOS.md) para os resultados; os passos de retomada constam em `scripts/retomar.sh`.

As variáveis de nomes ficam em `.deploy/resources.env`. Credenciais não devem ser publicadas. O código integral e executável está em `scripts/provision.sh`.

## Preparação da sessão

```bash
az login
az account list --query "[].{nome:name,id:id,padrao:isDefault}" -o table
export AZURE_SUBSCRIPTION_ID="ID-DA-ASSINATURA"
bash scripts/provision.sh
```

## scripts/provision.sh

```bash
az account set --subscription "$AZURE_SUBSCRIPTION_ID"
```

```bash
az account show --query "{name:name,id:id}" -o json
```

```bash
az functionapp list-flexconsumption-locations -o table
```

```bash
for provider in Microsoft.Web Microsoft.Storage Microsoft.Sql Microsoft.CognitiveServices Microsoft.Insights Microsoft.OperationalInsights; do
  az provider register --namespace "$provider" --wait --only-show-errors
done
```

```bash
az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
```

```bash
az storage account create --name "$STORAGE_NAME" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --sku Standard_LRS --kind StorageV2 --allow-blob-public-access false --min-tls-version TLS1_2
```

```bash
az storage account show-connection-string --name "$STORAGE_NAME" --resource-group "$RESOURCE_GROUP" --query connectionString -o tsv # valor mantido em memória
```

```bash
az storage queue create --name sentimentos # conexão via AZURE_STORAGE_CONNECTION_STRING
```

```bash
az cognitiveservices account create --name "$LANGUAGE_NAME" --resource-group "$RESOURCE_GROUP" --location "$LANGUAGE_LOCATION" --kind TextAnalytics --sku F0 --custom-domain "$LANGUAGE_NAME" --yes
```

```bash
az cognitiveservices account show --name "$LANGUAGE_NAME" --resource-group "$RESOURCE_GROUP" --query properties.endpoint -o tsv
```

```bash
az cognitiveservices account keys list --name "$LANGUAGE_NAME" --resource-group "$RESOURCE_GROUP" --query key1 -o tsv # valor mantido em memória
```

```bash
az sql server create --name "$SQL_SERVER_NAME" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --admin-user "$SQL_ADMIN" --admin-password "$SQL_ADMIN_PASSWORD" --minimal-tls-version 1.2
```

```bash
az sql db create --name "$SQL_DATABASE" --server "$SQL_SERVER_NAME" --resource-group "$RESOURCE_GROUP" --service-objective Basic --backup-storage-redundancy Local
```

```bash
az sql server firewall-rule create --name AllowAzureServices --server "$SQL_SERVER_NAME" --resource-group "$RESOURCE_GROUP" --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0
```

```bash
az functionapp create --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --storage-account "$STORAGE_NAME" --flexconsumption-location "$LOCATION" --runtime node --runtime-version 22 --functions-version 4 --instance-memory 512 --maximum-instance-count 1
```

```bash
az functionapp config appsettings set --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --settings @ARQUIVO_TEMPORARIO_SEGURO --output none # contém as configurações; timer inicialmente desabilitado
```

## scripts/publicar.sh

```bash
npm ci --ignore-scripts --no-fund --no-audit
```

```bash
npm test
```

```bash
npm run package
```

```bash
python3 scripts/bootstrap.py build
```

```bash
az functionapp show --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --query "defaultHostName || properties.defaultHostName" -o tsv
```

```bash
az functionapp deployment source config-zip --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --src .deploy/bootstrap.zip --build-remote false --output none
```

```bash
az functionapp keys list --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --query masterKey -o tsv # valor mantido em memória
```

```bash
python3 scripts/bootstrap.py init
```

```bash
az functionapp deployment source config-zip --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --src .deploy/functionapp.zip --build-remote false
```

```bash
az functionapp config appsettings set --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --settings AzureWebJobs.coletarComentario.Disabled=false --output none
```

```bash
az functionapp show --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --query "defaultHostName || properties.defaultHostName" -o tsv
```
