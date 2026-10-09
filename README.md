# Free Fire Arena

Free Fire Arena is a four-player BR tournament registration and administration website.

## Business model

- Four players form one team.
- Team registration is exactly ₹40 INR.
- The ₹300 winner prize is funded and paid separately by the organizer. It is not a pool of registration fees.

## Current architecture

- **Frontend:** React 19, Vite, React Router, JavaScript.
- **Backend:** Node.js, Express 4, JSON REST API.
- **Database:** PostgreSQL through `pg` and parameterized SQL; no ORM.
- **Email:** SMTP through Nodemailer for OTP, payment confirmation, room details, and contact messages.
- **Tournament room delivery:** Node-Cron in standalone backend mode; serverless deployments need a configured external cron trigger.
- **Deployment:** Vercel configuration is included; see [VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md).

## Registration and manual UPI payment

1. The captain signs in or registers with a six-digit email OTP. OTPs are bcrypt-hashed in PostgreSQL, expire after 10 minutes, are single-use, and have IP-, email-, and attempt-based limits. Customer password and password-reset flows are not used.
2. The signed-in captain submits a squad with exactly four players. The backend requires the captain email to match the verified account.
3. The backend verifies the stored tournament fee is exactly ₹40 INR and creates one payment request in PostgreSQL.
4. The site builds a UPI payment URI from backend-only `UPI_ID`/`UPI_DISPLAY_NAME` configuration and renders its QR locally. No payment gateway or third-party QR service is used.
5. The captain pays from a UPI app, enters the UTR/reference, and the backend stores the payment as `UTR_SUBMITTED` / registration `PAYMENT_PENDING`. A unique case-insensitive database index prevents UTR reuse across registrations. UTR submission never confirms a squad.
6. An authenticated admin checks the transaction in their bank/UPI account and explicitly confirms actual receipt before approving or rejecting it. Approval locks the tournament row, verifies capacity, and atomically assigns the next available squad number in payment-verification order.
7. A rejected payment remains unconfirmed, gets no squad number, and can be resubmitted with a different UTR. Payment events preserve submission and review history.

Customer sessions use random opaque tokens in HttpOnly cookies; only token hashes are stored. The private dashboard returns records for the signed-in captain email only. Confirmed tournament capacity is limited to 13 squads / 52 players, and an assigned squad number is permanent.

**This is manual verification, not automatic UPI verification.** The website does not read bank transactions, call bank APIs, receive payment webhooks, or infer success from a UTR. UPI payment is sent by the player to the account linked to the configured UPI ID; the site does not collect or hold funds. Set an active UPI ID whose receiving account you control. See [PAYMENT_SETUP.md](./PAYMENT_SETUP.md).

## Application layout

```text
api/                         Root Vercel Express adapter
backend/
  src/
    controllers/              Request handlers
    database/                 PostgreSQL schema, migrations, seeds
    jobs/                     Room-credential scheduler
    middleware/               Validation, authorization, rate limits
    routes/                   REST route definitions
    services/                 OTP, email and manual UPI payment services
    test/                     Payment and integration tests
    server.js                 Express entry point
frontend/
  src/
    components/
    pages/
      admin/
    services/api.js
```

The existing `registrations` table represents squads. `players` contains each squad's four player records. Email-only accounts and sessions support the captain dashboard; match-result, leaderboard, and in-app chat modules are not included.

## Database

Tables include `admins`, `email_users`, `email_login_otps`, `email_otp_rate_limits`, `user_sessions`, `tournaments`, `registrations`, `players`, `otp_verifications`, `payments`, `payment_events`, `room_credentials`, `room_email_attempts`, `email_logs`, and `schema_migrations`.

Before applying migrations to an existing database, back it up and confirm the target environment. Migration `0004_customer_auth_and_squads` adds email account/session tables, permanent squad numbers, room-email delivery/audit fields, and registration status constraints. Existing confirmed squads are numbered by payment verification time. It stops safely if a tournament has more than 13 confirmed squads; resolve that capacity conflict before retrying. Migration `0005_email_otp_rate_limits` ensures the per-email OTP rate-limit table exists.

```powershell
npm run db:status
npm run db:setup
```

`db:setup` applies the schema and tracked migrations transactionally, plus idempotent tournament seed data. Migration errors stop the command.

## Local development

Configure backend variables from [backend/.env.example](./backend/.env.example). Set `DATABASE_URL` to a disposable development PostgreSQL database or leave it empty only when using the in-memory development fallback. Configure SMTP if real email delivery is needed.

```powershell
npm run dev:backend
npm run dev:frontend
```

Frontend Vite proxies `/api` to the local backend. The backend listens on `PORT` (default 5000); Vite defaults to 5173.

Required for the UPI payment screen:

- `UPI_ID`: the public UPI ID players pay.
- `UPI_DISPLAY_NAME`: the payee name shown with the UPI request.
- `REGISTRATION_FEE=40` and `CURRENCY=INR`: fixed business values; other values disable payment rather than changing the fee.

Keep these values server-side. Do not put them in a `VITE_*` variable; only the public UPI ID/payee name are returned by the backend for player payment.

## Email sign-in and room delivery

Production requires a real SMTP provider configured with `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, and `EMAIL_FROM`. `SUPPORT_EMAIL` defaults to `aasffa1@gmail.com`; OTPs are never returned by production APIs.

Room credentials are sent only to confirmed squad captains' verified email addresses; player addresses are not collected yet. The server-side scheduler checks the configured `ROOM_EMAIL_LEAD_MINUTES` (default 10 minutes; an 8:00 PM IST match targets 7:50 PM). Manual dispatch is rejected outside this window. Standalone deployments run Node-Cron; serverless deployments must invoke protected `/api/cron/check-rooms` at least once per minute with the configured `CRON_SECRET` bearer token. Provider responses, attempts, failures, and initiating admin/time are recorded. Failed deliveries may be retried during the authorized window; completed deliveries are not resent by repeated clicks.

Contact: [aasffa1@gmail.com](mailto:aasffa1@gmail.com) · [Telegram @gaiusmorgan901](https://t.me/gaiusmorgan901).

## Security notes

- Production requires `DATABASE_URL` and `SESSION_SECRET`.
- Customer sign-in uses email OTP and a server-validated session cookie; the dashboard filters registrations by the authenticated email.
- Admin sessions use an HttpOnly cookie and a bearer token held in tab-scoped session storage so separately hosted frontend/backend deployments can authenticate cross-origin API requests. The token is removed at logout.
- Registration-specific OTP, status and payment actions require a high-entropy access token.
- The backend fixes amount and currency, validates exactly four players, and does not accept payment or registration status from the browser.
- UTR is unique in PostgreSQL, including simultaneous submissions. Only an authenticated admin can approve/reject a submitted UTR.
- The backend never asks for a UPI PIN, OTP, bank password, card data, or login.

## Validation

```powershell
npm run test:payments --prefix backend
npm run test:auth-rooms --prefix backend
npm run build --prefix frontend
```
