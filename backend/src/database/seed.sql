-- ==========================================================
-- FREE FIRE ARENA INITIAL SEED DATA
-- ==========================================================

-- Initial Admin Account (Password: admin123456)
-- Hash: $2a$10$yja1BUiuhgtI79t7D.xLuOUfY.YHfjxxFsKvIvCSY8PrwCCMq.W0a
INSERT INTO admins (email, password_hash)
VALUES ('admin@freefirearena.com', '$2a$10$yja1BUiuhgtI79t7D.xLuOUfY.YHfjxxFsKvIvCSY8PrwCCMq.W0a')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

-- Initial Tournaments
INSERT INTO tournaments (name, description, date, start_time, entry_fee, prize_amount, squad_size, max_slots, rules, registration_open)
VALUES 
(
    'FREE FIRE BR #1',
    'Official Battle Royale 4v4 Squad Clash. Map: Bermuda / Purgatory. All verified captains will receive Custom Room ID and Password 10 minutes prior to match time.',
    CURRENT_DATE + INTERVAL '5 days',
    '08:00 PM',
    40.00,
    1000.00,
    4,
    25,
    '1. Exactly 4 players per squad.\n2. Emulators and iPad/tablets are strictly prohibited (Mobile only).\n3. Gun attributes are disabled.\n4. Character skills are allowed.\n5. Room ID and password will be sent to the captain verified email 10 minutes before the match.\n6. All players must enter the assigned slot on time. Late entries forfeit their entry.',
    TRUE
),
(
    'FREE FIRE BR PRO SHOWDOWN',
    'High-stakes weekend championship tournament for top esports squads. Map: Kalahari & Bermuda.',
    CURRENT_DATE + INTERVAL '10 days',
    '09:00 PM',
    40.00,
    2000.00,
    4,
    25,
    '1. Mobile devices only.\n2. Toxic behavior, stream sniping or cheating results in permanent ban and prize forfeiture.\n3. Room credentials sent 10 minutes before start time.\n4. Screenshot of final match standings required for verification.',
    TRUE
),
(
    'FREE FIRE WEEKEND CLASH',
    'Fast-paced weekend squad tournament with instant prize distribution to the champions.',
    CURRENT_DATE + INTERVAL '14 days',
    '07:30 PM',
    40.00,
    1500.00,
    4,
    25,
    '1. 4 Players squad battle royale.\n2. Strict anti-cheat monitoring in effect.\n3. Verified captain email receives room credentials 10 mins prior.',
    TRUE
)
ON CONFLICT DO NOTHING;
