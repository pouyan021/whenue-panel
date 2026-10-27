# whenue-panel

Web panel for clinic staff on the Whenue loyalty-club platform. It is in Persian (right to left,
Solar Hijri dates, Persian digits, amounts in Toman) by default, with English one click away.
Staff sign in with their whenue-api account and:

- **Check members in at reception**: find a member by name, mobile number or a scan of their club
  card, record the visit and what they paid, and hand over rewards their points cover.
- **Look after members**: invite people by mobile number, see points, rewards and referrals,
  correct a balance, cancel a reward, and enter consents signed on paper.
- **Run the club** (organization admins): rewards, how points are earned, club name, language and
  time zone, and which modules are on (platform admins switch modules).
- **Connect the clinic's software** (organization admins): API keys for the integration API and
  signed webhooks, with recent deliveries.
- **Video testimonials**, when the module is on: review each video, approve or reject it, and clear
  it for use where the person consented; add visits and hand out the link that opens
  [whenue-app](https://github.com/pouyan021/whenue-app); run campaigns and message templates.
- **Edit the branch's details**.

Venue staff only ever see their own branch. Organization admins switch between their branches;
platform admins between every organization's branches.

A member card's QR code holds `whenue://member/<id>`. A USB barcode scanner types it into the
check-in search box, which opens that member.

Stack: Vite, React 19, TypeScript, Apollo Client 4, React Router, the Vazirmatn font (bundled, so
nothing loads from outside Iran). Tests use Vitest and Testing Library.

## Running locally

1. Start [whenue-api](https://github.com/pouyan021/whenue-api) (`./gradlew bootRun` starts
   Postgres, RustFS and RabbitMQ from its `compose.yaml`). Set
   `WHENUE_BOOTSTRAP_ADMIN_EMAIL` and `WHENUE_BOOTSTRAP_ADMIN_PASSWORD` the first time to get an
   admin account. The API allows `http://localhost:5173` cross-origin by default.
2. Here:

   ```sh
   cp .env.example .env.local   # only if the API isn't on http://localhost:8080
   npm install
   npm run dev                  # http://localhost:5173
   ```

3. Sign in as the admin, or create staff with the API's `createStaffAccount` mutation: role
   `ORG_ADMIN` with an `organizationId`, or `VENUE_STAFF` with a `venueId`.

Videos play from short-lived signed URLs on the S3 server (`WHENUE_S3_PUBLIC_ENDPOINT` in the
API), so the browser must be able to reach that host.

## Configuration

| Variable | Default | |
| --- | --- | --- |
| `VITE_GRAPHQL_URL` | `http://localhost:8080/graphql` | whenue-api's GraphQL endpoint. |
| `VITE_VISIT_LINK_BASE` | `whenue://visit/` | Prefix of visitor links; the token is appended. |

These are inlined at build time. For a deployment, also add the panel's origin to the API's
`WHENUE_CORS_ALLOWED_ORIGINS`.

## Container image

The `Dockerfile` builds the panel with `VITE_GRAPHQL_URL=/graphql` and serves it from nginx on port
8080, which forwards `/graphql` and the integration API reference (`/swagger-ui`, `/v3/api-docs`)
to `API_UPSTREAM` (default `http://whenue-api:8080`). The same image
therefore works in every environment and the API needs no CORS entry for it. CI pushes it to
`ghcr.io/pouyan021/whenue-panel` on every merge to `main`; whenue-deploy runs it.

## Scripts

```sh
npm run dev        # dev server
npm run lint
npm run typecheck
npm test           # Vitest
npm run build      # typecheck + production bundle in dist/
```

## Layout

```
src/
  main.tsx, App.tsx       Apollo, language, auth and routes
  i18n/                   Persian and English texts (en.ts lists the keys; fa.ts must have them all)
  lib/                    config, session, Apollo client, current branch, formatting, Solar Hijri
                          calendar, time zones, Toman and digits, paper consent wording
  graphql/operations.ts   queries and mutations, typed by hand against whenue-api's schema
  components/             app shell, date picker, member and testimonial pieces, small UI pieces
  pages/                  check-in, members, rewards, club settings, integrations, testimonials,
                          visits, campaigns, templates, branch, login
```

Dates show in the organization's time zone whatever the browser's. Persian uses Solar Hijri day,
month and year pickers; English uses the browser's own date picker.

The paper consent wording in `src/lib/consents.ts` is a draft for a lawyer to check. Raise
`PAPER_CONSENT_VERSION` whenever it changes.
