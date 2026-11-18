#!/usr/bin/env bash
# Crea los roles y bases de datos locales de NEXUS y escribe .env con contraseñas aleatorias.
# Requiere acceso de superusuario a PostgreSQL:
#   - PG_SUPERUSER_URL=postgres://postgres:...@localhost:5432/postgres  (recomendado), o
#   - un usuario del sistema "postgres" accesible con sudo/su.
set -euo pipefail
cd "$(dirname "$0")/.."

run_super() {
  if [[ -n "${PG_SUPERUSER_URL:-}" ]]; then
    psql "$PG_SUPERUSER_URL" -v ON_ERROR_STOP=1 -q "$@"
  elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 -q "$@"
  else
    su postgres -c "psql -v ON_ERROR_STOP=1 -q $(printf '%q ' "$@")"
  fi
}

if [[ -f .env ]] && grep -q '^DATABASE_URL=' .env; then
  echo "• .env ya existe; se reutilizan sus credenciales."
  OWNER_PW=$(grep '^DATABASE_OWNER_URL=' .env | sed -E 's#.*nexus_owner:([^@]+)@.*#\1#')
  APP_PW=$(grep '^DATABASE_URL=' .env | sed -E 's#.*nexus_app:([^@]+)@.*#\1#')
else
  OWNER_PW=$(openssl rand -hex 24)
  APP_PW=$(openssl rand -hex 24)
fi
HOST=${PGHOST:-localhost}
PORT=${PGPORT:-5432}

run_super -c "DO \$\$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nexus_owner') THEN CREATE ROLE nexus_owner LOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nexus_app') THEN CREATE ROLE nexus_app LOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE; END IF;
END\$\$;"
run_super -c "ALTER ROLE nexus_owner PASSWORD '$OWNER_PW'; ALTER ROLE nexus_app PASSWORD '$APP_PW' NOBYPASSRLS;"

for DB in nexus nexus_test; do
  if ! run_super -tAc "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1; then
    run_super -c "CREATE DATABASE $DB OWNER nexus_owner"
  fi
  run_super -d "$DB" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; GRANT CONNECT ON DATABASE $DB TO nexus_app;"
done

if [[ ! -f .env ]]; then
  cp .env.example .env
fi
sed -i -E "s#^DATABASE_OWNER_URL=.*#DATABASE_OWNER_URL=postgres://nexus_owner:${OWNER_PW}@${HOST}:${PORT}/nexus#" .env
sed -i -E "s#^DATABASE_URL=.*#DATABASE_URL=postgres://nexus_app:${APP_PW}@${HOST}:${PORT}/nexus#" .env
grep -q '^TEST_DATABASE_OWNER_URL=' .env || echo "TEST_DATABASE_OWNER_URL=postgres://nexus_owner:${OWNER_PW}@${HOST}:${PORT}/nexus_test" >> .env
grep -q '^TEST_DATABASE_URL=' .env || echo "TEST_DATABASE_URL=postgres://nexus_app:${APP_PW}@${HOST}:${PORT}/nexus_test" >> .env
echo "✓ Roles nexus_owner / nexus_app y bases nexus / nexus_test listos. Credenciales en .env (no se commitea)."
