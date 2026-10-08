# Manual UPI Payment Setup

## Payment model and status

This project uses **UPI QR + player-entered UTR + authenticated admin review**. There is no payment gateway, fake provider, bank API, webhook, or automatic UPI transaction check.

- Team registration fee: exactly ₹40 INR for exactly four players.
- Winner prize: ₹300, separately funded and paid by the organizer. Registration payments are not a prize pool or stake.
- Funds go directly from the player's UPI app to the bank/UPI account linked to `UPI_ID`; the website does not hold or route the money.
- A UTR is only a reference supplied by the player. It is not proof of payment and never confirms a team by itself.

## Configure the receiving UPI ID

Set these as **backend** environment variables in local development and in the hosting provider's server environment settings:

| Variable | Required value |
|---|---|
| `UPI_ID` | Your active receiving UPI ID, for example `your-handle@bank` |
| `UPI_DISPLAY_NAME` | Payee name shown in the UPI request (defaults to `Free Fire Arena`) |
| `REGISTRATION_FEE` | `40` |
| `CURRENCY` | `INR` |

The example UPI ID above is a format illustration only; replace it with the UPI ID whose linked account you control. Never provide a UPI PIN, OTP, bank password, card number, CVV, or bank login. Do not put UPI configuration in frontend source or `VITE_*` variables.

When `UPI_ID` is missing/invalid or the fixed fee/currency values are changed, the payment request endpoint fails closed. The site renders a QR locally from the generated `upi://pay` URI; no external QR service receives the UPI ID or registration information.

## Flow

1. Player registers a squad of four and verifies the captain's email OTP.
2. Backend confirms the stored tournament registration fee is ₹40 INR and creates one `PENDING` payment row.
3. The player scans the QR or opens the UPI app link, pays exactly ₹40, and enters the transaction UTR.
4. `POST /api/payments/registrations/:id/utr` checks the registration access token, four-player roster, fee, status and UTR format. It stores the UTR and moves the payment to `UTR_SUBMITTED`; the registration remains `PAYMENT_PENDING`.
5. Admin opens **Admin → Payment Verification**, checks their bank/UPI app for the exact amount and reference, then selects **Verify Payment** or rejects with a reason.
6. Admin approval locks the payment and registration and updates payment to `VERIFIED` and registration to `CONFIRMED` in one transaction. The confirmation email is then attempted.
7. Rejection records the reviewing admin/time/reason. The registration remains unconfirmed and the player may submit a different UTR.

No team is confirmed by payment-page visits, UTR submission, browser redirects, player requests, or an automatic status change. Only the authenticated admin review endpoint can approve a payment.

## API

Player endpoints require `X-Registration-Token`:

- `POST /api/payments/registrations/:id/start` — create/reuse the ₹40 UPI payment request and return safe display data/UPI URI.
- `POST /api/payments/registrations/:id/utr` — submit or correct a UTR.
- `GET /api/payments/registrations/:id/status` — safe payment/registration status; does not return the UTR.

Admin endpoints require the existing admin HttpOnly-cookie authentication:

- `GET /api/admin/payments?status=&search=&sort=` — payment queue, counts, status filter, search and ordering.
- `POST /api/admin/payments/:paymentId/verify` — verify submitted UTR and confirm the team.
- `POST /api/admin/payments/:paymentId/reject` — reject submitted UTR; JSON body: `{"reason":"UTR could not be matched"}`.
- `GET /api/admin/payments/:paymentId/events` — payment submission/review history.

## Database changes

Migration `0003_manual_upi_review` adds `utr`, `submitted_at`, `verified_at`, `verified_by`, and `rejection_reason` to the existing `payments` table. It expands payment status constraints and adds a case-insensitive unique UTR index. Existing payment and event records are preserved; legacy gateway records are not eligible for the new UPI flow.

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

4. Register exactly four test players, verify the OTP, check the ₹40 QR/UPI ID, and submit a test UTR.
5. Sign in as an admin and verify the submission in the queue. Only use **Verify Payment** when you have independently confirmed the corresponding actual payment in your bank/UPI account. Use reject/retry for the rejection path.
6. Run:

```powershell
npm run test:payments --prefix backend
npm run build --prefix frontend
npm run db:status
```

The automated tests use an isolated in-memory PostgreSQL-compatible test database. They do not make a UPI transfer or assert that a real bank payment has occurred.

## Payment test checklist

Run these checks in development/staging before production. Never use **Verify Payment** unless the exact ₹40 payment is visible in the receiving bank/UPI account.

| # | Scenario | Expected result / limitation |
|---|---|---|
| 1 | Register a team with exactly four players and complete captain email verification. | Registration can proceed to payment; a roster with a different player count is rejected. |
| 2 | Start payment for a valid registration. | Backend creates or reuses a pending payment for exactly ₹40 INR; the client cannot supply an amount. |
| 3 | Open the payment screen and scan/render its QR. | QR and UPI link show the configured receiving UPI ID, payee, and ₹40 amount; no real transfer is required for this UI check. |
| 4 | Make a real ₹40 test transfer, submit its UTR, and have an admin match and verify it. | Payment becomes `VERIFIED` and the team becomes `CONFIRMED`. |
| 5 | Submit an invalid/unmatched UTR and have an admin reject it. | Payment is rejected, the team remains unconfirmed, and the captain can submit a different UTR. |
| 6 | Start payment but cancel/close the UPI app without paying. | No team confirmation occurs; payment remains pending until the player submits a UTR and an admin reviews it. |
| 7 | Leave a registration unpaid beyond any assumed expiry period. | There is no provider-backed expiry signal in this manual flow; payment remains pending and is not confirmed automatically. |
| 8 | Repeat a payment notification/webhook five times. | Not applicable: this implementation has no provider webhook. Repeat admin review requests instead; an already-reviewed payment must not cause duplicate confirmation. |
| 9 | Send a webhook with an invalid signature. | Not applicable: there is no webhook endpoint or signature secret in this manual flow. |
| 10 | Try to submit ₹1, ₹10, ₹20, ₹39, ₹41, or ₹100 as the payment amount; separately attempt to verify a transfer whose actual amount is not ₹40. | The API accepts no client-supplied amount; the displayed/requested amount is fixed at ₹40. Admin must reject any transfer that does not match exactly. |
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

- [ ] Set `UPI_ID`, `UPI_DISPLAY_NAME`, `REGISTRATION_FEE=40`, and `CURRENCY=INR` in server-side production environment settings.
- [ ] Confirm the UPI ID is active and linked to the account where you want to receive registration payments.
- [ ] Configure `DATABASE_URL`, `SESSION_SECRET`, admin credentials, SMTP, and allowed `FRONTEND_URL` using the existing deployment procedure.
- [ ] Back up the intended PostgreSQL database; run `npm run db:status` and reviewed migration `0003_manual_upi_review` in staging first.
- [ ] Deploy backend and frontend over HTTPS; confirm only the UPI ID/payee name—not private secrets—are exposed to players.
- [ ] Test a real ₹40 payment privately, check it in the receiving UPI/bank app, submit its UTR, and verify it as an authenticated admin.
- [ ] Confirm a duplicate UTR is rejected and a rejected payment never confirms a team.
- [ ] Tell players that the site does not automatically verify UPI payments and that their team is pending until admin approval.

The system is not “automatically verified” and does not provide automatic bank settlement/status synchronization. Review volume is manual: the admin must independently check each submitted UTR.
