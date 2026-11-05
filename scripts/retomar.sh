#!/usr/bin/env bash
# Retoma exclusivamente a implantação da prova na assinatura selecionada.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
for tool in az node npm python3 zip; do
  command -v "$tool" >/dev/null || { echo "Instale a ferramenta: $tool" >&2; exit 1; }
done
mkdir -p .deploy docs
source scripts/registro.sh
logfile="$PWD/docs/COMANDOS_EXECUTADOS.md"
source scripts/recursos-existentes.conf
if [[ -f .deploy/resources.env ]]; then
  ( source .deploy/resources.env; [[ "$RESOURCE_GROUP" == rg-avicl02-02a82191 && "$FUNCTION_APP" == func-icl02-02a82191 && "$SQL_SERVER_NAME" == sql-icl02-02a82191 ]] ) || {
    echo 'Esta pasta já contém configurações de outra implantação. Extraia o ZIP em uma pasta limpa.' >&2; exit 1; }
fi
printf '\n## Retomada em %s\n' "$(date -u +%FT%TZ)" >> "$logfile"
host="$(run 'az functionapp show -g "$RESOURCE_GROUP" -n "$FUNCTION_APP" --query "defaultHostName || properties.defaultHostName" -o tsv' az functionapp show -g "$RESOURCE_GROUP" -n "$FUNCTION_APP" --query 'defaultHostName || properties.defaultHostName' -o tsv)"
[[ "$host" == 'func-icl02-02a82191.azurewebsites.net' ]] || { echo 'Confira a assinatura selecionada no Cloud Shell.' >&2; exit 1; }

if [[ ! -f .deploy/resources.env ]]; then
  cp scripts/recursos-existentes.conf .deploy/resources.env
fi

if [[ -f .deploy/admin-retomada.env && ! -f .deploy/secrets.env ]]; then
  source .deploy/admin-retomada.env
fi
if [[ ! -f .deploy/secrets.env && -z "${SQL_ADMIN_PASSWORD:-}" ]]; then
  echo "A publicação precisa da senha de $SQL_ADMIN no servidor dedicado $SQL_SERVER_NAME."
  read -rsp 'Digite a senha atual ou pressione Enter para ver a opção de redefinição: ' SQL_ADMIN_PASSWORD
  printf '\n'
  if [[ -z "$SQL_ADMIN_PASSWORD" ]]; then
    echo "Redefinir troca a senha administrativa deste servidor. O usuário da aplicação mantém sua própria senha."
    read -rp 'Para gerar uma nova senha administrativa, digite REDEFINIR: ' confirm
    [[ "$confirm" == REDEFINIR ]] || { echo 'Operação cancelada.'; exit 1; }
    SQL_ADMIN_PASSWORD="$(python3 -c "import secrets; print('Aa1!' + secrets.token_urlsafe(30))")"
    temp="$(mktemp .deploy/admin.XXXXXX)"
    trap 'rm -f "$temp"' EXIT
    printf 'export SQL_ADMIN_PASSWORD=%q\n' "$SQL_ADMIN_PASSWORD" > "$temp"
    run 'az sql server update -g "$RESOURCE_GROUP" -n "$SQL_SERVER_NAME" --admin-password "$SQL_ADMIN_PASSWORD" --output none' \
      az sql server update -g "$RESOURCE_GROUP" -n "$SQL_SERVER_NAME" --admin-password "$SQL_ADMIN_PASSWORD" --output none
    mv "$temp" .deploy/admin-retomada.env
    echo 'Nova senha salva no arquivo privado .deploy/admin-retomada.env.'
  fi
  export SQL_ADMIN_PASSWORD
fi
bash scripts/publicar.sh
source .deploy/resources.env
run 'npm run smoke -- "$TOTALS_URL"' npm run smoke -- "$TOTALS_URL"
