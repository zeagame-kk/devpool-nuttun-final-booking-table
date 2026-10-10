#!/usr/bin/env bash
# Applies the sign-up and login-page settings of keycloak/import/pea-realm.json to a Keycloak that is already
# running. The import file only counts the first time (an existing realm is left alone, IGNORE_EXISTING), so a
# machine whose Keycloak volume already has data runs this once:
#
#   ./scripts/keycloak_realm_settings.sh        (the compose stack must be running: docker compose up -d)
#
# Sets: people can register themselves, the login page is titled "Table Not Found", Thai is the default language
# (English stays selectable). Safe to run again. It uses the bootstrap admin that the container already knows, so
# no password is typed or printed here.
set -euo pipefail
cd "$(dirname "$0")/.."

SERVICE="${KEYCLOAK_SERVICE:-keycloak}"
REALM="${KEYCLOAK_REALM:-pea}"

docker compose exec -T "$SERVICE" sh -c '
  set -e
  KCADM=/opt/keycloak/bin/kcadm.sh
  CFG="--config /tmp/kcadm.config"
  $KCADM config credentials $CFG --server http://localhost:8080 --realm master \
    --user "$KC_BOOTSTRAP_ADMIN_USERNAME" --password "$KC_BOOTSTRAP_ADMIN_PASSWORD" >/dev/null
  $KCADM update realms/'"$REALM"' $CFG \
    -s registrationAllowed=true \
    -s "displayName=Table Not Found" \
    -s internationalizationEnabled=true \
    -s "supportedLocales=[\"en\",\"th\"]" \
    -s defaultLocale=th
  rm -f /tmp/kcadm.config
  echo "realm '"$REALM"' updated: registration on, title Table Not Found, default language th"'
