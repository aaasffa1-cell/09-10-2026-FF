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

1. The captain submits a squad with exactly four players. The backend reserves tournament capacity for 15 minutes and sends an email OTP.
2. The captain verifies the OTP using the private registration access token returned at registration.
3. The backend verifies the stored tournament fee is exactly ₹40 INR and creates one payment request in PostgreSQL.
4. The site builds a UPI payment URI from backend-only `UPI_ID`/`UPI_DISPLAY_NAME` configuration and renders its QR locally. No payment gateway or third-party QR service is used.
5. The captain pays from a UPI app, enters the UTR/reference, and the backend stores the payment as `UTR_SUBMITTED`. A unique case-insensitive database index prevents UTR reuse across registrations.
6. An authenticated admin checks the transaction in their bank/UPI account and approves or rejects it. Only approval in a single PostgreSQL transaction sets payment `VERIFIED` and registration `CONFIRMED`.
7. A rejected payment remains unconfirmed and can be resubmitted with a different UTR. Payment events preserve submission and review history.

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

The existing `registrations` table represents squads. `players` contains each squad's four player records. There are no separate user accounts, match-result, leaderboard, or in-app notification modules.

## Database

Tables include `admins`, `tournaments`, `registrations`, `players`, `otp_verifications`, `payments`, `payment_events`, `room_credentials`, `email_logs`, and `schema_migrations`.

Before applying migrations to an existing database, back it up and confirm the target environment. The migration adds UTR/review fields and constraints without dropping payment/event tables or historical gateway records.

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

## Security notes

- Production requires `DATABASE_URL` and `SESSION_SECRET`.
- Admin sessions use an HttpOnly cookie and a bearer token held in tab-scoped session storage so separately hosted frontend/backend deployments can authenticate cross-origin API requests. The token is removed at logout.
- Registration-specific OTP, status and payment actions require a high-entropy access token.
- The backend fixes amount and currency, validates exactly four players, and does not accept payment or registration status from the browser.
- UTR is unique in PostgreSQL, including simultaneous submissions. Only an authenticated admin can approve/reject a submitted UTR.
- The backend never asks for a UPI PIN, OTP, bank password, card data, or login.

## Validation

```powershell
npm run test:payments --prefix backend
npm run build --prefix frontend
```
