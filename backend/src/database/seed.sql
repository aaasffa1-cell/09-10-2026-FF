-- Tournament seed rows are inserted only when their name is not already present.
INSERT INTO tournaments
  (name, description, date, start_time, entry_fee, prize_amount, squad_size, max_slots, rules, registration_open)
SELECT
  'FREE FIRE BR #1',
  'Official Battle Royale 4-player squad clash. Winner prize ₹300, funded separately by the tournament organizer. Map: Bermuda / Purgatory. All verified captains will receive Custom Room ID and Password 10 minutes prior to match time.',
  CURRENT_DATE + INTERVAL '5 days',
  '08:00 PM',
  40.00,
  300.00,
  4,
  13,
  '1. Exactly 4 players per squad.\n2. Emulators and iPad/tablets are strictly prohibited (Mobile only).\n3. Gun attributes are disabled.\n4. Character skills are allowed.\n5. Room ID and password will be sent to the captain verified email 10 minutes before the match.\n6. All players must enter the assigned slot on time. Late entries forfeit their entry.',
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM tournaments WHERE name = 'FREE FIRE BR #1');

INSERT INTO tournaments
  (name, description, date, start_time, entry_fee, prize_amount, squad_size, max_slots, rules, registration_open)
SELECT
  'FREE FIRE BR PRO SHOWDOWN',
  'Weekend championship tournament for top esports squads. Winner prize ₹300, funded separately by the tournament organizer. Map: Kalahari & Bermuda.',
  CURRENT_DATE + INTERVAL '10 days',
  '09:00 PM',
  40.00,
  300.00,
  4,
  13,
  '1. Mobile devices only.\n2. Toxic behavior, stream sniping or cheating results in permanent ban and prize forfeiture.\n3. Room credentials sent 10 minutes before start time.\n4. Screenshot of final match standings required for verification.',
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM tournaments WHERE name = 'FREE FIRE BR PRO SHOWDOWN');

INSERT INTO tournaments
  (name, description, date, start_time, entry_fee, prize_amount, squad_size, max_slots, rules, registration_open)
SELECT
  'FREE FIRE WEEKEND CLASH',
  'Fast-paced weekend squad tournament with a separately organizer-funded ₹300 winner prize.',
  CURRENT_DATE + INTERVAL '14 days',
  '07:30 PM',
  40.00,
  300.00,
  4,
  13,
  '1. 4 Players squad battle royale.\n2. Strict anti-cheat monitoring in effect.\n3. Verified captain email receives room credentials 10 mins prior.',
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM tournaments WHERE name = 'FREE FIRE WEEKEND CLASH');
