# Email setup

The backend sends registration OTPs, payment confirmations, match-room credentials, and contact-form messages through SMTP.

Configure these values in the backend host's environment settings:

- `EMAIL_HOST`: SMTP server hostname.
- `EMAIL_PORT`: SMTP port, usually `587` (STARTTLS) or `465` (implicit TLS).
- `EMAIL_USER` and `EMAIL_PASSWORD`: SMTP account credentials. For Gmail, use an App Password.
- `EMAIL_FROM`: sender address accepted by the SMTP account.
- `SUPPORT_EMAIL`: destination for contact-form submissions. Defaults to `support@freefirearena.com`.

Do not use a personal account password or commit real credentials. Once these variables are set, run `npm run email:verify` from the `backend` directory to check the SMTP connection. A deployment must use a real SMTP provider; the console email preview is only for non-production development.

The contact form sends to `SUPPORT_EMAIL` and sets the visitor's address as `Reply-To`. If sending fails, the form displays an error and does not claim the message was delivered.
