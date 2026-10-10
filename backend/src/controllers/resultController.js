const { getClient, query } = require('../database/db');

async function getPublishedResults(req, res) {
  try {
    const result = await query(
      `SELECT tr.id, tr.tournament_id, tr.placement, tr.prize_amount, tr.details,
              t.name AS tournament_name, t.date AS tournament_date
       FROM tournament_results tr
       JOIN tournaments t ON t.id = tr.tournament_id
       WHERE tr.status = 'PUBLISHED' AND t.tournament_status <> 'CANCELLED'
       ORDER BY t.date DESC, tr.placement ASC`
    );
    return res.json({ success: true, results: result.rows });
  } catch (error) {
    console.error('[ResultController] Public results fetch failed:', error);
    return res.status(500).json({ success: false, error: 'Unable to load published results.' });
  }
}

async function getAdminResults(req, res) {
  try {
    const result = await query(
      `SELECT tr.id, tr.tournament_id, tr.registration_id, tr.placement,
              tr.prize_amount, tr.details, tr.status, tr.published_at,
              t.name AS tournament_name, t.date AS tournament_date,
              r.captain_name, r.squad_number
       FROM tournament_results tr
       JOIN tournaments t ON t.id = tr.tournament_id
       JOIN registrations r ON r.id = tr.registration_id
       ORDER BY t.date DESC, tr.placement ASC`
    );
    return res.json({ success: true, results: result.rows });
  } catch (error) {
    console.error('[ResultController] Admin results fetch failed:', error);
    return res.status(500).json({ success: false, error: 'Unable to load tournament results.' });
  }
}

async function saveTournamentResult(req, res) {
  const tournamentId = Number(req.params.tournamentId);
  const registrationId = Number(req.body?.registrationId);
  const placement = Number(req.body?.placement);
  const prizeAmount = Number(req.body?.prizeAmount);
  const details = typeof req.body?.details === 'string' ? req.body.details.trim() : '';
  const publish = req.body?.publish === true;
  const confirmedCorrection = req.body?.confirmCorrection === true;

  if (!Number.isSafeInteger(tournamentId) || tournamentId < 1 ||
      !Number.isSafeInteger(registrationId) || registrationId < 1 ||
      !Number.isSafeInteger(placement) || placement < 1 ||
      !Number.isFinite(prizeAmount) || prizeAmount < 0 || details.length > 5000) {
    return res.status(400).json({ success: false, error: 'Enter valid tournament result details.' });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const tournament = await client.query(
      `SELECT id FROM tournaments WHERE id = $1 FOR UPDATE`,
      [tournamentId]
    );
    if (!tournament.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Tournament not found.' });
    }
    const registration = await client.query(
      `SELECT id, status FROM registrations
       WHERE id = $1 AND tournament_id = $2 FOR UPDATE`,
      [registrationId, tournamentId]
    );
    if (!registration.rows.length || registration.rows[0].status !== 'CONFIRMED') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'Results can only be recorded for a confirmed squad in this tournament.' });
    }
    const existing = await client.query(
      `SELECT * FROM tournament_results
       WHERE tournament_id = $1 AND registration_id = $2 FOR UPDATE`,
      [tournamentId, registrationId]
    );
    if (existing.rows.length && !confirmedCorrection) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        code: 'RESULT_CORRECTION_CONFIRMATION_REQUIRED',
        error: 'A result already exists. Confirm the correction before saving to preserve its history.',
      });
    }
    const before = existing.rows[0] || null;
    const saved = await client.query(
      `INSERT INTO tournament_results
         (tournament_id, registration_id, placement, prize_amount, details, status, published_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $6 = 'PUBLISHED' THEN CURRENT_TIMESTAMP ELSE NULL END, CURRENT_TIMESTAMP)
       ON CONFLICT (tournament_id, registration_id)
       DO UPDATE SET placement = EXCLUDED.placement, prize_amount = EXCLUDED.prize_amount,
                     details = EXCLUDED.details, status = EXCLUDED.status,
                     published_at = CASE WHEN EXCLUDED.status = 'PUBLISHED'
                       THEN COALESCE(tournament_results.published_at, CURRENT_TIMESTAMP)
                       ELSE tournament_results.published_at END,
                     updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [tournamentId, registrationId, placement, prizeAmount, details, publish ? 'PUBLISHED' : 'DRAFT']
    );
    await client.query(
      `INSERT INTO tournament_result_history
         (tournament_id, result_id, admin_id, action, result_snapshot)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        tournamentId,
        saved.rows[0].id,
        req.admin.id,
        before ? 'CORRECTED' : (publish ? 'PUBLISHED' : 'CREATED'),
        JSON.stringify({ before, after: saved.rows[0] }),
      ]
    );
    await client.query('COMMIT');
    return res.json({ success: true, result: saved.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[ResultController] Saving result failed:', error);
    return res.status(500).json({ success: false, error: 'Unable to save tournament result.' });
  } finally {
    client.release();
  }
}

module.exports = { getPublishedResults, getAdminResults, saveTournamentResult };
