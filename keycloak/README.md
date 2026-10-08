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
volume), this recreates the `pea` realm, the `bookingtable` client (with the same client ID/secret
already hardcoded in `compose.yml`), client scopes, and users from scratch — no manual setup
through the Admin Console required.

If the volume already has data, Keycloak's import strategy is `IGNORE_EXISTING`: a realm that
already exists is left untouched and the import is skipped. So restarting an existing dev
environment never clobbers local changes made through the Admin Console. To force a clean
re-import, remove the volume first:

```bash
docker compose down
docker volume rm bookingtable-all-in-one-keycloak-data
docker compose up -d
```

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
