import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchTournamentById } from '../services/api';
import { 
  Trophy, 
  Calendar, 
  Clock, 
  IndianRupee, 
  Users, 
  ShieldCheck, 
  MailCheck, 
  AlertCircle, 
  ArrowLeft, 
  CheckCircle2, 
  Zap, 
  Award 
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

export default function TournamentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTournamentById(id)
      .then(data => setTournament(data))
      .catch(err => setError(err.message || 'Failed to load tournament'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner message="Loading match details..." fullScreen />;

  if (error || !tournament) {
    return (
      <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <AlertCircle size={48} color="var(--accent-red)" style={{ margin: '0 auto 16px' }} />
        <h2>Tournament Not Found</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px', marginBottom: '24px' }}>
          {error || 'The requested tournament does not exist.'}
        </p>
        <Link to="/tournaments" className="btn btn-secondary">
          <ArrowLeft size={16} /> BACK TO TOURNAMENTS
        </Link>
      </div>
    );
  }

  const isOpen = tournament.status === 'OPEN';
  const isFull = tournament.status === 'SLOTS_FULL';
  const isClosed = tournament.status === 'REGISTRATION_CLOSED';

  return (
    <div style={{ padding: '40px 0 80px' }}>
      <div className="container">
        {/* Back Link */}
        <button
          onClick={() => navigate('/tournaments')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            marginBottom: '25px',
          }}
        >
          <ArrowLeft size={16} /> BACK TO ALL MATCHES
        </button>

        {/* Main Grid Layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)',
          gap: '30px',
          alignItems: 'start',
        }} className="detail-grid">
          
          {/* Left Main Column */}
          <div>
            {/* Header Card */}
            <div className="ffa-card" style={{ padding: '30px', marginBottom: '25px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <div className="badge badge-gold" style={{ marginBottom: '8px' }}>
                    FREE FIRE BATTLE ROYALE SQUAD (4v4)
                  </div>
                  <h1 style={{ fontSize: 'clamp(24px, 4vw, 34px)', color: '#ffffff', lineHeight: 1.2 }}>
                    {tournament.name}
                  </h1>
                </div>
                {isOpen ? (
                  <span className="badge badge-open" style={{ padding: '6px 14px', fontSize: '12px' }}>REGISTER NOW</span>
                ) : isFull ? (
                  <span className="badge badge-full" style={{ padding: '6px 14px', fontSize: '12px' }}>SLOTS FULL</span>
                ) : (
                  <span className="badge badge-closed" style={{ padding: '6px 14px', fontSize: '12px' }}>CLOSED</span>
                )}
              </div>

              <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: '1.7', marginBottom: '25px' }}>
                {tournament.description || 'Official competitive 4-player squad Battle Royale tournament. Compete with top teams for guaranteed cash prizes.'}
              </p>

              {/* Match Details Quick Bar */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '15px',
                background: '#0c0e17',
                padding: '20px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #1f2336',
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>Date</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                    {new Date(tournament.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>Start Time</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-orange)' }}>
                    {tournament.startTime} (IST)
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>Squad Format</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                    4 Players Squad
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>Entry Fee</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-green)' }}>
                    ₹{tournament.entryFee}
                  </div>
                </div>
              </div>
            </div>

            {/* Rules and Guidelines */}
            <div className="ffa-card" style={{ padding: '30px', marginBottom: '25px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                <ShieldCheck size={24} color="var(--accent-orange)" />
                <h3 style={{ fontSize: '20px', color: '#ffffff' }}>MATCH RULES & GUIDELINES</h3>
              </div>

              <div style={{ color: '#d1d5db', fontSize: '14px', lineHeight: '1.8', whiteSpace: 'pre-line' }}>
                {tournament.rules || (
                  `1. Exactly 4 players per squad.\n2. Mobile devices only. Emulators, PC, and iPads are strictly prohibited.\n3. Gun attributes are disabled for balanced competitive gameplay.\n4. Character skills are allowed.\n5. Room ID and password will be sent to the captain verified email 10 minutes before the match.\n6. All squad members must join the designated room slot on time. Late entries forfeit their entry.\n7. Teaming up or toxic behavior will result in an immediate permanent ban and prize forfeiture.`
                )}
              </div>
            </div>

            {/* Room Credentials Delivery Notice */}
            <div style={{
              background: '#19130d',
              border: '1px solid rgba(255, 85, 0, 0.4)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              display: 'flex',
              gap: '16px',
            }}>
              <MailCheck size={28} color="var(--accent-orange)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ color: 'var(--accent-orange)', fontSize: '15px', marginBottom: '6px' }}>
                  AUTOMATIC ROOM CREDENTIALS (10 MINS PRIOR)
                </h4>
                <p style={{ color: '#d1d5db', fontSize: '13px', lineHeight: '1.6' }}>
                  Custom Room ID and Password are never displayed publicly to prevent room leakage. They will be automatically dispatched by our server directly to the captain's verified email address at <strong>10 minutes before {tournament.startTime}</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Right Sidebar Column */}
          <div>
            {/* Registration Card */}
            <div className="ffa-card" style={{ padding: '28px', marginBottom: '25px', position: 'sticky', top: '95px' }}>
              <h3 style={{ fontSize: '18px', marginBottom: '18px', textAlign: 'center' }}>
                REGISTRATION SUMMARY
              </h3>

              {/* Slots Live Counter */}
              <div style={{
                background: '#0d0f17',
                border: '1px solid #1f2336',
                borderRadius: 'var(--radius-md)',
                padding: '18px',
                marginBottom: '20px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Confirmed Slots Status
                </div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: isFull ? 'var(--accent-gold)' : 'var(--accent-cyan)' }}>
                  {tournament.confirmedSlots} / {tournament.maxSlots}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {tournament.availableSlots} Slots Available
                </div>

                <div style={{
                  height: '8px',
                  background: '#141724',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  marginTop: '12px',
                }}>
                  <div style={{
                    width: `${Math.min(100, (tournament.confirmedSlots / tournament.maxSlots) * 100)}%`,
                    height: '100%',
                    background: isFull ? 'var(--accent-gold)' : 'linear-gradient(90deg, var(--accent-orange), var(--accent-red))',
                  }} />
                </div>
              </div>

              {/* Price Details */}
              <div style={{ borderBottom: '1px solid #202438', paddingBottom: '15px', marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Entry Fee (4 Players)</span>
                  <strong style={{ color: '#ffffff' }}>₹{tournament.entryFee}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Squad Roster</span>
                  <strong style={{ color: '#ffffff' }}>4 Players</strong>
                </div>
              </div>

              <div style={{ marginBottom: '24px', background: 'rgba(255, 183, 0, 0.08)', padding: '14px 16px', borderRadius: '8px', border: '1px solid rgba(255, 183, 0, 0.2)' }}>
                <div style={{ fontSize: '12px', color: 'var(--accent-gold)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Winner Prize
                </div>
                <div style={{ fontSize: '24px', color: '#ffffff', fontWeight: 900, marginTop: '4px' }}>
                  ₹{tournament.prizeAmount}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '5px' }}>
                  Paid separately by the tournament organizer; it is not funded from team registration fees.
                </div>
              </div>

              {/* Action Register Button */}
              {isOpen ? (
                <Link
                  to={`/register/${tournament.id}`}
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%' }}
                >
                  <Zap size={20} /> REGISTER SQUAD (₹{tournament.entryFee})
                </Link>
              ) : isFull ? (
                <button disabled className="btn btn-secondary btn-lg" style={{ width: '100%', opacity: 0.6 }}>
                  SLOTS ARE FULL
                </button>
              ) : (
                <button disabled className="btn btn-secondary btn-lg" style={{ width: '100%', opacity: 0.6 }}>
                  REGISTRATION CLOSED
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .detail-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
