#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
source .deploy/resources.env
if [[ -f .deploy/secrets.env && -z "${SQL_ADMIN_PASSWORD:-}" ]]; then
  source .deploy/secrets.env
fi
: "${SQL_ADMIN_PASSWORD:?Informe a senha administrativa ou execute bash scripts/retomar.sh.}"
export SQL_ADMIN_PASSWORD
source scripts/registro.sh
logfile="$PWD/docs/COMANDOS_EXECUTADOS.md"
export SQL_ADMIN
run 'npm ci --ignore-scripts --no-fund --no-audit' npm ci --ignore-scripts --no-fund --no-audit
run 'npm test' npm test
run 'npm run package' npm run package
run 'python3 scripts/bootstrap.py build' python3 scripts/bootstrap.py build
BOOTSTRAP_HOST="$(run 'az functionapp show --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --query "defaultHostName || properties.defaultHostName" -o tsv' az functionapp show --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --query 'defaultHostName || properties.defaultHostName' -o tsv)"
export BOOTSTRAP_HOST
: "${BOOTSTRAP_HOST:?Hostname da Function App não retornado pela Azure.}"
run 'az functionapp deployment source config-zip --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --src .deploy/bootstrap.zip --build-remote false --output none' az functionapp deployment source config-zip --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --src .deploy/bootstrap.zip --build-remote false --output none
# A chave do host e a senha SQL passam somente em memória para o POST por TLS.
init_ok=false
if BOOTSTRAP_KEY="$(run 'az functionapp keys list --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --query masterKey -o tsv # valor mantido em memória' az functionapp keys list --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --query masterKey -o tsv)"; then
  export BOOTSTRAP_KEY
  if [[ -n "$BOOTSTRAP_KEY" ]] && run 'python3 scripts/bootstrap.py init' python3 scripts/bootstrap.py init; then init_ok=true; fi
fi
unset BOOTSTRAP_KEY SQL_ADMIN_PASSWORD SQL_APP_PASSWORD
run 'az functionapp deployment source config-zip --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --src .deploy/functionapp.zip --build-remote false' \
  az functionapp deployment source config-zip --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --src .deploy/functionapp.zip --build-remote false --output none
if [[ "$init_ok" != true ]]; then
  echo 'O pacote temporário foi substituído. Corrija a inicialização SQL antes de habilitar o timer.' >&2
  exit 1
fi
run 'az functionapp config appsettings set --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --settings AzureWebJobs.coletarComentario.Disabled=false --output none' \
  az functionapp config appsettings set --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" --settings AzureWebJobs.coletarComentario.Disabled=false --output none
export TOTALS_URL="https://$BOOTSTRAP_HOST/api/sentimentos/totais"
printf '\nTOTALS_URL=%q\n' "$TOTALS_URL" >> .deploy/resources.env
{
  printf '# Links para entrega\n\n- Repositório: %s\n' "${REPOSITORY_URL:-https://github.com/hqlcc/av-icl-02-azure}"
  printf -- '- Endpoint: %s\n\n' "$TOTALS_URL"
  printf 'Implantação realizada em: %s UTC.\n\n' "$(date -u +%FT%TZ)"
  printf 'Validação do fluxo: consultar docs/evidencia-fluxo.json após npm run smoke.\n'
} > docs/ENTREGA.md
echo "Implantação concluída. Aguarde o host iniciar e execute: npm run smoke -- $TOTALS_URL"
echo "A coleta está ATIVA a cada 10 s. Para pausar: bash scripts/timer.sh pause"
