# Registro legível sem expansão de valores secretos.
run() {
  local description="$1"; shift
  printf '\n```bash\n%s\n```\n' "$description" >> "$logfile"
  local result=0
  "$@" || result=$?
  printf '\nExit code: `%s`.\n' "$result" >> "$logfile"
  return "$result"
}
