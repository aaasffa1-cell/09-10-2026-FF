# Free Fire Arena deployment guide

## Deployment layout

- Frontend: React/Vite single-page app served from `frontend/dist`.
- API: Express through the root `api/index.js` serverless adapter.
- Database: persistent PostgreSQL. Production requires `DATABASE_URL`; do not use in-memory storage for production.
- Email: Nodemailer over SMTP.
- Room-email delivery: administrator-triggered from match control; no external scheduler is required.

Root `vercel.json` rewrites `/api/*` to the serverless Express adapter and other requests to the SPA. Deploy the repository root as the Vercel project root unless the deployment architecture is intentionally changed.

## Before deploying

1. Create a staging PostgreSQL database and set `DATABASE_URL` in the staging backend environment.
2. Back up any existing database before schema changes.
3. Check migration history with `npm run db:status`; back up the target database and review migration `0006_tournament_remodel` before applying it. The migration adds tournament metadata, cancellation and results history, admin sessions, OTP intent/purpose, and configurable capacity/numbering constraints. It stops for manual review if duplicate captain registrations exist in a tournament.
4. Create the initial admin account using backend-only `ADMIN_EMAIL` and `ADMIN_PASSWORD`. These are synchronized into the database during setup/startup; do not use documented/default credentials.
5. Configure SMTP and verify delivery from the backend environment.
6. Set `FRONTEND_URL` to the exact browser origin(s) that should be allowed. Production CORS does not allow arbitrary Vercel subdomains. Local HTTP origins on `localhost`, `127.0.0.1`, and `[::1]` are allowed on any port for local frontend development.
7. Set a strong unique `SESSION_SECRET`. Production startup fails if it is absent.
8. Configure `NODE_ENV` for the deployment environment. Keep secrets in host secret settings and not in frontend `VITE_*` settings.

## Environment variable names

Backend/serverless variables:

`DATABASE_URL`, `DB_SSL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (legacy account provisioning only), `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`, `SUPPORT_EMAIL`, `FRONTEND_URL`, `NODE_ENV`, `TZ`, `PORT`, `UPI_ID`, `UPI_DISPLAY_NAME`, `CURRENCY`.

Frontend variable:

`VITE_API_URL` (required backend origin or API base URL; never use it for a secret). The frontend sends API requests only to this configured URL. Set it in the frontend build environment for each deployment; if the value is a backend origin without `/api`, the frontend adds `/api`. Configure the backend's `FRONTEND_URL` to allow the frontend's exact origin.

See `.env.example`, `backend/.env.example`, and `frontend/.env.example` for variable names. They intentionally contain no credential values.

## Manual UPI payment setup

Configure an active receiving UPI ID and payee name in the backend environment and set `CURRENCY=INR`. Tournament entry fees are stored per tournament. The player scans a locally rendered UPI QR, pays directly to the account linked to that UPI ID, and submits the UTR. The website does not handle the funds or automatically verify bank/UPI transactions.

An authenticated admin must independently check the payment in the receiving bank/UPI app. Only then can the admin approve the UTR and confirm the team. See `PAYMENT_SETUP.md` for onboarding and the manual test checklist.

The organizer configures entry fees and prizes per tournament.

## Deployment verification

On a staging deployment, verify:

- `GET /api/health` responds.
- Tournament listing/detail load from PostgreSQL.
- Captain-only squad registration, registration access token, OTP send/verify, and slot reservation behave correctly.
- Registration status and payment/UTR endpoints reject requests without the registration access token.
- A player can submit a UTR but cannot verify it or confirm a team.
- Admin payment review requires the admin session cookie or bearer token; verify/reject actions are audited and transactional.
- Admin OTP sign-in sets an HttpOnly server-managed cookie; admin-only APIs reject missing/invalid authentication.
- Registration/payment history and room management load with admin authentication.
- Email OTP login, expiry, replay protection, and dashboard isolation work in the target deployment.
- SMTP failure is recorded, failed room delivery can be retried during the window, and pending/rejected squads receive no credentials.
- Manual room credential sending works at any time and sends only to confirmed squad captains; repeated sends skip successful recipients for the same credentials.
- Database migration history/data is correct and logs contain no secrets.

Before production launch, back up PostgreSQL, apply reviewed migrations to staging, verify the UPI ID belongs to the intended receiving account, and exercise manual payment review without using production records or payments.
