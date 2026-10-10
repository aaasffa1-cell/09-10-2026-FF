import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CalendarDays, Users } from 'lucide-react';
import { fetchTournaments, fetchPublishedResults } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Home() {
  const [tournaments, setTournaments] = useState([]);
  const [latestResults, setLatestResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchTournaments(), fetchPublishedResults()])
      .then(([tournamentData, resultData]) => {
        const now = Date.now();
        setTournaments(tournamentData.filter((item) => (
          item.status !== 'CANCELLED' && new Date(item.date).getTime() >= now - 24 * 60 * 60 * 1000
        )));
        setLatestResults(resultData.slice(0, 4));
      })
      .catch((requestError) => setError(requestError.message || 'Unable to load tournaments.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading upcoming tournaments..." fullScreen />;

  return (
    <div className="home-page">
      <section className="container page-section">
        <header className="home-heading">
          <span className="eyebrow">Free Fire BR Esports</span>
          <h1>Free Fire Arena</h1>
          <p>Find your next Battle Royale tournament and register your squad.</p>
          <nav aria-label="Main tournament navigation" className="home-links">
            <Link to="/tournaments">All tournaments</Link>
            <Link to="/results">Published results</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/login">Player sign in</Link>
          </nav>
        </header>

        <div className="section-title">
          <div>
            <span className="eyebrow">Database-backed listings</span>
            <h2>Upcoming tournaments</h2>
          </div>
        </div>
        {error && <div className="alert alert-error"><AlertCircle size={18} />{error}</div>}
        {!error && tournaments.length === 0 && (
          <div className="ffa-card empty-state">There are no upcoming tournaments right now.</div>
        )}
        <div className="tournament-list">
          {tournaments.map((tournament) => (
            <article className="ffa-card tournament-card" key={tournament.id}>
              <div>
                <span className={`status-pill status-${tournament.status.toLowerCase()}`}>{tournament.status.replaceAll('_', ' ')}</span>
                <h3>{tournament.name}</h3>
                <p className="tournament-meta">
                  <CalendarDays size={16} />
                  {new Date(tournament.date).toLocaleDateString('en-IN')} · {tournament.startTime} IST
                </p>
                <p className="tournament-meta"><Users size={16} />{tournament.confirmedSlots} / {tournament.maxSlots} confirmed squads</p>
                <p>Entry ₹{tournament.entryFee} · Prize ₹{tournament.prizeAmount}</p>
              </div>
              <div className="tournament-actions">
                <Link className="btn btn-secondary" to={`/tournament/${tournament.id}`}>Tournament details</Link>
                {tournament.status === 'OPEN' ? (
                  <Link className="btn btn-primary" to={`/register/${tournament.id}`}>Register now</Link>
                ) : <span className="availability-note">{tournament.status === 'SLOTS_FULL' ? 'All slots are filled.' : 'Registration closed'}</span>}
              </div>
            </article>
          ))}
        </div>
      </section>

      {latestResults.length > 0 && (
        <section className="container page-section latest-results">
          <div className="section-title"><div><span className="eyebrow">Official standings</span><h2>Latest published results</h2></div><Link to="/results">All results</Link></div>
          {latestResults.map((result) => (
            <article className="result-row" key={result.id}>
              <strong>{result.tournament_name}</strong>
              <span>Placement {result.placement}</span>
              <span>₹{Number(result.prize_amount).toLocaleString('en-IN')}</span>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
