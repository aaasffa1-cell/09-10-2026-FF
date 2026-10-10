# Manual UPI Payment Setup

## Payment model and status

This project uses **UPI QR + player-entered UTR + authenticated admin review**. There is no payment gateway, fake provider, bank API, webhook, or automatic UPI transaction check.

- Tournament entry fees are configured per tournament in INR.
- Winner prize: ₹300, separately funded and paid by the organizer. Registration payments are not a prize pool or stake.
- Funds go directly from the player's UPI app to the bank/UPI account linked to `UPI_ID`; the website does not hold or route the money.
- A UTR is only a reference supplied by the player. It is not proof of payment and never confirms a team by itself.

## Configure the receiving UPI ID

Set these as **backend** environment variables in local development and in the hosting provider's server environment settings:

| Variable | Required value |
|---|---|
| `UPI_ID` | Your active receiving UPI ID, for example `your-handle@bank` |
| `UPI_DISPLAY_NAME` | Payee name shown in the UPI request (defaults to `Free Fire Arena`) |
| `CURRENCY` | `INR` |

The example UPI ID above is a format illustration only; replace it with the UPI ID whose linked account you control. Never provide a UPI PIN, OTP, bank password, card number, CVV, or bank login. Do not put UPI configuration in frontend source or `VITE_*` variables.

When `UPI_ID` is missing/invalid or the currency configuration is invalid, the payment request endpoint fails closed. The amount is read from the selected tournament. The site renders a QR locally from the generated `upi://pay` URI; no external QR service receives the UPI ID or registration information.

## Flow

1. Player registers one squad and verifies the captain's email OTP.
2. Backend reads the selected tournament's entry fee and creates or reuses one `PENDING` payment row.
3. The player scans the QR or opens the UPI app link, pays the displayed tournament fee, and enters the transaction UTR.
4. `POST /api/payments/registrations/:id/utr` checks the registration access token, fee, status and UTR format. It stores the UTR and moves the payment to `UTR_SUBMITTED`; the registration remains under review.
5. Admin opens **Admin → Payment Verification**, checks their bank/UPI app for the exact amount and reference, then selects **Verify Payment** or rejects with a reason.
6. Admin approval locks the payment and registration and updates payment to `VERIFIED` and registration to `CONFIRMED` in one transaction. The confirmation email is then attempted.
7. Rejection records the reviewing admin/time/reason. The registration remains unconfirmed and the captain may submit a corrected UTR for the same registration.

No team is confirmed by payment-page visits, UTR submission, browser redirects, player requests, or an automatic status change. Only the authenticated admin review endpoint can approve a payment.

## API

Player endpoints require `X-Registration-Token`:

- `POST /api/payments/registrations/:id/start` — create/reuse a payment request using the selected tournament's stored fee and return safe display data/UPI URI.
- `POST /api/payments/registrations/:id/utr` — submit or correct a UTR.
- `GET /api/payments/registrations/:id/status` — safe payment/registration status; does not return the UTR.

Admin endpoints require the server-managed HttpOnly admin session cookie:

- `GET /api/admin/payments?status=&search=&sort=` — payment queue, counts, status filter, search and ordering.
- `POST /api/admin/payments/:paymentId/verify` — verify submitted UTR and confirm the team.
- `POST /api/admin/payments/:paymentId/reject` — reject submitted UTR; JSON body: `{"reason":"UTR could not be matched"}`.
- `GET /api/admin/payments/:paymentId/events` — payment submission/review history.

## Database changes

Migration `0003_manual_upi_review` adds review fields and UTR uniqueness to the existing `payments` table. Migration `0006_tournament_remodel` adds tournament metadata/cancellation, results history, admin sessions, OTP intent/purpose, and flexible capacity/numbering constraints. Existing payment and event records are preserved; legacy gateway records are not eligible for the new UPI flow.

Before applying to an existing database:

1. Verify `DATABASE_URL` targets the intended development/staging database.
2. Take a database backup.
3. Check status with `npm run db:status`.
4. Apply with `npm run db:setup`.
5. Verify existing payment rows and run the tests before production rollout.

No production database migration was run by this implementation.

## Local testing

1. Configure a development PostgreSQL database or use the project's local in-memory fallback.
2. Set a test receiving `UPI_ID` and `UPI_DISPLAY_NAME` in backend environment settings. Do not send a real payment during automated testing.
3. Run the backend and frontend:

```powershell
npm run dev:backend
npm run dev:frontend
```

4. Register one captain/squad against a tournament configured with a test fee, verify the OTP, check the matching QR amount, and submit a clearly test-only UTR.
5. In an isolated test database, use controlled test records to verify/reject payments. Never trigger an actual transfer or approve a production payment as part of testing.
6. Run:

