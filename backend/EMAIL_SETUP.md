# Email setup

The backend sends customer sign-in OTPs, legacy registration OTPs, payment confirmations, match-room credentials, and contact-form messages through SMTP.

Configure these values in the backend host's environment settings:

- `EMAIL_HOST`: SMTP server hostname.
- `EMAIL_PORT`: SMTP port, usually `587` (STARTTLS) or `465` (implicit TLS).
- `EMAIL_USER` and `EMAIL_PASSWORD`: SMTP account credentials. For Gmail, use an App Password.
- `EMAIL_FROM`: sender address accepted by the SMTP account.
- `SUPPORT_EMAIL`: destination for contact-form submissions. Defaults to `aasffa1@gmail.com`.

Do not use a personal account password or commit real credentials. Once these variables are set, run `npm run email:verify` from the `backend` directory to check the SMTP connection. A deployment must use a real SMTP provider; the console email preview is only for non-production development.

Customer OTPs are six digits, expire after 10 minutes, are accepted once, and are stored as bcrypt hashes. Delivery must be configured before production launch; OTPs are never returned by production APIs.

Room credentials go only to confirmed captains during the configured pre-match window (`ROOM_EMAIL_LEAD_MINUTES`, default 10). SMTP acceptance/provider responses and failures are recorded in PostgreSQL. Room emails can be retried after failure during that window; successfully accepted deliveries are not repeated. The contact form sends to `SUPPORT_EMAIL` and sets the visitor's address as `Reply-To`. If sending fails, the form displays an error and does not claim the message was delivered.
