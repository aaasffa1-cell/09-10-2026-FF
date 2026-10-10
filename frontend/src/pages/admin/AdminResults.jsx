import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  fetchAdminResults,
  fetchAdminRegistrations,
  fetchAdminTournaments,
  saveAdminResult,
} from '../../services/api';

export default function AdminResults() {
  const [tournaments, setTournaments] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [results, setResults] = useState([]);
  const [tournamentId, setTournamentId] = useState('');
  const [registrationId, setRegistrationId] = useState('');
  const [placement, setPlacement] = useState('1');
  const [prizeAmount, setPrizeAmount] = useState('0');
  const [details, setDetails] = useState('');
  const [publish, setPublish] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    const [tournamentData, registrationData, resultData] = await Promise.all([
      fetchAdminTournaments(),
      fetchAdminRegistrations({ status: 'CONFIRMED' }),
      fetchAdminResults(),
    ]);
    setTournaments(tournamentData);
    setRegistrations(registrationData);
    setResults(resultData);
  };

  useEffect(() => {
    load().catch((requestError) => setError(requestError.message || 'Unable to load results.'))
      .finally(() => setLoading(false));
  }, []);

  const save = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    const existing = results.find((item) => String(item.registration_id) === registrationId &&
      String(item.tournament_id) === tournamentId);
    let confirmCorrection = false;
    if (existing) {
      confirmCorrection = window.confirm('A result already exists. Save this correction and retain the previous version in result history?');
      if (!confirmCorrection) return;
    }
    setSaving(true);
    try {
      await saveAdminResult(tournamentId, {
        registrationId: Number(registrationId),
        placement: Number(placement),
        prizeAmount: Number(prizeAmount),
        details,
        publish,
        confirmCorrection,
      });
      await load();
      setSuccess(publish ? 'Result saved and published.' : 'Draft result saved; it is not public.');
    } catch (requestError) {
      setError(requestError.message || 'Unable to save the result.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading results manager..." fullScreen />;
  const eligibleRegistrations = registrations.filter((item) => String(item.tournament_id) === tournamentId);

  return (
    <section className="container page-section">
      <h1>Results management</h1>
      <p>Save placements as drafts, then publish after checking. Corrections are retained in history.</p>
      {error && <div className="alert alert-error"><AlertCircle size={18} />{error}</div>}
      {success && <div className="alert alert-success"><CheckCircle2 size={18} />{success}</div>}
      <form className="ffa-card result-form" onSubmit={save}>
        <label>Tournament
          <select required value={tournamentId} onChange={(event) => { setTournamentId(event.target.value); setRegistrationId(''); }}>
            <option value="">Select tournament</option>
            {tournaments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>Confirmed squad
          <select required value={registrationId} onChange={(event) => setRegistrationId(event.target.value)}>
            <option value="">Select squad</option>
            {eligibleRegistrations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.squad_number ? `Squad ${item.squad_number} · ` : ''}{item.captain_name}
              </option>
            ))}
          </select>
        </label>
        <label>Placement<input type="number" required min="1" value={placement} onChange={(event) => setPlacement(event.target.value)} /></label>
        <label>Prize amount (₹)<input type="number" required min="0" step="0.01" value={prizeAmount} onChange={(event) => setPrizeAmount(event.target.value)} /></label>
        <label className="result-details">Result details<textarea maxLength="5000" value={details} onChange={(event) => setDetails(event.target.value)} /></label>
        <label className="result-publish"><input type="checkbox" checked={publish} onChange={(event) => setPublish(event.target.checked)} /> Publish immediately</label>
        <button className="btn btn-primary" disabled={saving || !tournamentId || !registrationId}>
          {saving ? 'Saving…' : publish ? 'Save and publish result' : 'Save draft'}
        </button>
      </form>
      <h2 className="section-heading">Result history</h2>
      <div className="results-list">
        {results.map((result) => (
          <article className="ffa-card result-card" key={result.id}>
            <div>
              <h3>{result.tournament_name} · {result.captain_name}</h3>
              <p>Placement {result.placement} · ₹{Number(result.prize_amount).toLocaleString('en-IN')} · {result.status}</p>
              <p>{result.details}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
