async function migrateTournamentRemodel(client) {
  const invalidSquadAssignments = await client.query(`
    SELECT COUNT(*)::int AS count
    FROM registrations
    WHERE (status = 'CONFIRMED' AND squad_number IS NULL)
       OR (status <> 'CONFIRMED' AND squad_number IS NOT NULL)
  `);
  if (Number(invalidSquadAssignments.rows[0]?.count || 0) > 0) {
    throw new Error(
      'Tournament remodel migration stopped: existing squad numbers do not match registration statuses. Review the affected records before retrying.'
    );
  }

  await client.query(`
    ALTER TABLE tournaments
      ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS map VARCHAR(100),
      ADD COLUMN IF NOT EXISTS game_mode VARCHAR(100),
      ADD COLUMN IF NOT EXISTS eligibility_requirements TEXT,
      ADD COLUMN IF NOT EXISTS tournament_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
    ALTER TABLE email_login_otps
      ADD COLUMN IF NOT EXISTS registration_intent BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS otp_purpose VARCHAR(20) NOT NULL DEFAULT 'player';

    ALTER TABLE tournaments
      ALTER COLUMN entry_fee DROP DEFAULT,
      ALTER COLUMN prize_amount DROP DEFAULT,
      ALTER COLUMN max_slots SET DEFAULT 13;

    ALTER TABLE tournaments
      DROP CONSTRAINT IF EXISTS chk_next_squad_number;
    ALTER TABLE tournaments
      ADD CONSTRAINT chk_next_squad_number CHECK (next_squad_number >= 1);

    ALTER TABLE registrations
      DROP CONSTRAINT IF EXISTS chk_squad_number,
      DROP CONSTRAINT IF EXISTS chk_confirmed_squad_assignment;
    ALTER TABLE registrations
      ADD CONSTRAINT chk_squad_number
        CHECK (squad_number IS NULL OR squad_number >= 1),
      ADD CONSTRAINT chk_confirmed_squad_assignment
        CHECK (
          (status = 'CONFIRMED' AND squad_number IS NOT NULL)
          OR (status <> 'CONFIRMED' AND squad_number IS NULL)
        );

    ALTER TABLE payments
      DROP CONSTRAINT IF EXISTS chk_manual_upi_amount;
    ALTER TABLE payments
      ADD CONSTRAINT chk_manual_upi_amount
        CHECK (provider <> 'manual_upi' OR (amount > 0 AND currency = 'INR' AND payment_method = 'UPI_QR'));

  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS tournament_results (
      id BIGSERIAL PRIMARY KEY,
      tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE RESTRICT,
      registration_id INT NOT NULL REFERENCES registrations(id) ON DELETE RESTRICT,
      placement INT NOT NULL,
      prize_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
      details TEXT NOT NULL DEFAULT '',
      status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
      published_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tournament_id, registration_id)
    );

    CREATE TABLE IF NOT EXISTS tournament_result_history (
      id BIGSERIAL PRIMARY KEY,
      tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE RESTRICT,
      result_id BIGINT REFERENCES tournament_results(id) ON DELETE SET NULL,
      admin_id INT REFERENCES admins(id) ON DELETE SET NULL,
      action VARCHAR(30) NOT NULL,
      result_snapshot JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id BIGSERIAL PRIMARY KEY,
      admin_id INT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id BIGSERIAL PRIMARY KEY,
      admin_id INT REFERENCES admins(id) ON DELETE SET NULL,
      action VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id BIGINT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity
      ON admin_audit_logs(entity_type, entity_id, created_at DESC);
  `);
  await client.query(`
    ALTER TABLE tournament_results
      DROP CONSTRAINT IF EXISTS chk_tournament_results_placement,
      DROP CONSTRAINT IF EXISTS chk_tournament_results_prize,
      DROP CONSTRAINT IF EXISTS chk_tournament_results_status;
    ALTER TABLE tournament_results
      ADD CONSTRAINT chk_tournament_results_placement CHECK (placement > 0),
      ADD CONSTRAINT chk_tournament_results_prize CHECK (prize_amount >= 0),
      ADD CONSTRAINT chk_tournament_results_status CHECK (status IN ('DRAFT', 'PUBLISHED'));
  `);
  await client.query(`
    ALTER TABLE tournaments
      DROP CONSTRAINT IF EXISTS chk_tournament_status;
    ALTER TABLE tournaments
      ADD CONSTRAINT chk_tournament_status
        CHECK (tournament_status IN ('ACTIVE', 'CANCELLED'));

    CREATE INDEX IF NOT EXISTS idx_tournament_results_public
      ON tournament_results(tournament_id, status, placement);
    CREATE INDEX IF NOT EXISTS idx_tournament_result_history_tournament
      ON tournament_result_history(tournament_id, created_at DESC);
  `);

  const duplicates = await client.query(`
    SELECT tournament_id, LOWER(captain_email) AS captain_email, COUNT(*)::int AS count
    FROM registrations
    GROUP BY tournament_id, LOWER(captain_email)
    HAVING COUNT(*) > 1
    LIMIT 1
  `);
  if (duplicates.rows.length) {
    throw new Error(
      'Tournament remodel migration stopped: duplicate captain registrations exist for one tournament; review them before adding the duplicate-prevention constraint.'
    );
  }
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_tournament_captain_unique
      ON registrations(tournament_id, LOWER(captain_email))
  `);

}

module.exports = { migrateTournamentRemodel };
