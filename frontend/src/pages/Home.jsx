import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTournaments } from '../services/api';
import { 
  Flame, 
  Trophy, 
  Users, 
  Clock, 
  IndianRupee, 
  ShieldCheck, 
  MailCheck, 
  ChevronRight, 
  Gamepad2, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Home() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTournaments()
      .then(data => setTournaments(data.slice(0, 3)))
      .catch(err => console.error('Failed to load tournaments:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* ================= HERO SECTION ================= */}
      <section style={{
        position: 'relative',
        padding: '70px 0 60px',
        overflow: 'hidden',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        {/* Glow ambient lights */}
        <div style={{
          position: 'absolute',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '350px',
          background: 'radial-gradient(ellipse, rgba(255, 85, 0, 0.22) 0%, transparent 70%)',
          filter: 'blur(50px)',
          zIndex: 0,
          pointerEvents: 'none',
        }} />

        <div className="container" style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          {/* Top Pill Tag */}
          <div style={{ display: 'inline-flex', marginBottom: '20px' }}>
            <div className="badge badge-gold" style={{ padding: '6px 16px', fontSize: '12px', gap: '8px' }}>
              <Flame size={14} /> BR ESPORTS TOURNAMENTS
            </div>
          </div>

          {/* Main Hero Headings */}
          <h1 style={{
            fontSize: 'clamp(32px, 6vw, 56px)',
            fontWeight: 900,
            letterSpacing: '2px',
            lineHeight: 1.1,
            marginBottom: '16px',
            textTransform: 'uppercase',
          }}>
            FREE FIRE <span style={{
              background: 'linear-gradient(135deg, #ff5500, #ff2a4b)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>ARENA</span>
          </h1>

          <div style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(18px, 3vw, 24px)',
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '1px',
            marginBottom: '24px',
            textTransform: 'uppercase',
          }}>
            "COMPETE IN FREE FIRE ESPORTS TOURNAMENTS"
          </div>

          {/* Tournament Overview Card */}
          <div style={{
            maxWidth: '680px',
            margin: '0 auto 35px',
            background: 'rgba(20, 23, 36, 0.75)',
            border: '1px solid rgba(255, 85, 0, 0.3)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px 28px',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
            textAlign: 'left',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(255, 85, 0, 0.15)', padding: '8px', borderRadius: '8px', color: 'var(--accent-orange)' }}>
                  <Users size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Squad Size</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>4 Players Squad</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(0, 230, 118, 0.15)', padding: '8px', borderRadius: '8px', color: 'var(--accent-green)' }}>
                  <IndianRupee size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Entry Fee</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>₹40 Per Squad</div>
                </div>
              </div>
            </div>

            <div style={{
              background: '#0c0e17',
              borderLeft: '4px solid var(--accent-orange)',
              padding: '12px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#d1d5db',
              lineHeight: 1.5,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}>
              <MailCheck size={18} color="var(--accent-orange)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Automatic Room Access:</strong> Room ID and Password will be sent to the captain's verified email <strong>10 minutes before the tournament</strong>.
              </div>
            </div>
          </div>

          {/* Main Action Buttons */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
          }}>
            <Link to="/tournaments" className="btn btn-primary btn-lg pulse-glow">
              <Gamepad2 size={22} />
              BROWSE TOURNAMENTS
            </Link>
            <Link to="/rules" className="btn btn-secondary btn-lg">
              <Trophy size={22} color="var(--accent-gold)" />
              VIEW RULES & PRIZES
            </Link>
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section style={{ padding: '60px 0', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div className="badge badge-gold" style={{ marginBottom: '10px' }}>SIMPLE WORKFLOW</div>
            <h2 style={{ fontSize: '28px', color: '#ffffff' }}>HOW TO PARTICIPATE</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>
              Register and compete in 4 simple steps
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px',
          }}>
            {[
              {
                step: '01',
                title: 'SELECT MATCH',
                desc: 'Browse available Battle Royale tournaments and choose your preferred match schedule.',
                icon: Trophy,
              },
              {
                step: '02',
                title: 'REGISTER 4 PLAYERS',
                desc: 'Enter captain details (Name, Email, Phone, Free Fire UID) along with Player 2, 3, and 4 info.',
                icon: Users,
              },
              {
                step: '03',
                title: 'VERIFY OTP & PAY ₹40',
                desc: 'Verify captain email with a secure 6-digit OTP, then complete ₹40 entry payment via Razorpay.',
                icon: ShieldCheck,
              },
              {
                step: '04',
                title: 'RECEIVE ROOM ID',
                desc: 'Custom Room ID & Password arrive in captain verified email exactly 10 minutes prior to match.',
                icon: MailCheck,
              },
            ].map((card, index) => {
              const Icon = card.icon;
              return (
                <div key={index} className="ffa-card" style={{ padding: '25px', position: 'relative' }}>
                  <div style={{
                    fontSize: '28px',
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 900,
                    color: 'rgba(255, 255, 255, 0.08)',
                    position: 'absolute',
                    top: '15px',
                    right: '20px',
                  }}>
                    {card.step}
                  </div>
                  <div style={{
                    width: '45px',
                    height: '45px',
                    borderRadius: '10px',
                    background: 'rgba(255, 85, 0, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-orange)',
                    marginBottom: '18px',
                    border: '1px solid rgba(255, 85, 0, 0.25)',
                  }}>
                    <Icon size={22} />
                  </div>
                  <h3 style={{ fontSize: '16px', marginBottom: '10px', color: '#ffffff' }}>{card.title}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>{card.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= UPCOMING TOURNAMENTS PREVIEW ================= */}
      <section style={{ padding: '60px 0' }}>
        <div className="container">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '15px',
            marginBottom: '35px',
          }}>
            <div>
              <div className="badge badge-open" style={{ marginBottom: '8px' }}>LIVE MATCHES</div>
              <h2 style={{ fontSize: '28px' }}>FEATURED TOURNAMENTS</h2>
            </div>
            <Link to="/tournaments" className="btn btn-outline btn-sm">
              VIEW ALL MATCHES <ChevronRight size={16} />
            </Link>
          </div>

          {loading ? (
            <LoadingSpinner message="Loading live tournaments..." />
          ) : tournaments.length === 0 ? (
            <div className="ffa-card" style={{ padding: '40px', textAlign: 'center' }}>
              <AlertCircle size={36} color="var(--accent-orange)" style={{ margin: '0 auto 15px' }} />
              <h3>No Upcoming Tournaments Scheduled</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '14px' }}>
                New match schedules will be announced shortly. Check back soon!
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px',
            }}>
              {tournaments.map(t => {
                const isOpen = t.status === 'OPEN';
                const isFull = t.status === 'SLOTS_FULL';

                return (
                  <div key={t.id} className="ffa-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* Header */}
                    <div style={{
                      padding: '20px',
                      background: 'linear-gradient(180deg, rgba(255, 85, 0, 0.08) 0%, transparent 100%)',
                      borderBottom: '1px solid var(--border-card)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}>
                      <div>
                        <h3 style={{ fontSize: '18px', color: '#ffffff', marginBottom: '4px' }}>{t.name}</h3>
                        <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                          Squad Size: <strong>{t.squadSize} Players</strong>
                        </div>
                      </div>
                      {isOpen ? (
                        <span className="badge badge-open">REGISTER NOW</span>
                      ) : isFull ? (
                        <span className="badge badge-full">SLOTS FULL</span>
                      ) : (
                        <span className="badge badge-closed">REGISTRATION CLOSED</span>
                      )}
                    </div>

                    {/* Body */}
                    <div style={{ padding: '20px', flex: 1 }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '14px',
                        marginBottom: '18px',
                      }}>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Date</div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
                            {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Start Time</div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent-orange)' }}>
                            {t.startTime} IST
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Entry Fee</div>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-green)' }}>
                            ₹{t.entryFee}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Prize Pool</div>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-gold)' }}>
                            ₹{t.prizeAmount}
                          </div>
                        </div>
                      </div>

                      {/* Slots Progress */}
                      <div style={{ marginBottom: '18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Confirmed Slots</span>
                          <span style={{ fontWeight: 700, color: '#ffffff' }}>
                            {t.confirmedSlots} / {t.maxSlots} Squads
                          </span>
                        </div>
                        <div style={{
                          height: '6px',
                          background: '#0c0d14',
                          borderRadius: '3px',
                          overflow: 'hidden',
                          border: '1px solid #202438',
                        }}>
                          <div style={{
                            width: `${Math.min(100, (t.confirmedSlots / t.maxSlots) * 100)}%`,
                            height: '100%',
                            background: isFull ? 'var(--accent-gold)' : 'linear-gradient(90deg, var(--accent-orange), var(--accent-red))',
                          }} />
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div style={{ padding: '15px 20px', background: '#0e1018', borderTop: '1px solid var(--border-card)' }}>
                      {isOpen ? (
                        <Link
                          to={`/register/${t.id}`}
                          className="btn btn-primary"
                          style={{ width: '100%' }}
                        >
                          REGISTER SQUAD (₹{t.entryFee})
                        </Link>
                      ) : (
                        <Link
                          to={`/tournament/${t.id}`}
                          className="btn btn-secondary"
                          style={{ width: '100%' }}
                        >
                          VIEW TOURNAMENT
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
