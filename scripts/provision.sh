#!/usr/bin/env bash
# Executar no Bash (Azure Cloud Shell, Linux ou WSL), a partir de qualquer pasta.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
for tool in az node npm python3 zip; do
  command -v "$tool" >/dev/null || { echo "Pré-requisito ausente: $tool" >&2; exit 1; }
done
: "${AZURE_SUBSCRIPTION_ID:?Defina AZURE_SUBSCRIPTION_ID antes de executar.}"
mkdir -p .deploy docs
if [[ ! -f .deploy/resources.env ]]; then
  suffix="$(python3 -c 'import secrets; print(secrets.token_hex(4))')"
  {
    printf 'RESOURCE_GROUP=%q\n' "${RESOURCE_GROUP:-rg-avicl02-$suffix}"
    printf 'LOCATION=%q\n' "${LOCATION:-eastus2}"
    printf 'LANGUAGE_LOCATION=%q\n' "${LANGUAGE_LOCATION:-eastus}"
    printf 'STORAGE_NAME=%q\n' "sticl02$suffix"
    printf 'FUNCTION_APP=%q\n' "func-icl02-$suffix"
    printf 'LANGUAGE_NAME=%q\n' "lang-icl02-$suffix"
    printf 'SQL_SERVER_NAME=%q\n' "sql-icl02-$suffix"
    printf 'SQL_DATABASE=%q\n' sentimentos
    printf 'SQL_ADMIN=%q\n' icladmin
    printf 'SQL_APP_USER=%q\n' sentimentos_app
  } > .deploy/resources.env
fi
source .deploy/resources.env
if [[ ! -f .deploy/secrets.env ]]; then
  python3 - <<'PY' > .deploy/secrets.env
import secrets, shlex
for name in ['SQL_ADMIN_PASSWORD', 'SQL_APP_PASSWORD']:
    print('export ' + name + '=' + shlex.quote('Aa1!' + secrets.token_urlsafe(30)))
PY
fi
source .deploy/secrets.env
logfile="$PWD/docs/COMANDOS_EXECUTADOS.md"
if [[ ! -f "$logfile" ]]; then
  printf '# Comandos efetivamente executados\n\nGerado durante a implantação. Segredos são substituídos por variáveis.\n' > "$logfile"
fi
printf '\n## Execução de %s\n\n' "$(date -u +%FT%TZ)" >> "$logfile"

# Registra cada comando antes da execução e o exit code depois. A descrição é
# deliberadamente independente dos argumentos para nunca registrar segredos.
source scripts/registro.sh

run 'az account set --subscription "$AZURE_SUBSCRIPTION_ID"' az account set --subscription "$AZURE_SUBSCRIPTION_ID"
run 'az account show --query "{name:name,id:id}" -o json' az account show --query '{name:name,id:id}' -o json
run 'az functionapp list-flexconsumption-locations -o table' az functionapp list-flexconsumption-locations -o table
for provider in Microsoft.Web Microsoft.Storage Microsoft.Sql Microsoft.CognitiveServices Microsoft.Insights Microsoft.OperationalInsights; do
  run "az provider register --namespace $provider --wait --only-show-errors" az provider register --namespace "$provider" --wait --only-show-errors
done
run 'az group create --name "$RESOURCE_GROUP" --location "$LOCATION"' \
  az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --tags projeto=AV-ICL-02 --output none
run 'az storage account create --name "$STORAGE_NAME" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --sku Standard_LRS --kind StorageV2 --allow-blob-public-access false --min-tls-version TLS1_2' \
  az storage account create --name "$STORAGE_NAME" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --sku Standard_LRS --kind StorageV2 --allow-blob-public-access false --min-tls-version TLS1_2 --output none
STORAGE_CONNECTION="$(run 'az storage account show-connection-string --name "$STORAGE_NAME" --resource-group "$RESOURCE_GROUP" --query connectionString -o tsv # valor mantido em memória' \
  az storage account show-connection-string --name "$STORAGE_NAME" --resource-group "$RESOURCE_GROUP" --query connectionString -o tsv)"
export AZURE_STORAGE_CONNECTION_STRING="$STORAGE_CONNECTION"
run 'az storage queue create --name sentimentos # conexão via AZURE_STORAGE_CONNECTION_STRING' az storage queue create --name sentimentos --output none

