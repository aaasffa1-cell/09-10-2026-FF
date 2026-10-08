const nodemailer = require('nodemailer');

// Initialize Transporter
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.EMAIL_HOST;
  const port = parseInt(process.env.EMAIL_PORT || '587', 10);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD ? process.env.EMAIL_PASSWORD.trim().replace(/\s+/g, '') : null;

  if (host && user && pass) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('EMAIL_PORT must be a valid TCP port.');
    }
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    console.log('[EmailService] SMTP Transporter configured with host:', host);
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email delivery is not configured. Set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, and EMAIL_PASSWORD.');
    }

    console.warn('[EmailService] SMTP credentials are not configured. Emails will be logged to the console outside production.');
    transporter = {
      sendMail: async (mailOptions) => {
        console.log('\n================== [DEVELOPMENT EMAIL DISPATCH] ==================');
        console.log(`TO: ${mailOptions.to}`);
        console.log(`FROM: ${mailOptions.from || process.env.EMAIL_FROM || 'Free Fire Arena <support@freefirearena.com>'}`);
        console.log(`SUBJECT: ${mailOptions.subject}`);
        console.log('------------------------------------------------------------------');
        console.log(`TEXT PREVIEW:\n${mailOptions.text || 'HTML Email Body'}`);
        console.log('==================================================================\n');
        return {
          messageId: `mock_msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          response: '250 Mock Email Dispatched (Dev Mode)',
          accepted: [mailOptions.to],
          rejected: [],
        };
      },
    };
  }

  return transporter;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

async function sendEmail(mailOptions) {
  const result = await getTransporter().sendMail(mailOptions);
  const accepted = result.accepted || [];
  const rejected = result.rejected || [];
  const recipient = String(mailOptions.to).toLowerCase();

  if (
    rejected.some((address) => String(address).toLowerCase() === recipient) ||
    !accepted.some((address) => String(address).toLowerCase() === recipient)
  ) {
    throw new Error(`Email provider did not accept the message for ${mailOptions.to}.`);
  }

  return result;
}

// 1. Template: OTP Verification Email
function getOtpEmailHtml(otp, tournamentName, captainName) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email - Free Fire Arena</title>
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0c0d14; color: #ffffff; margin: 0; padding: 20px; }
      .container { max-width: 550px; margin: 0 auto; background: #161824; border: 1px solid #2a2d3d; border-radius: 12px; overflow: hidden; }
      .header { background: linear-gradient(135deg, #ff5500, #ff2a4b); padding: 25px 20px; text-align: center; }
      .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 2px; color: #ffffff; text-transform: uppercase; }
      .header p { margin: 5px 0 0; font-size: 13px; color: #ffe6e6; letter-spacing: 1px; }
      .content { padding: 30px 25px; text-align: center; }
      .greeting { font-size: 16px; color: #cccccc; margin-bottom: 20px; }
      .otp-box { background: #0c0d14; border: 2px dashed #ff5500; border-radius: 8px; padding: 18px; margin: 25px 0; display: inline-block; }
      .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #ff5500; margin: 0; font-family: monospace; }
      .meta { font-size: 13px; color: #888899; margin-top: 15px; }
      .warning { font-size: 12px; color: #ffaa33; background: #261e14; padding: 10px; border-radius: 6px; margin-top: 20px; text-align: left; }
      .footer { background: #0f1018; padding: 20px; text-align: center; font-size: 12px; color: #666677; border-top: 1px solid #222433; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>FREE FIRE ARENA</h1>
        <p>BR ESPORTS TOURNAMENT VERIFICATION</p>
      </div>
      <div class="content">
        <p class="greeting">Hello <strong>${escapeHtml(captainName || 'Squad Captain')}</strong>,</p>
        <p style="color: #dddddd; line-height: 1.6;">
          You are registering your 4-player squad for <strong>${escapeHtml(tournamentName)}</strong>. Use the 6-digit verification code below to confirm your captain email address:
        </p>
        <div class="otp-box">
          <div class="otp-code">${escapeHtml(otp)}</div>
        </div>
        <p class="meta">⏱️ This code will expire in <strong>10 minutes</strong>. Valid for single use only.</p>
        <div class="warning">
          ⚠️ <strong>Security Notice:</strong> Never share your verification code with anyone. Free Fire Arena staff will never ask for your OTP.
        </div>
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} Free Fire Arena Esports. All rights reserved.
      </div>
    </div>
  </body>
  </html>
  `;
}

// 2. Template: Registration & Payment Confirmation
function getConfirmationEmailHtml(registration, tournament, players) {
  const playerRows = (players || []).map((p, idx) => `
    <tr style="border-bottom: 1px solid #222536;">
      <td style="padding: 10px; color: #ff7700; font-weight: bold;">Player ${idx + 1} ${idx === 0 ? '(Captain)' : ''}</td>
      <td style="padding: 10px; color: #ffffff;">${escapeHtml(p.full_name)}</td>
      <td style="padding: 10px; color: #00ffcc; font-family: monospace;">${escapeHtml(p.free_fire_id)}</td>
    </tr>
  `).join('');

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Registration Confirmed - Free Fire Arena</title>
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0c0d14; color: #ffffff; margin: 0; padding: 20px; }
      .container { max-width: 600px; margin: 0 auto; background: #161824; border: 1px solid #2a2d3d; border-radius: 12px; overflow: hidden; }
      .header { background: linear-gradient(135deg, #00b074, #008055); padding: 25px 20px; text-align: center; }
      .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 2px; color: #ffffff; }
      .badge { display: inline-block; background: #ffffff; color: #008055; font-size: 12px; font-weight: 800; padding: 4px 12px; border-radius: 20px; margin-top: 8px; text-transform: uppercase; }
      .content { padding: 25px; }
      .info-card { background: #0c0d14; border: 1px solid #2a2d3d; border-radius: 8px; padding: 18px; margin-bottom: 20px; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
      .info-item { margin-bottom: 10px; }
      .label { font-size: 11px; text-transform: uppercase; color: #888899; letter-spacing: 1px; }
      .value { font-size: 15px; font-weight: 600; color: #ffffff; margin-top: 3px; }
      .important-banner { background: #261e14; border-left: 4px solid #ff5500; padding: 15px; border-radius: 6px; margin: 20px 0; }
      .footer { background: #0f1018; padding: 20px; text-align: center; font-size: 12px; color: #666677; border-top: 1px solid #222433; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>REGISTRATION CONFIRMED</h1>
        <div class="badge">✓ Slot Confirmed (₹${tournament.entry_fee || '40'} Paid)</div>
      </div>
      <div class="content">
        <p style="font-size: 15px; color: #dddddd; margin-top: 0;">
          Congratulations <strong>${escapeHtml(registration.captain_name)}</strong>! Your 4-player squad is officially confirmed for <strong>${escapeHtml(tournament.name)}</strong>.
        </p>
        
        <div class="info-card">
          <div style="font-size: 13px; font-weight: bold; color: #ff5500; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;">Tournament Schedule</div>
          <div style="color: #ffffff; font-size: 14px; line-height: 1.8;">
            📅 <strong>Date:</strong> ${escapeHtml(new Date(tournament.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }))}<br>
            ⏰ <strong>Start Time:</strong> ${escapeHtml(tournament.start_time)} (IST)<br>
            🏆 <strong>Organizer-funded Winner Prize:</strong> ₹${escapeHtml(tournament.prize_amount)}<br>
            🎟️ <strong>Registration:</strong> ₹40 per team (not used to fund the prize)<br>
            🎟️ <strong>Squad ID:</strong> #${escapeHtml(registration.id)}
          </div>
        </div>

        <div class="info-card">
          <div style="font-size: 13px; font-weight: bold; color: #00ffcc; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;">Confirmed Squad Roster</div>
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
            <thead>
              <tr style="border-bottom: 1px solid #33364d; color: #888899;">
                <th style="padding: 8px 10px;">Role</th>
                <th style="padding: 8px 10px;">Player Name</th>
                <th style="padding: 8px 10px;">Free Fire ID</th>
              </tr>
            </thead>
            <tbody>
              ${playerRows}
            </tbody>
          </table>
        </div>

        <div class="important-banner">
          <strong style="color: #ffaa33; font-size: 14px;">🚨 Custom Room ID & Password Notice:</strong>
          <p style="margin: 6px 0 0; color: #cccccc; font-size: 13px; line-height: 1.5;">
            The <strong>Custom Room ID</strong> and <strong>Room Password</strong> will be automatically sent to this email (<strong>${escapeHtml(registration.captain_email)}</strong>) exactly <strong>10 minutes before the tournament start time</strong>. Please ensure all squad members are ready to join on time.
          </p>
        </div>
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} Free Fire Arena Esports. All rights reserved.
      </div>
    </div>
  </body>
  </html>
  `;
}

// 3. Template: Room ID & Password Notification (Sent 10 minutes before match)
function getRoomCredentialsEmailHtml(tournament, roomId, roomPassword, captainName) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Room Credentials - Free Fire Arena</title>
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0c0d14; color: #ffffff; margin: 0; padding: 20px; }
      .container { max-width: 550px; margin: 0 auto; background: #161824; border: 2px solid #ff5500; border-radius: 12px; overflow: hidden; box-shadow: 0 0 25px rgba(255, 85, 0, 0.3); }
      .header { background: linear-gradient(135deg, #ff5500, #ff2a4b); padding: 25px 20px; text-align: center; }
      .header h1 { margin: 0; font-size: 26px; font-weight: 900; letter-spacing: 2px; color: #ffffff; text-transform: uppercase; }
      .header p { margin: 5px 0 0; font-size: 13px; color: #fff0f0; font-weight: bold; letter-spacing: 1px; }
      .content { padding: 30px 25px; text-align: center; }
      .match-title { font-size: 18px; font-weight: bold; color: #ffffff; margin-bottom: 5px; }
      .match-time { font-size: 14px; color: #ffaa33; margin-bottom: 25px; }
      .creds-container { background: #0c0d14; border: 1px solid #33364d; border-radius: 10px; padding: 20px; margin: 20px 0; text-align: left; }
      .cred-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 10px; border-bottom: 1px solid #222536; }
      .cred-row:last-child { border-bottom: none; }
      .cred-label { font-size: 13px; color: #888899; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
      .cred-val { font-size: 22px; font-weight: 800; color: #00ffcc; font-family: monospace; letter-spacing: 2px; }
      .action-notice { background: #261614; border-left: 4px solid #ff2a4b; padding: 15px; border-radius: 6px; text-align: left; margin-top: 25px; }
      .footer { background: #0f1018; padding: 20px; text-align: center; font-size: 12px; color: #666677; border-top: 1px solid #222433; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>FREE FIRE ARENA</h1>
        <p>⚡ CUSTOM ROOM CREDENTIALS</p>
      </div>
      <div class="content">
        <div class="match-title">${escapeHtml(tournament.name)}</div>
        <div class="match-time">
          📅 ${escapeHtml(new Date(tournament.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }))} | ⏰ Start Time: ${escapeHtml(tournament.start_time)} (IST)
        </div>
        
        <p style="color: #cccccc; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
          Hello <strong>${escapeHtml(captainName || 'Captain')}</strong>, your match is starting in <strong>10 minutes</strong>! Here are your official room credentials:
        </p>

        <div class="creds-container">
          <div class="cred-row" style="margin-bottom: 10px;">
            <span class="cred-label">Custom Room ID</span>
            <span class="cred-val">${escapeHtml(roomId)}</span>
          </div>
          <div class="cred-row">
            <span class="cred-label">Room Password</span>
            <span class="cred-val" style="color: #ff5500;">${escapeHtml(roomPassword)}</span>
          </div>
        </div>

        <div class="action-notice">
          <strong style="color: #ff5500; font-size: 14px;">⚠️ Important Rules:</strong>
          <ul style="margin: 8px 0 0; padding-left: 20px; color: #dddddd; font-size: 13px; line-height: 1.5;">
            <li>Join the room immediately in Free Fire custom lobby.</li>
            <li>Do not share these credentials with anyone outside your squad.</li>
            <li>All players must be present in the designated slot before start time.</li>
            <li>Emulators and hacks are strictly prohibited.</li>
          </ul>
        </div>
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} Free Fire Arena Esports. All rights reserved.
      </div>
    </div>
  </body>
  </html>
  `;
}

// Email Sender Functions
async function sendOtpEmail(toEmail, otp, tournamentName, captainName) {
  const html = getOtpEmailHtml(otp, tournamentName, captainName);
  const text = `Free Fire Arena OTP Verification\n\nYour 6-digit OTP for ${tournamentName} is: ${otp}\n\nThis OTP is valid for 10 minutes.\nDo not share this code with anyone.`;

  return sendEmail({
    from: process.env.EMAIL_FROM || 'Free Fire Arena <support@freefirearena.com>',
    to: toEmail,
    subject: `[${otp}] Free Fire Arena - OTP Verification Code`,
    text,
    html,
  });
}

async function sendConfirmationEmail(registration, tournament, players) {
  const html = getConfirmationEmailHtml(registration, tournament, players);
  const text = `Registration Confirmed - ${tournament.name}\n\nCaptain: ${registration.captain_name}\nSquad ID: #${registration.id}\nEntry Fee: ₹${tournament.entry_fee} Paid\n\nRoom ID and Password will be sent 10 minutes before the tournament start time (${tournament.start_time}).`;

  return sendEmail({
    from: process.env.EMAIL_FROM || 'Free Fire Arena <support@freefirearena.com>',
    to: registration.captain_email,
    subject: `Confirmed: Registration for ${tournament.name} (#${registration.id})`,
    text,
    html,
  });
}

async function sendRoomCredentialsEmail(registration, tournament, roomId, roomPassword) {
  const html = getRoomCredentialsEmailHtml(tournament, roomId, roomPassword, registration.captain_name);
  const text = `FREE FIRE ARENA - ROOM CREDENTIALS\n\nTournament: ${tournament.name}\nStart Time: ${tournament.start_time} (IST)\n\nRoom ID: ${roomId}\nRoom Password: ${roomPassword}\n\nJoin the room immediately. Do not share credentials.`;

  return sendEmail({
    from: process.env.EMAIL_FROM || 'Free Fire Arena <support@freefirearena.com>',
    to: registration.captain_email,
    subject: `🚨 ROOM ID & PASSWORD: ${tournament.name} (Match starting in 10 mins)`,
    text,
    html,
  });
}

async function sendContactMessage({ name, email, subject, message }) {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replace(/\r?\n/g, '<br>');
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@freefirearena.com';

  return sendEmail({
    from: process.env.EMAIL_FROM || 'Free Fire Arena <support@freefirearena.com>',
    to: supportEmail,
    replyTo: email,
    subject: `Free Fire Arena support: ${subject}`,
    text: `New contact form message\n\nFrom: ${name} <${email}>\nSubject: ${subject}\n\n${message}`,
    html: `
      <h2>New Free Fire Arena contact message</h2>
      <p><strong>From:</strong> ${safeName} &lt;${safeEmail}&gt;</p>
      <p><strong>Subject:</strong> ${safeSubject}</p>
      <p>${safeMessage}</p>
    `,
  });
}

async function verifyEmailConfiguration() {
  const mailer = getTransporter();
  if (typeof mailer.verify !== 'function') {
    throw new Error('SMTP is not configured; set the EMAIL_* variables before verifying delivery.');
  }
  await mailer.verify();
}

module.exports = {
  getTransporter,
  verifyEmailConfiguration,
  sendOtpEmail,
  sendConfirmationEmail,
  sendRoomCredentialsEmail,
  sendContactMessage,
};
