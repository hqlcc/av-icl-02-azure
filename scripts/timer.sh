#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source .deploy/resources.env
case "${1:-}" in
  pause) disabled=true ;;
  resume) disabled=false ;;
  *) echo 'Uso: bash scripts/timer.sh pause|resume' >&2; exit 1 ;;
esac
mkdir -p docs
printf '\n## Timer: %s (%s)\n\n```bash\naz functionapp config appsettings set --name "%s" --resource-group "%s" --settings AzureWebJobs.coletarComentario.Disabled=%s --output none\n```\n' \
  "$1" "$(date -u +%FT%TZ)" "$FUNCTION_APP" "$RESOURCE_GROUP" "$disabled" >> docs/COMANDOS_EXECUTADOS.md
az functionapp config appsettings set --name "$FUNCTION_APP" --resource-group "$RESOURCE_GROUP" \
  --settings "AzureWebJobs.coletarComentario.Disabled=$disabled" --output none
echo "Timer: $1. O endpoint HTTP continua disponível."
