import React, { useEffect, useState } from 'react';
import { AlertCircle, Trophy } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchPublishedResults } from '../services/api';

export default function Results() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPublishedResults()
      .then(setResults)
      .catch((requestError) => setError(requestError.message || 'Unable to load results.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading published results..." fullScreen />;
  return (
    <section className="container page-section">
      <h1>Published tournament results</h1>
      <p>Results appear here only after the tournament administrator publishes them.</p>
      {error && <div className="alert alert-error"><AlertCircle size={18} />{error}</div>}
      {!error && !results.length && <div className="ffa-card empty-state">No results have been published yet.</div>}
      <div className="results-list">
        {results.map((result) => (
          <article className="ffa-card result-card" key={result.id}>
            <Trophy aria-hidden="true" />
            <div>
              <h2>{result.tournament_name}</h2>
              <p>{new Date(result.tournament_date).toLocaleDateString('en-IN')}</p>
              <strong>Placement: {result.placement}</strong>
              <span>Prize: ₹{Number(result.prize_amount).toLocaleString('en-IN')}</span>
              {result.details && <p>{result.details}</p>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
