import React from 'react';
import { ShieldCheck, Smartphone, Trophy, MailCheck, AlertTriangle, IndianRupee, Ban } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Rules() {
  return (
    <div style={{ padding: '40px 0 80px' }}>
      <div className="container" style={{ maxWidth: '900px' }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div className="badge badge-gold" style={{ marginBottom: '10px' }}>
            OFFICIAL RULEBOOK
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 42px)', marginBottom: '10px' }}>
            RULES & PRIZE POLICIES
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
            Standard rules governing all Free Fire Battle Royale (BR) Squad Tournaments on Free Fire Arena.
          </p>
        </div>

        {/* Section 1: Device & Game Settings */}
        <div className="ffa-card" style={{ padding: '30px', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            <div style={{ background: 'rgba(255, 85, 0, 0.15)', padding: '10px', borderRadius: '8px', color: 'var(--accent-orange)' }}>
              <Smartphone size={22} />
            </div>
            <h2 style={{ fontSize: '20px', color: '#ffffff' }}>1. DEVICE & GAMEPLAY RESTRICTIONS</h2>
          </div>

          <ul style={{ paddingLeft: '20px', color: '#d1d5db', fontSize: '14px', lineHeight: '1.8' }}>
            <li><strong>Mobile Devices Only:</strong> All players must play on legitimate Android or iOS smartphones.</li>
            <li><strong>Emulators Prohibited:</strong> PC Emulators (BlueStacks, LDPlayer, Gameloop, etc.) and iPads/Tablets are strictly forbidden.</li>
            <li><strong>Squad Size:</strong> Exactly 4 players per squad. Solo or trio entries are not permitted in squad matches.</li>
            <li><strong>Gun Attributes:</strong> Gun attributes are <strong>OFF</strong> for competitive integrity.</li>
            <li><strong>Character Skills:</strong> Character skills are <strong>ON</strong>.</li>
            <li><strong>Loadout / Airdrop:</strong> Standard esports competitive settings apply.</li>
          </ul>
        </div>

        {/* Section 2: Room ID & Joining Protocol */}
        <div className="ffa-card" style={{ padding: '30px', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            <div style={{ background: 'rgba(0, 255, 204, 0.12)', padding: '10px', borderRadius: '8px', color: 'var(--accent-cyan)' }}>
              <MailCheck size={22} />
            </div>
            <h2 style={{ fontSize: '20px', color: '#ffffff' }}>2. ROOM CREDENTIALS DELIVERY & JOINING</h2>
          </div>

          <ul style={{ paddingLeft: '20px', color: '#d1d5db', fontSize: '14px', lineHeight: '1.8' }}>
            <li><strong>10-Minute Delivery:</strong> Custom Room ID and Password will be emailed automatically to the verified captain's email address <strong>exactly 10 minutes prior</strong> to match start time.</li>
            <li><strong>Confidentiality:</strong> Do not share room credentials with non-squad members. Leaking room credentials will lead to disqualification.</li>
            <li><strong>Slot Position:</strong> Squads must sit in their designated slot number as specified in their confirmation.</li>
            <li><strong>Punctuality:</strong> Matches start strictly on time. If a player or squad fails to join before match launch, the slot is forfeited and no refund is issued.</li>
          </ul>
        </div>

        {/* Section 3: Scoring & Point System */}
        <div className="ffa-card" style={{ padding: '30px', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            <div style={{ background: 'rgba(255, 183, 0, 0.15)', padding: '10px', borderRadius: '8px', color: 'var(--accent-gold)' }}>
              <Trophy size={22} />
            </div>
            <h2 style={{ fontSize: '20px', color: '#ffffff' }}>3. OFFICIAL BR POINT SYSTEM</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '15px' }}>
            <div style={{ background: '#0e1018', padding: '16px', borderRadius: '8px', border: '1px solid #1f2336' }}>
              <div style={{ color: 'var(--accent-gold)', fontWeight: 800, fontSize: '14px', marginBottom: '8px' }}>
                PLACEMENT POINTS
              </div>
              <ul style={{ listStyle: 'none', fontSize: '13px', color: '#cccccc', lineHeight: '1.7' }}>
                <li>🥇 1st Place (Booyah): <strong>12 Points</strong></li>
                <li>🥈 2nd Place: <strong>9 Points</strong></li>
                <li>🥉 3rd Place: <strong>8 Points</strong></li>
                <li>4th Place: <strong>7 Points</strong></li>
                <li>5th Place: <strong>6 Points</strong></li>
                <li>6th Place: <strong>5 Points</strong></li>
                <li>7th Place: <strong>4 Points</strong></li>
                <li>8th Place: <strong>3 Points</strong></li>
                <li>9th Place: <strong>2 Points</strong></li>
                <li>10th Place: <strong>1 Point</strong></li>
                <li>11th-12th Place: <strong>0 Points</strong></li>
              </ul>
            </div>

            <div style={{ background: '#0e1018', padding: '16px', borderRadius: '8px', border: '1px solid #1f2336' }}>
              <div style={{ color: 'var(--accent-orange)', fontWeight: 800, fontSize: '14px', marginBottom: '8px' }}>
                KILL POINTS
              </div>
              <p style={{ fontSize: '13px', color: '#cccccc', lineHeight: '1.6' }}>
                Each Kill = <strong>1 Point</strong>.
              </p>
              <div style={{ marginTop: '15px', color: 'var(--accent-cyan)', fontWeight: 800, fontSize: '14px', marginBottom: '8px' }}>
                TIE-BREAKER RULE
              </div>
              <p style={{ fontSize: '13px', color: '#cccccc', lineHeight: '1.6' }}>
                In case of a points tie, ranking will be determined by:
                <br />1. Total Booyahs (1st placements)
                <br />2. Total Kill count
                <br />3. Highest placement in the final match.
              </p>
            </div>
          </div>
        </div>

        {/* Section 4: Anti-Cheat & Code of Conduct */}
        <div className="ffa-card" style={{ padding: '30px', marginBottom: '35px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            <div style={{ background: 'rgba(255, 42, 75, 0.15)', padding: '10px', borderRadius: '8px', color: 'var(--accent-red)' }}>
              <Ban size={22} />
            </div>
            <h2 style={{ fontSize: '20px', color: '#ffffff' }}>4. ANTI-CHEAT & FAIR PLAY ENFORCEMENT</h2>
          </div>

          <ul style={{ paddingLeft: '20px', color: '#d1d5db', fontSize: '14px', lineHeight: '1.8' }}>
            <li><strong>Zero Tolerance for Cheating:</strong> Any use of third-party modifications, aimbots, wallhacks, APK mods, or scripts will result in an instant permanent hardware/IP ban and immediate legal reporting.</li>
            <li><strong>Teaming & Stream Sniping:</strong> Teaming with opposing squads or stream sniping will lead to instant match disqualification and forfeiture of all registration fees and prizes.</li>
            <li><strong>Screenshot Proof:</strong> The winning squad captain must capture a clear end-game results screenshot for prize verification.</li>
          </ul>
        </div>

        {/* CTA Button */}
        <div style={{ textAlign: 'center' }}>
          <Link to="/tournaments" className="btn btn-primary btn-lg">
            BROWSE UPCOMING TOURNAMENTS
          </Link>
        </div>
      </div>
    </div>
  );
}
