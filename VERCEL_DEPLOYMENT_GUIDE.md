# Free Fire Arena deployment guide

## Deployment layout

- Frontend: React/Vite single-page app served from `frontend/dist`.
- API: Express through the root `api/index.js` serverless adapter.
- Database: persistent PostgreSQL. Production requires `DATABASE_URL`; do not use in-memory storage for production.
- Email: Nodemailer over SMTP.
- Room-email scheduling: standalone backend uses Node-Cron. Serverless deployments must arrange a protected external scheduler for `/api/cron/check-rooms`; verify scheduler availability/limits with the hosting plan.

Root `vercel.json` rewrites `/api/*` to the serverless Express adapter and other requests to the SPA. Deploy the repository root as the Vercel project root unless the deployment architecture is intentionally changed.

## Before deploying

1. Create a staging PostgreSQL database and set `DATABASE_URL` in the staging backend environment.
2. Back up any existing database before schema changes.
3. Check migration history with `npm run db:status`; apply migrations through `0004_customer_auth_and_squads` with `npm run db:setup` only after confirming the target URL. This adds hashed OTP/session tables and squad numbering; the migration stops for manual review if existing tournaments exceed 13 confirmed squads.
4. Create the initial admin account using backend-only `ADMIN_EMAIL` and `ADMIN_PASSWORD`. These are synchronized into the database during setup/startup; do not use documented/default credentials.
5. Configure SMTP and verify delivery from the backend environment.
6. Set `FRONTEND_URL` to the exact browser origin(s) that should be allowed. Production CORS does not allow arbitrary Vercel subdomains. Local HTTP origins on `localhost`, `127.0.0.1`, and `[::1]` are allowed on any port for local frontend development.
7. Set a strong unique `SESSION_SECRET`. Production startup fails if it is absent.
8. Set `ROOM_EMAIL_LEAD_MINUTES=10` for the 7:50 PM send target for an 8:00 PM match. Set a strong `CRON_SECRET` and schedule a protected request to `/api/cron/check-rooms` at least once per minute; Vercel serverless does not keep the in-process Node-Cron worker alive between invocations. Never make a production cron endpoint unauthenticated.
9. Configure `NODE_ENV` for the deployment environment. Keep secrets in host secret settings and not in frontend `VITE_*` settings.

## Environment variable names

Backend/serverless variables:

`DATABASE_URL`, `DB_SSL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`, `SUPPORT_EMAIL`, `CRON_SECRET`, `ROOM_EMAIL_LEAD_MINUTES`, `FRONTEND_URL`, `NODE_ENV`, `TZ`, `PORT`, `UPI_ID`, `UPI_DISPLAY_NAME`, `REGISTRATION_FEE`, `CURRENCY`.

Frontend variable:

`VITE_API_URL` (required backend origin or API base URL; never use it for a secret). The frontend sends API requests only to this configured URL. Set it in the frontend build environment for each deployment; if the value is a backend origin without `/api`, the frontend adds `/api`. Configure the backend's `FRONTEND_URL` to allow the frontend's exact origin.

See `.env.example`, `backend/.env.example`, and `frontend/.env.example` for variable names. They intentionally contain no credential values.

## Manual UPI payment setup

Configure an active receiving UPI ID and payee name in the backend environment. `REGISTRATION_FEE` must remain `40` and `CURRENCY` must remain `INR`. The player scans a locally rendered UPI QR, pays directly to the account linked to that UPI ID, and submits the UTR. The website does not handle the funds or automatically verify bank/UPI transactions.

An authenticated admin must independently check the payment in the receiving bank/UPI app. Only then can the admin approve the UTR and confirm the team. See `PAYMENT_SETUP.md` for onboarding and the manual test checklist.

The business model remains a ₹40 team registration fee for a four-player team and a separately organizer-funded ₹300 winner prize.

## Deployment verification

On a staging deployment, verify:

- `GET /api/health` responds.
- Tournament listing/detail load from PostgreSQL.
- Four-player registration, registration access token, OTP send/verify, and slot reservation behave correctly.
- Registration status and payment/UTR endpoints reject requests without the registration access token.
- A player can submit a UTR but cannot verify it or confirm a team.
- Admin payment review requires the admin session cookie or bearer token; verify/reject actions are audited and transactional.
- Payment order creation reports provider unavailability until a real adapter exists; no fake payment success appears.
- Admin login uses an HttpOnly cookie and returns a bearer token for cross-origin frontend/backend deployments; admin-only APIs reject missing/invalid authentication.
- Registration/payment history and room management load with admin authentication.
- Email OTP login, expiry, replay protection, and dashboard isolation work in the target deployment.
- SMTP failure is recorded, failed room delivery can be retried during the window, and pending/rejected squads receive no credentials.
- Manual room sending is rejected outside the ten-minute pre-match window; verify the external scheduler independently of an open dashboard.
- Database migration history/data is correct and logs contain no secrets.

Before production launch, back up PostgreSQL, apply migration `0004_customer_auth_and_squads` to staging, verify the UPI ID belongs to the intended receiving account, and test manual admin review with a real ₹40 transfer.
