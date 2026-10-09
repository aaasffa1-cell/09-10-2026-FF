import React from 'react';
import { Link } from 'react-router-dom';
import { Flame, ShieldCheck, Mail, Headphones, Lock } from 'lucide-react';

export default function Footer() {
  return (
    <footer style={{
      background: '#090a0f',
      borderTop: '1px solid var(--border-subtle)',
      padding: '50px 0 30px',
      marginTop: '60px',
      color: 'var(--text-muted)',
    }}>
      <div className="container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '40px',
          marginBottom: '40px',
        }}>
          {/* Brand Col */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #ff5500, #ff2a4b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Flame color="#ffffff" size={20} />
              </div>
              <span style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '18px',
                fontWeight: 900,
                color: '#ffffff',
                letterSpacing: '1px',
              }}>
                FREE FIRE <span style={{ color: 'var(--accent-orange)' }}>ARENA</span>
              </span>
            </div>
            <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-dim)', marginBottom: '15px' }}>
              The premier Battle Royale esports tournament platform. Compete with your 4-player squad for a ₹40 registration fee and an organizer-funded winner prize.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--accent-cyan)' }}>
              <ShieldCheck size={16} /> 100% Anti-Cheat & Fair Play Verified
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 style={{ fontSize: '14px', color: '#ffffff', marginBottom: '16px', letterSpacing: '1.5px' }}>
              QUICK LINKS
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <li><Link to="/tournaments" style={{ color: 'var(--text-muted)' }}>Browse Tournaments</Link></li>
              <li><Link to="/rules" style={{ color: 'var(--text-muted)' }}>Official Rules & Scoring</Link></li>
              <li><Link to="/contact" style={{ color: 'var(--text-muted)' }}>Contact & Support</Link></li>
              <li><Link to="/admin/login" style={{ color: 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Lock size={12} /> Admin Portal</Link></li>
            </ul>
          </div>

          {/* Tournament Safety & Room Notice */}
          <div>
            <h4 style={{ fontSize: '14px', color: '#ffffff', marginBottom: '16px', letterSpacing: '1.5px' }}>
              MATCH PROTOCOL
            </h4>
            <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-dim)' }}>
              🔒 <strong>Private Credentials:</strong> Room ID & Password are sent strictly to the captain's verified email <strong>10 minutes prior</strong> to match time.
            </p>
            <div style={{
              marginTop: '15px',
              background: '#13151f',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid #202438',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <Headphones size={16} color="var(--accent-orange)" />
              <span>Support: <a href="mailto:aasffa1@gmail.com" style={{ color: 'inherit' }}>aasffa1@gmail.com</a> · <a href="https://t.me/gaiusmorgan901" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>Telegram @gaiusmorgan901</a></span>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          paddingTop: '25px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '15px',
          fontSize: '12px',
          color: 'var(--text-dim)',
        }}>
          <div>
            &copy; {new Date().getFullYear()} Free Fire Arena. All rights reserved. Free Fire is a registered trademark of Garena. This tournament platform is an independent community esports organizer.
          </div>
          <div>
            Timezone: <strong>Asia/Kolkata (IST)</strong>
          </div>
        </div>
      </div>
    </footer>
  );
}
