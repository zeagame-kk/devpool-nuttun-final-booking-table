# Browser end-to-end check

Walks the real web app in a real Chrome against the real stack: sign in through Keycloak, search, sort, page,
book, review, manage a restaurant with a picture, the owner's view, the delete guard, an expired token, and sign out.
About 100 checks; each prints `PASS` or `FAIL`. The browser's time zone is set to New York on purpose, so every
time that appears or is sent must still be Bangkok time.

It creates two throwaway users in Keycloak (an owner and a customer) and deletes them at the end. It prints no
passwords or tokens. The restaurants it creates are its own (it deletes them again), and it only reads the seeded
ones, so the seed data is left as it was.

## Run

```bash
# 1) the stack, migrations and seed (see the root README), with web on http://localhost:3000
docker compose up -d --build
(cd api && goose up)

# 2) once: install the one dependency (playwright-core, it brings no browser of its own)
cd scripts/browser_e2e && npm ci

# 3) from the repository root, so .env is found
cd ../..
set -a; . ./.env; set +a          # needs KC_ADMIN_PASSWORD
node scripts/browser_e2e/run.mjs
```

Needs Chrome, Chromium or Edge. Set `CHROME_PATH` if it is not the default macOS location
(`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`). `WEB_URL`, `API_URL` and `KC_URL` override the
default addresses.

## Screenshots for the design hand-off

`design_screens.mjs` (same setup, same `KC_ADMIN_PASSWORD`) takes the 29 screenshots in `docs/design/screens`: every
page and state, desktop and phone. It creates three throwaway users and demo restaurants with bookings and reviews, and
removes what the API allows. The rest (reviews, cancelled bookings, `users` rows, all named `e2e-design-*`) needs the SQL
in `docs/design/README.md` afterwards.

## Notes

- The web container runs `next dev` on a bind mount, and on Colima it can miss file edits. If the pages do not
  match your code, run `docker compose restart web` first.
- Two checks depend on Keycloak keeping the browser's single sign-on session: after a dead refresh token the user
  is sent to sign in again and comes back signed in without typing anything.
- Not covered: cancelling or changing a booking inside the restaurant's lead time (needs a booking that starts
  soon; the backend tests cover it), dark mode, and browsers other than Chromium.