# Sem fallback silencioso para S: se F0 não estiver disponível, revisar a conta.
run 'az cognitiveservices account create --name "$LANGUAGE_NAME" --resource-group "$RESOURCE_GROUP" --location "$LANGUAGE_LOCATION" --kind TextAnalytics --sku F0 --custom-domain "$LANGUAGE_NAME" --yes' \
  az cognitiveservices account create --name "$LANGUAGE_NAME" --resource-group "$RESOURCE_GROUP" --location "$LANGUAGE_LOCATION" --kind TextAnalytics --sku F0 --custom-domain "$LANGUAGE_NAME" --yes --output none
LANGUAGE_ENDPOINT="$(run 'az cognitiveservices account show --name "$LANGUAGE_NAME" --resource-group "$RESOURCE_GROUP" --query properties.endpoint -o tsv' \
  az cognitiveservices account show --name "$LANGUAGE_NAME" --resource-group "$RESOURCE_GROUP" --query properties.endpoint -o tsv)"
LANGUAGE_KEY="$(run 'az cognitiveservices account keys list --name "$LANGUAGE_NAME" --resource-group "$RESOURCE_GROUP" --query key1 -o tsv # valor mantido em memória' \
  az cognitiveservices account keys list --name "$LANGUAGE_NAME" --resource-group "$RESOURCE_GROUP" --query key1 -o tsv)"

run 'az sql server create --name "$SQL_SERVER_NAME" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --admin-user "$SQL_ADMIN" --admin-password "$SQL_ADMIN_PASSWORD" --minimal-tls-version 1.2' \
  az sql server create --name "$SQL_SERVER_NAME" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --admin-user "$SQL_ADMIN" --admin-password "$SQL_ADMIN_PASSWORD" --minimal-tls-version 1.2 --output none
run 'az sql db create --name "$SQL_DATABASE" --server "$SQL_SERVER_NAME" --resource-group "$RESOURCE_GROUP" --service-objective Basic --backup-storage-redundancy Local' \
  az sql db create --name "$SQL_DATABASE" --server "$SQL_SERVER_NAME" --resource-group "$RESOURCE_GROUP" --service-objective Basic --backup-storage-redundancy Local --output none
run 'az sql server firewall-rule create --name AllowAzureServices --server "$SQL_SERVER_NAME" --resource-group "$RESOURCE_GROUP" --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0' \
  az sql server firewall-rule create --name AllowAzureServices --server "$SQL_SERVER_NAME" --resource-group "$RESOURCE_GROUP" --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 --output none

run 'az functionapp create --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --storage-account "$STORAGE_NAME" --flexconsumption-location "$LOCATION" --runtime node --runtime-version 22 --functions-version 4 --instance-memory 512 --maximum-instance-count 1' \
  az functionapp create --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --storage-account "$STORAGE_NAME" --flexconsumption-location "$LOCATION" --runtime node --runtime-version 22 --functions-version 4 --instance-memory 512 --maximum-instance-count 1 --output none

export LANGUAGE_ENDPOINT LANGUAGE_KEY SQL_DATABASE SQL_APP_USER SQL_APP_PASSWORD
export SQL_SERVER="$SQL_SERVER_NAME.database.windows.net"
settings_file="$(mktemp)"
python3 - <<'PY' > "$settings_file"
import json, os
settings = {key: os.environ[key] for key in ['LANGUAGE_ENDPOINT', 'LANGUAGE_KEY', 'SQL_SERVER', 'SQL_DATABASE']}
settings.update(SQL_USER=os.environ['SQL_APP_USER'], SQL_PASSWORD=os.environ['SQL_APP_PASSWORD'],
    COMMENTS_URL='https://backend-n75y.onrender.com/comentarios')
settings['AzureWebJobs.coletarComentario.Disabled'] = 'true'
json.dump(settings, __import__('sys').stdout)
PY
trap 'rm -f "$settings_file"' EXIT
run 'az functionapp config appsettings set --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --settings @ARQUIVO_TEMPORARIO_SEGURO --output none # contém as configurações; timer inicialmente desabilitado' \
  az functionapp config appsettings set --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --settings "@$settings_file" --output none
rm -f "$settings_file"

bash scripts/publicar.sh