```powershell
npm run test:payments --prefix backend
npm run build --prefix frontend
npm run db:status
```

The automated tests use an isolated in-memory PostgreSQL-compatible test database. They do not make a UPI transfer or assert that a real bank payment has occurred.

## Payment test checklist

Run these checks in an isolated development/staging database before production. Never use live payments or production records for destructive tests.

| # | Scenario | Expected result / limitation |
|---|---|---|
| 1 | Register one squad using the captain's verified account. | One tournament registration represents one squad; the form does not require other members' names or IDs. |
| 2 | Start payment for a valid registration. | Backend creates or reuses a pending payment for that tournament's configured INR fee; the client cannot supply an amount. |
| 3 | Open the payment screen and render its QR. | QR and UPI link show the configured receiving UPI ID, payee, and the tournament's configured fee; no transfer is made. |
| 4 | Submit a test UTR in an isolated database and approve the test record using the admin workflow. | Payment becomes `VERIFIED` and the squad becomes `CONFIRMED`; no actual transfer is made. |
| 5 | Submit an invalid/unmatched UTR and have an admin reject it. | Payment is rejected, the team remains unconfirmed, and the captain can submit a different UTR. |
| 6 | Start payment but cancel/close the UPI app without paying. | No team confirmation occurs; payment remains pending until the player submits a UTR and an admin reviews it. |
| 7 | Leave a registration unpaid beyond any assumed expiry period. | There is no provider-backed expiry signal in this manual flow; payment remains pending and is not confirmed automatically. |
| 8 | Repeat a payment notification/webhook five times. | Not applicable: this implementation has no provider webhook. Repeat admin review requests instead; an already-reviewed payment must not cause duplicate confirmation. |
| 9 | Send a webhook with an invalid signature. | Not applicable: there is no webhook endpoint or signature secret in this manual flow. |
| 10 | Attempt to provide a client-supplied amount or a test payment amount that differs from the selected tournament fee. | The API accepts no client-supplied amount and admin verification rejects a payment amount that differs from the tournament fee. |
| 11 | Request a payment/status/review using an unknown registration or payment ID. | Request is rejected; it cannot create or confirm an unrelated team. |
| 12 | Submit the same UTR twice, including with different letter casing, or attempt to review one payment twice. | Duplicate UTR is rejected; a repeated review cannot create a second registration confirmation. |
| 13 | Close the browser immediately after transferring, before submitting the UTR. | No automatic detection is possible. The payment remains unconfirmed until the captain returns and submits the UTR, then an admin matches it. |
| 14 | Simulate a network failure during UTR submission or status polling. | A failed client request must not mark the payment/team successful; retry by reopening the registration and check backend status. |
| 15 | Complete a real transfer while the browser never receives a response. | Manual flow cannot infer the transfer. On return, submit the UTR; admin verification then confirms the team. |
| 16 | Submit a UTR after the transfer, then verify it later. | The registration remains pending while waiting; admin verification confirms it even if the player has left the page. There is no delayed provider webhook. |
| 17 | Load-test 100 simultaneous registrations against disposable/staging PostgreSQL. | Verify capacity limits, no duplicate registrations/UTRs, and database stability. This load test has not been run as part of this change. |
| 18 | Check admin payment queue, filters, event history, and dashboard totals before/after verification and rejection. | Counts and event history reflect the current persisted payment and team states. |

Cases mentioning provider webhooks, automatic payment success/failure, or provider expiry cannot pass as gateway tests because this manual UPI design deliberately has no acquiring provider or webhook. A UTR is only a lookup reference; it is not proof of payment.

## Production rollout checklist

- [ ] Set `UPI_ID`, `UPI_DISPLAY_NAME`, and `CURRENCY=INR` in server-side production environment settings. Configure each tournament's entry fee in the admin panel.
- [ ] Confirm the UPI ID is active and linked to the account where you want to receive registration payments.
- [ ] Configure `DATABASE_URL`, `SESSION_SECRET`, admin credentials, SMTP, and allowed `FRONTEND_URL` using the existing deployment procedure.
- [ ] Back up the intended PostgreSQL database; run `npm run db:status` and review/apply all pending migrations in staging first.
- [ ] Deploy backend and frontend over HTTPS; confirm only the UPI ID/payee name—not private secrets—are exposed to players.
- [ ] Verify the manual UPI flow in staging with test records only. For actual production payment review, the admin must independently confirm funds in the receiving account before approval.
- [ ] Confirm a duplicate UTR is rejected and a rejected payment never confirms a team.
- [ ] Tell players that the site does not automatically verify UPI payments and that their team is pending until admin approval.

The system is not “automatically verified” and does not provide automatic bank settlement/status synchronization. Review volume is manual: the admin must independently check each submitted UTR.
