# Keycloak realm snapshot

`import/pea-realm.json` is a full export of the local Keycloak `pea` realm: the `pea` realm's
settings, all its clients (including `bookingtable`, which the `api` service authenticates against),
client scopes, and its users (including hashed credentials, so importing preserves existing
logins such as `dev@pea.co.th`).

## How it gets loaded

`compose.yml` mounts this directory into the container:

```yaml
keycloak:
  command: ["start-dev", "--import-realm"]
  volumes:
    - bookingtable-all-in-one-keycloak-data:/opt/keycloak/data
    - ./keycloak/import:/opt/keycloak/data/import:ro
```

On `docker compose up`, `--import-realm` loads every file under `import/`. If the
`bookingtable-all-in-one-keycloak-data` volume is empty (e.g. a fresh clone, or after removing the
volume), this recreates the `pea` realm, the `bookingtable` client (its secret comes from the
`KEYCLOAK_CLIENT_SECRET` value in the root `.env`, substituted into the `${KEYCLOAK_CLIENT_SECRET}`
placeholder in the realm JSON), client scopes, and users from scratch — no manual setup
through the Admin Console required. Copy `.env.example` to `.env` first; `docker compose` refuses
to start while a required secret is unset.

If the volume already has data, Keycloak's import strategy is `IGNORE_EXISTING`: a realm that
already exists is left untouched and the import is skipped. So restarting an existing dev
environment never clobbers local changes made through the Admin Console. To force a clean
re-import, remove the volume first (Docker puts the project folder's name in front of the volume name, so look it up
with `docker volume ls` and never remove another project's volume):

```bash
docker compose down
docker volume rm "$(docker volume ls -q | grep 'bookingtable-all-in-one-keycloak-data$')"
docker compose up -d
```

## Sign-up and login-page settings

The import file turns on self sign-up with the email as the username (`registrationAllowed`, `registrationEmailAsUsername`,
`loginWithEmailAllowed`), titles the login page "Table Not Found" (`displayName`)
and makes Thai the default language with English selectable (`internationalizationEnabled`, `supportedLocales`,
`defaultLocale`). Because an existing realm is never re-imported, a Keycloak whose volume already has data gets the
same settings by running `./scripts/keycloak_realm_settings.sh` once (safe to repeat; it uses the container's own
bootstrap admin, so no password is typed).

## Refreshing the snapshot

After changing anything in the Admin Console (new client, scope, user, realm setting, etc.),
re-export to update `import/pea-realm.json` and commit it:

```bash
docker compose stop keycloak
# temporarily allow the export to write into the (normally read-only) mount
sed -i '' 's#\./keycloak/import:/opt/keycloak/data/import:ro#./keycloak/import:/opt/keycloak/data/import#' compose.yml
docker compose run --rm keycloak export --dir /opt/keycloak/data/import --realm pea --users realm_file
git checkout -- compose.yml   # restore the :ro mount
docker compose up -d keycloak
```

Then review the diff in `import/pea-realm.json` and commit it along with any other changes.
