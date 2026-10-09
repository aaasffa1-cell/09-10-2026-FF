async function migrateCustomerAuthAndSquads(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS email_users (
      email VARCHAR(255) PRIMARY KEY,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS email_login_otps (
      id BIGSERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      otp_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      consumed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_email_login_otps_email_created
      ON email_login_otps(email, created_at DESC);

    CREATE TABLE IF NOT EXISTS email_otp_rate_limits (
      email VARCHAR(255) PRIMARY KEY,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id BIGSERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL REFERENCES email_users(email) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS room_email_attempts (
      id BIGSERIAL PRIMARY KEY,
      registration_id INT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
      tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      admin_id INT REFERENCES admins(id) ON DELETE SET NULL,
      attempt_number INT NOT NULL,
      status VARCHAR(20) NOT NULL,
      initiated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP WITH TIME ZONE,
      provider_message_id VARCHAR(255),
      provider_response TEXT,
      last_error TEXT,
      CONSTRAINT chk_room_email_attempt_status
        CHECK (status IN ('EMAIL_PENDING', 'EMAIL_SENT', 'EMAIL_FAILED'))
    );
    CREATE INDEX IF NOT EXISTS idx_room_email_attempts_registration
      ON room_email_attempts(registration_id, tournament_id, attempt_number DESC);

    ALTER TABLE registrations
      ADD COLUMN IF NOT EXISTS squad_number INT;
    ALTER TABLE tournaments
      ADD COLUMN IF NOT EXISTS next_squad_number INT NOT NULL DEFAULT 1;
    ALTER TABLE email_logs
      ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS provider_response TEXT,
      ADD COLUMN IF NOT EXISTS admin_id INT REFERENCES admins(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS initiated_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE registrations DROP CONSTRAINT IF EXISTS chk_registration_status;
    ALTER TABLE registrations
      ADD CONSTRAINT chk_registration_status
        CHECK (status IN ('PENDING', 'OTP_VERIFIED', 'PAYMENT_PENDING', 'PAYMENT_PROCESSING', 'PAYMENT_FAILED', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'FAILED'));
  `);

  const confirmed = await client.query(`
    SELECT tournament_id
    FROM registrations
    WHERE status = 'CONFIRMED'
  `);
  const confirmedByTournament = new Map();
  for (const registration of confirmed.rows) {
    const count = (confirmedByTournament.get(registration.tournament_id) || 0) + 1;
    confirmedByTournament.set(registration.tournament_id, count);
    if (count > 13) {
      throw new Error(`Squad numbering migration stopped: tournament ${registration.tournament_id} has more than 13 confirmed squads and needs manual capacity review.`);
    }
  }

  const orderedRegistrations = await client.query(`
    SELECT r.id, r.tournament_id
    FROM registrations r
    LEFT JOIN payments p
      ON p.registration_id = r.id
     AND p.provider = 'manual_upi'
     AND p.status = 'VERIFIED'
    WHERE r.status = 'CONFIRMED'
    ORDER BY r.tournament_id, p.verified_at ASC, r.created_at ASC, r.id ASC
  `);
  const squadNumbers = new Map();
  for (const registration of orderedRegistrations.rows) {
    const nextNumber = (squadNumbers.get(registration.tournament_id) || 0) + 1;
    squadNumbers.set(registration.tournament_id, nextNumber);
    await client.query(
      `UPDATE registrations SET squad_number = $1
       WHERE id = $2 AND squad_number IS NULL`,
      [nextNumber, registration.id]
    );
  }

  const tournaments = await client.query(`SELECT id FROM tournaments`);
  for (const tournament of tournaments.rows) {
    const lastSquadResult = await client.query(
      `SELECT COALESCE(MAX(squad_number), 0)::int AS last_number
       FROM registrations
       WHERE tournament_id = $1 AND status = 'CONFIRMED'`,
      [tournament.id]
    );
    await client.query(
      `UPDATE tournaments SET next_squad_number = $1 WHERE id = $2`,
      [lastSquadResult.rows[0].last_number + 1, tournament.id]
    );
  }

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_tournament_squad_number
      ON registrations(tournament_id, squad_number)
      WHERE squad_number IS NOT NULL;
    ALTER TABLE registrations DROP CONSTRAINT IF EXISTS chk_squad_number;
    ALTER TABLE registrations
      ADD CONSTRAINT chk_squad_number
      CHECK (squad_number IS NULL OR squad_number BETWEEN 1 AND 13);
    ALTER TABLE registrations DROP CONSTRAINT IF EXISTS chk_confirmed_squad_assignment;
    ALTER TABLE registrations
      ADD CONSTRAINT chk_confirmed_squad_assignment
      CHECK (
        (status = 'CONFIRMED' AND squad_number BETWEEN 1 AND 13)
        OR (status <> 'CONFIRMED' AND squad_number IS NULL)
      );
    ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS chk_next_squad_number;
    ALTER TABLE tournaments
      ADD CONSTRAINT chk_next_squad_number CHECK (next_squad_number BETWEEN 1 AND 14);
  `);
}

module.exports = { migrateCustomerAuthAndSquads };
