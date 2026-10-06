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
    prize_amount NUMERIC(10, 2) NOT NULL DEFAULT 1000.00,
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_registration_status CHECK (status IN ('PENDING', 'OTP_VERIFIED', 'PAYMENT_PENDING', 'CONFIRMED', 'CANCELLED', 'FAILED')),
    CONSTRAINT chk_payment_status CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED'))
);

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
    razorpay_order_id VARCHAR(255) UNIQUE,
    razorpay_payment_id VARCHAR(255) UNIQUE,
    razorpay_signature VARCHAR(255),
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_pay_status CHECK (status IN ('CREATED', 'SUCCESS', 'FAILED', 'VERIFIED'))
);

-- 7. Room Credentials Table (Private - Admin Only)
CREATE TABLE IF NOT EXISTS room_credentials (
    id SERIAL PRIMARY KEY,
    tournament_id INT UNIQUE NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    room_id VARCHAR(100) NOT NULL,
    room_password VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Email Logs Table (With Idempotency Unique Constraint)
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
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(tournament_id, email_type, status);
