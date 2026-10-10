# Free Fire Arena

Free Fire Arena is a BR tournament registration and administration website. One captain registration represents one squad; other squad members are not individually registered through the booking form.

## Business model

- Four players form one team.
- Entry fees and squad capacity are configured per tournament.
- The ₹300 winner prize is funded and paid separately by the organizer. It is not a pool of registration fees.

## Current architecture

- **Frontend:** React 19, Vite, React Router, JavaScript.
- **Backend:** Node.js, Express 4, JSON REST API.
- **Database:** PostgreSQL through `pg` and parameterized SQL; no ORM.
- **Email:** SMTP through Nodemailer for OTP, payment review, room details, and contact messages.
- **Tournament room delivery:** Admin-triggered only; the application does not automatically send credentials based on the match clock.
- **Deployment:** Vercel configuration is included; see [VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md).

## Registration and manual UPI payment

1. The captain signs in or creates an account with a six-digit email OTP. OTPs are bcrypt-hashed in PostgreSQL, expire after five minutes, are single-use, and have resend and attempt limits. The administrator also signs in by OTP.
2. The signed-in captain submits captain and squad details for one selected tournament. Existing player records remain available for historical registrations.
3. The backend reads the entry fee from the selected tournament and creates one payment request in PostgreSQL.
4. The site builds a UPI payment URI from backend-only `UPI_ID`/`UPI_DISPLAY_NAME` configuration and renders its QR locally. No payment gateway or third-party QR service is used.
5. The captain pays from a UPI app, enters the UTR/reference, and the backend stores the payment as `UTR_SUBMITTED` / registration `PAYMENT_PENDING`. A unique case-insensitive database index prevents UTR reuse across registrations. UTR submission never confirms a squad.
6. An authenticated admin checks the transaction in their bank/UPI account and explicitly confirms actual receipt before approving or rejecting it. Approval locks the tournament row, verifies capacity, and atomically assigns the next available squad number in payment-verification order.
7. A rejected payment remains unconfirmed, gets no squad number, and can be resubmitted with a different UTR. Payment events preserve submission and review history.

Player sessions use random opaque tokens in HttpOnly cookies; only token hashes are stored. Administrator sessions are server-tracked and invalidated at logout. The private dashboard returns records for the signed-in captain email only. Capacity is tournament-specific; squad numbers are assigned at confirmation and remain stable.

**This is manual verification, not automatic UPI verification.** The website does not read bank transactions, call bank APIs, receive payment webhooks, or infer success from a UTR. UPI payment is sent by the player to the account linked to the configured UPI ID; the site does not collect or hold funds. Set an active UPI ID whose receiving account you control. See [PAYMENT_SETUP.md](./PAYMENT_SETUP.md).

## Application layout

```text
api/                         Root Vercel Express adapter
backend/
  src/
    controllers/              Request handlers
    database/                 PostgreSQL schema, migrations, seeds
    jobs/                     Legacy scheduler module (not started)
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

The existing `registrations` table represents squads. `players` retains player records for legacy registrations. Email-only accounts and sessions support the captain dashboard. Published tournament results are managed per tournament; a cumulative leaderboard and in-app chat are not included.

## Database

Tables include `admins`, `admin_sessions`, `admin_audit_logs`, `email_users`, `email_login_otps`, `email_otp_rate_limits`, `user_sessions`, `tournaments`, `registrations`, `players`, `otp_verifications`, `payments`, `payment_events`, `room_credentials`, `room_email_attempts`, `email_logs`, `tournament_results`, `tournament_result_history`, and `schema_migrations`.

Before applying migrations to an existing database, create and verify a recoverable backup and confirm the target environment. Migration `0004_customer_auth_and_squads` adds email account/session tables, squad numbers, room-email delivery/audit fields, and registration status constraints. Migration `0005_email_otp_rate_limits` ensures the per-email OTP rate-limit table exists. Migration `0006_tournament_remodel` adds tournament metadata and cancellation state, result/history tables, admin-session and admin-audit tracking, OTP purpose/registration intent, flexible squad numbering constraints, and a case-insensitive captain/tournament uniqueness index. It stops if duplicate captain registrations exist for a tournament; resolve conflicts explicitly before retrying. It also removes hardcoded fee/prize defaults for future tournament rows and sets 13 as the default capacity without changing existing tournament values. This migration has not been applied to a production database as part of this remodel.

```powershell
npm run db:status
npm run db:setup
```

`db:setup` applies the schema and tracked migrations transactionally. It does not insert sample tournaments by default. To load the development examples in `backend/src/database/seed.sql`, explicitly set `RUN_DEVELOPMENT_SEEDS=true` with `NODE_ENV=development`; never enable this for production. Migration errors stop the command.

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
- `CURRENCY=INR`: payment currency. The payment amount is read from the selected tournament; `REGISTRATION_FEE` is not used as a universal fee.

Keep these values server-side. Do not put them in a `VITE_*` variable; only the public UPI ID/payee name are returned by the backend for player payment.

## Email sign-in and room delivery

Production requires a real SMTP provider configured with `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, and `EMAIL_FROM`. `SUPPORT_EMAIL` defaults to `aasffa1@gmail.com`; OTPs are never returned by production APIs.

Room credentials are sent only to confirmed squad captains. An administrator manually starts delivery at any time; the application does not start sending automatically when a match approaches. Provider responses, attempts, failures, and initiating admin/time are recorded. Failed deliveries may be retried, while already successful deliveries of the same credentials are skipped.

Contact: [aasffa1@gmail.com](mailto:aasffa1@gmail.com) · [Telegram @gaiusmorgan901](https://t.me/gaiusmorgan901).

## Security notes

- Production requires `DATABASE_URL` and `SESSION_SECRET`.
- Customer sign-in uses email OTP and a server-validated session cookie; the dashboard filters registrations by the authenticated email.
- Admin sign-in uses email OTP. Admin sessions are stored server-side by token hash, use an HttpOnly cookie, and are invalidated at logout.
- Registration-specific OTP, status and payment actions require a high-entropy access token.
- The backend reads the payment amount from the selected tournament and does not accept payment or registration status from the browser.
- UTR is unique in PostgreSQL, including simultaneous submissions. Only an authenticated admin can approve/reject a submitted UTR.
- The backend never asks for a UPI PIN, OTP, bank password, card data, or login.

## Validation

```powershell
npm run test:payments --prefix backend
npm run test:auth-rooms --prefix backend
npm run build --prefix frontend
```
