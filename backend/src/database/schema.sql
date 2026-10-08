-- ==========================================================
-- FREE FIRE ARENA TOURNAMENT DATABASE SCHEMA (POSTGRESQL)
-- ==========================================================

-- 1. Admins Table
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tournaments Table
CREATE TABLE IF NOT EXISTS tournaments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    start_time VARCHAR(50) NOT NULL,
    entry_fee NUMERIC(10, 2) NOT NULL DEFAULT 40.00,
    prize_amount NUMERIC(10, 2) NOT NULL DEFAULT 300.00,
    squad_size INT NOT NULL DEFAULT 4,
    max_slots INT NOT NULL DEFAULT 25,
    rules TEXT,
    registration_open BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_squad_size CHECK (squad_size > 0),
    CONSTRAINT chk_max_slots CHECK (max_slots > 0),
    CONSTRAINT chk_entry_fee CHECK (entry_fee >= 0),
    CONSTRAINT chk_prize_amount CHECK (prize_amount >= 0)
);
ALTER TABLE tournaments ALTER COLUMN prize_amount SET DEFAULT 300.00;

-- 3. Registrations Table
CREATE TABLE IF NOT EXISTS registrations (
    id SERIAL PRIMARY KEY,
    tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE RESTRICT,
    captain_name VARCHAR(255) NOT NULL,
    captain_email VARCHAR(255) NOT NULL,
    captain_phone VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    payment_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    public_access_token_hash VARCHAR(64),
    reservation_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_registration_status CHECK (status IN ('PENDING', 'OTP_VERIFIED', 'PAYMENT_PENDING', 'PAYMENT_PROCESSING', 'PAYMENT_FAILED', 'CONFIRMED', 'CANCELLED', 'FAILED')),
    CONSTRAINT chk_payment_status CHECK (payment_status IN ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED', 'UTR_SUBMITTED', 'VERIFIED', 'REJECTED'))
);
ALTER TABLE registrations
    ADD COLUMN IF NOT EXISTS public_access_token_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMP WITH TIME ZONE;

-- 4. Players Table
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    registration_id INT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    player_number INT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    free_fire_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_player_number CHECK (player_number BETWEEN 1 AND 4),
    CONSTRAINT unq_registration_player_number UNIQUE (registration_id, player_number)
);

-- 5. OTP Verifications Table
CREATE TABLE IF NOT EXISTS otp_verifications (
    id SERIAL PRIMARY KEY,
    registration_id INT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    registration_id INT NOT NULL REFERENCES registrations(id) ON DELETE RESTRICT,
    tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE RESTRICT,
    order_id VARCHAR(255) NOT NULL,
    provider_order_id VARCHAR(255),
    provider_transaction_id VARCHAR(255),
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    payment_method VARCHAR(50),
    provider VARCHAR(50) NOT NULL,
    utr VARCHAR(64),
    submitted_at TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by INT REFERENCES admins(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    payment_url TEXT,
    qr_code_url TEXT,
    qr_code_data TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    status_checked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_payments_status CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED', 'CANCELLED', 'UTR_SUBMITTED', 'VERIFIED', 'REJECTED')),
    CONSTRAINT chk_payments_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_payments_currency_inr CHECK (currency = 'INR'),
    CONSTRAINT chk_manual_upi_amount CHECK (provider <> 'manual_upi' OR (amount = 40.00 AND currency = 'INR' AND payment_method = 'UPI_QR'))
);
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS tournament_id INT REFERENCES tournaments(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS provider VARCHAR(50) NOT NULL DEFAULT 'legacy_gateway',
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS payment_url TEXT,
    ADD COLUMN IF NOT EXISTS qr_code_url TEXT,
    ADD COLUMN IF NOT EXISTS qr_code_data TEXT,
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS status_checked_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS order_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS provider_order_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS provider_transaction_id VARCHAR(255);

-- 7. Payment Events Table (provider event IDs make webhook handling idempotent)
CREATE TABLE IF NOT EXISTS payment_events (
    id SERIAL PRIMARY KEY,
    payment_id INT REFERENCES payments(id) ON DELETE SET NULL,
    provider VARCHAR(50) NOT NULL,
    event_id VARCHAR(255),
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE payment_events
    ADD COLUMN IF NOT EXISTS received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- 8. Room Credentials Table (Private - Admin Only)
CREATE TABLE IF NOT EXISTS room_credentials (
    id SERIAL PRIMARY KEY,
    tournament_id INT UNIQUE NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    room_id VARCHAR(100) NOT NULL,
    room_password VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Email Logs Table (With Idempotency Unique Constraint)
CREATE TABLE IF NOT EXISTS email_logs (
    id SERIAL PRIMARY KEY,
    registration_id INT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    email_type VARCHAR(50) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    provider_message_id VARCHAR(255),
    sent_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unq_email_send_log UNIQUE (registration_id, tournament_id, email_type)
);

-- Indexes for performance & frequent queries
CREATE INDEX IF NOT EXISTS idx_tournaments_date ON tournaments(date, registration_open);
CREATE INDEX IF NOT EXISTS idx_registrations_tournament ON registrations(tournament_id, status);
CREATE INDEX IF NOT EXISTS idx_registrations_captain_email ON registrations(captain_email);
CREATE INDEX IF NOT EXISTS idx_players_free_fire_id ON players(free_fire_id);
CREATE INDEX IF NOT EXISTS idx_otp_registration ON otp_verifications(registration_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(tournament_id, email_type, status);
