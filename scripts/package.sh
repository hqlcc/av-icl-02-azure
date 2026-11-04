#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .deploy
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
cp package.json package-lock.json host.json "$stage/"
cp -R src "$stage/"
npm ci --omit=dev --ignore-scripts --prefix "$stage"
destination="$PWD/.deploy/functionapp.zip"
rm -f "$destination"
(cd "$stage" && zip -qr "$destination" host.json package.json package-lock.json src node_modules)
echo "Pacote pronto: $destination"
