import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  fetchTournamentById, 
  submitSquadRegistration, 
  resendOtp, 
  verifyOtp, 
  startPaymentRequest,
  submitRegistrationUtr,
  getRegistrationPaymentStatus,
  getUserProfile,
} from '../services/api';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ShieldCheck, 
  CreditCard, 
  CheckCircle,
  CheckCircle2,
  AlertCircle, 
  ArrowLeft, 
  KeyRound, 
  Flame, 
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import confetti from 'canvas-confetti';

function triggerConfetti() {
  try {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ff5500', '#ff2a4b', '#00ffcc', '#ffb700'],
    });
  } catch {}
}

export default function Register() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();

  // Tournament Data
  const [tournament, setTournament] = useState(null);
  const [loadingTournament, setLoadingTournament] = useState(true);

  // Workflow Steps: 1: SQUAD_FORM, 2: OTP_VERIFY, 3: PAYMENT, 4: CONFIRMED
  const [currentStep, setCurrentStep] = useState(1);
  const [registrationId, setRegistrationId] = useState(null);
  const [registrationToken, setRegistrationToken] = useState(null);

  // Step 1: Captain information represents the squad registration.
  const [captainName, setCaptainName] = useState('');
  const [captainEmail, setCaptainEmail] = useState('');
  const [captainPhone, setCaptainPhone] = useState('');
  const [captainFreeFireId, setCaptainFreeFireId] = useState('');

  // Step 2: OTP State
  const [otp, setOtp] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(60);
  const [otpTimer, setOtpTimer] = useState(300);

  // Status & Error states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Confirmed Data
  const [confirmedData, setConfirmedData] = useState(null);
  const [paymentSession, setPaymentSession] = useState(null);
  const [paymentUnavailable, setPaymentUnavailable] = useState(false);
  const [utr, setUtr] = useState('');

  // Load Tournament Info
  useEffect(() => {
    fetchTournamentById(tournamentId)
      .then(data => {
        setTournament(data);
        if (data.status !== 'OPEN') {
          setErrorMessage(`Registration is not available (${data.status === 'SLOTS_FULL' ? 'Slots are Full' : 'Registration Closed'}).`);
        }
      })
      .catch(err => setErrorMessage(err.message || 'Failed to load tournament information.'))
      .finally(() => setLoadingTournament(false));
  }, [tournamentId]);

  useEffect(() => {
    getUserProfile()
      .then((user) => setCaptainEmail(user.email))
      .catch((error) => setErrorMessage(error.message || 'Please sign in before registering.'));
  }, []);

  // OTP Timer countdown
  useEffect(() => {
    let interval = null;
    if (currentStep === 2 && otpTimer > 0) {
      interval = setInterval(() => setOtpTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [currentStep, otpTimer]);

  // Resend Cooldown countdown
  useEffect(() => {
    let interval = null;
    if (currentStep === 2 && otpCooldown > 0) {
      interval = setInterval(() => setOtpCooldown(c => c - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [currentStep, otpCooldown]);

  useEffect(() => {
    if (currentStep !== 3 || paymentSession?.status !== 'UTR_SUBMITTED' ||
        !registrationId || !registrationToken) return undefined;

    let checking = false;
    const interval = setInterval(async () => {
      if (checking) return;
      checking = true;
      try {
        const payment = await getRegistrationPaymentStatus(registrationId, registrationToken);
        setPaymentSession((current) => current ? { ...current, ...payment } : payment);
        if (payment.status === 'VERIFIED') {
          setConfirmedData({
            tournamentName: tournament.name,
            captainName,
            captainEmail,
            squadNumber: payment.squadNumber,
            amountPaid: payment.amount,
          });
          setCurrentStep(4);
          triggerConfetti();
        }
      } catch (error) {
        setErrorMessage(error.message || 'Payment status is temporarily unavailable.');
      } finally {
        checking = false;
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [currentStep, paymentSession?.status, registrationId, registrationToken, tournament?.name, captainName, captainEmail]);

  // Format seconds into MM:SS
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Step 1: Submit Squad Form
  const handleSubmitSquad = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Frontend Validations
    if (!captainName.trim() || !captainEmail.trim() || !captainPhone.trim() || !captainFreeFireId.trim()) {
      setErrorMessage('Please fill in all Captain details.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        tournamentId: parseInt(tournamentId, 10),
        captainName: captainName.trim(),
        captainEmail: captainEmail.trim(),
        captainPhone: captainPhone.trim(),
        captainFreeFireId: captainFreeFireId.trim(),
        players: [{ fullName: captainName.trim(), freeFireId: captainFreeFireId.trim() }],
      };

      const res = await submitSquadRegistration(payload);
      setRegistrationId(res.registrationId);
      setRegistrationToken(res.registrationToken);
      setCurrentStep(3);
      setSuccessMessage(res.message || 'Email verified. Your UPI payment details are ready.');
      const paymentResult = await startPaymentRequest(res.registrationId, res.registrationToken);
      setPaymentUnavailable(false);
      setPaymentSession(paymentResult.payment);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to submit registration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!otp || otp.trim().length !== 6) {
      setErrorMessage('Please enter the full 6-digit OTP code.');
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyOtp(registrationId, otp.trim(), registrationToken);
      setCurrentStep(3);
      setSuccessMessage(`Email verified. Your ₹${tournament.entryFee} UPI payment details are ready.`);
      try {
        const result = await startPaymentRequest(registrationId, registrationToken);
        setPaymentUnavailable(false);
        setPaymentSession(result.payment);
        if (result.payment.status === 'VERIFIED') {
          setConfirmedData({
            tournamentName: tournament.name,
            captainName,
            captainEmail,
            squadNumber: result.payment.squadNumber,
            amountPaid: result.payment.amount,
          });
          setCurrentStep(4);
          triggerConfetti();
        }
      } catch (paymentError) {
        setPaymentUnavailable(paymentError.data?.code === 'UPI_NOT_CONFIGURED');
        setErrorMessage(paymentError.message || 'Could not prepare UPI payment details.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (otpCooldown > 0) return;
    setErrorMessage(null);
    try {
      const res = await resendOtp(registrationId, registrationToken);
      setOtpCooldown(60);
      setOtpTimer(300);
      setSuccessMessage(res.message || 'Fresh OTP dispatched to your email.');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to resend OTP.');
    }
  };

  const handlePayEntryFee = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await startPaymentRequest(registrationId, registrationToken);
      setPaymentUnavailable(false);
      setPaymentSession(result.payment);
      if (result.payment.status === 'VERIFIED') {
        setConfirmedData({
          tournamentName: tournament.name,
          captainName,
          captainEmail,
          squadNumber: result.payment.squadNumber,
          amountPaid: result.payment.amount,
        });
        setCurrentStep(4);
        triggerConfetti();
      }
    } catch (err) {
      setPaymentUnavailable(err.data?.code === 'UPI_NOT_CONFIGURED');
      setErrorMessage(err.message || 'UPI payment details are not configured.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitUtr = async (event) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const result = await submitRegistrationUtr(registrationId, utr, registrationToken);
      setPaymentSession((current) => ({ ...current, ...result.payment }));
      setUtr('');
      setSuccessMessage(result.message);
    } catch (err) {
      setErrorMessage(err.message || 'Could not submit the UTR.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingTournament) return <LoadingSpinner message="Preparing registration form..." fullScreen />;

  return (
    <div style={{ padding: '40px 0 80px' }}>
      <div className="container" style={{ maxWidth: '850px' }}>
        {/* Top Back Navigation */}
        <button
          onClick={() => navigate(`/tournament/${tournamentId}`)}
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
            marginBottom: '20px',
          }}
        >
          <ArrowLeft size={16} /> BACK TO TOURNAMENT DETAILS
        </button>

        {/* Step Progression Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#121420',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 24px',
          marginBottom: '30px',
        }}>
          {[
            { num: 1, label: 'SQUAD ROSTER' },
            { num: 2, label: 'EMAIL VERIFIED' },
            { num: 3, label: 'ENTRY FEE' },
            { num: 4, label: 'CONFIRMATION' },
          ].map((s) => {
            const isDone = currentStep > s.num;
            const isCurrent = currentStep === s.num;

            return (
              <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: isDone ? 'var(--accent-green)' : isCurrent ? 'var(--accent-orange)' : '#1e2236',
                  color: isDone || isCurrent ? '#ffffff' : 'var(--text-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 900,
                  fontSize: '13px',
                  boxShadow: isCurrent ? '0 0 12px rgba(255, 85, 0, 0.4)' : 'none',
                }}>
                  {isDone ? '✓' : s.num}
                </div>
                <span style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '1px',
                  color: isCurrent ? '#ffffff' : isDone ? 'var(--accent-green)' : 'var(--text-dim)',
                  display: 'none',
                }} className="step-label">
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Error / Success Notifications */}
        {errorMessage && (
          <div className="alert alert-error">
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <div>{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success">
            <CheckCircle2 size={20} style={{ flexShrink: 0 }} />
            <div>{successMessage}</div>
          </div>
        )}

        {/* ================= STEP 1: SQUAD FORM ================= */}
        {currentStep === 1 && (
          <div className="ffa-card" style={{ padding: '35px' }}>
            <div style={{ borderBottom: '1px solid var(--border-card)', paddingBottom: '20px', marginBottom: '25px' }}>
              <div className="badge badge-gold" style={{ marginBottom: '8px' }}>
                {tournament.name} (Entry: ₹{tournament.entryFee})
              </div>
              <h2 style={{ fontSize: '24px', color: '#ffffff' }}>REGISTER YOUR SQUAD</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                One registration reserves one squad slot. Only the captain's details are required.
              </p>
            </div>

            <form onSubmit={handleSubmitSquad}>
              {/* Captain Details Box */}
              <div style={{
                background: '#0e1018',
                border: '1px solid rgba(255, 85, 0, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                marginBottom: '25px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--accent-orange)',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 800,
                  fontSize: '14px',
                  letterSpacing: '1px',
                  marginBottom: '16px',
                  textTransform: 'uppercase',
                }}>
                  <Flame size={16} /> SQUAD CAPTAIN
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
                  <div className="form-group">
                    <label className="form-label">Captain Full Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Aman Sharma"
                      value={captainName}
                      onChange={(e) => setCaptainName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Captain Email Address * (For Room ID)</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="e.g. captain@gmail.com"
                      value={captainEmail}
                      readOnly
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Captain Phone Number * (10 Digits)</label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="e.g. 9876543210"
                      value={captainPhone}
                      onChange={(e) => setCaptainPhone(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Captain Free Fire UID / ID *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 1928475928"
                      value={captainFreeFireId}
                      onChange={(e) => setCaptainFreeFireId(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || tournament.status !== 'OPEN'}
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
              >
                {isSubmitting ? 'SUBMITTING REGISTRATION...' : 'CONTINUE TO PAYMENT'}
              </button>
            </form>
          </div>
        )}

        {/* ================= STEP 2: OTP VERIFICATION ================= */}
        {currentStep === 2 && (
          <div className="ffa-card" style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'rgba(255, 85, 0, 0.15)',
              color: 'var(--accent-orange)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <KeyRound size={28} />
            </div>

            <h2 style={{ fontSize: '24px', color: '#ffffff', marginBottom: '8px' }}>
              VERIFY CAPTAIN EMAIL
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '480px', margin: '0 auto 25px' }}>
              We sent a 6-digit verification code to <strong style={{ color: '#ffffff' }}>{captainEmail}</strong>. Enter it below to proceed to the entry fee payment.
            </p>

            <form onSubmit={handleVerifyOtp} style={{ maxWidth: '340px', margin: '0 auto' }}>
              <div className="form-group">
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="form-input"
                  style={{
                    fontSize: '28px',
                    letterSpacing: '10px',
                    textAlign: 'center',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    padding: '14px',
                    color: 'var(--accent-orange)',
                    borderColor: 'var(--accent-orange)',
                  }}
                  autoFocus
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-dim)', marginBottom: '20px' }}>
                <span>Code expires in: <strong>{formatTime(otpTimer)}</strong></span>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={otpCooldown > 0}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: otpCooldown > 0 ? 'var(--text-dim)' : 'var(--accent-orange)',
                    cursor: otpCooldown > 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                  }}
                >
                  {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : 'Resend Code'}
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || otp.length !== 6}
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginBottom: '12px' }}
              >
                {isSubmitting ? 'VERIFYING...' : 'VERIFY & PROCEED'}
              </button>
            </form>
          </div>
        )}

        {/* ================= STEP 3: PAYMENT SCREEN ================= */}
        {currentStep === 3 && (
          <div className="ffa-card" style={{ padding: '35px' }}>
            {paymentUnavailable && (
              <div className="alert alert-error" role="status">
                <AlertCircle size={20} style={{ flexShrink: 0 }} />
                <div>UPI payment is not configured yet. The administrator must set the backend UPI_ID before registrations can be paid.</div>
              </div>
            )}
            <div style={{ textAlign: 'center', marginBottom: '25px' }}>
              <div className="badge badge-open" style={{ marginBottom: '10px' }}>
                EMAIL VERIFIED ✓
              </div>
              <h2 style={{ fontSize: '26px', color: '#ffffff' }}>TEAM REGISTRATION PAYMENT</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
                Pay the displayed tournament entry fee using UPI, then submit the UTR for manual admin verification.
              </p>
            </div>

            {/* Summary Details */}
            <div style={{
              background: '#0c0d14',
              border: '1px solid #1f2336',
              borderRadius: 'var(--radius-md)',
              padding: '24px',
              marginBottom: '30px',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Tournament</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>{tournament.name}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Squad Captain</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>{captainName}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Verified Email</div>
                  <div style={{ fontSize: '14px', color: 'var(--accent-cyan)' }}>{captainEmail}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Squad Size</div>
                  <div style={{ fontSize: '14px', color: '#ffffff' }}>4 Players Squad</div>
                </div>
              </div>

              <div style={{
                borderTop: '1px solid #202438',
                paddingTop: '18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Total Amount Due:</span>
                <span style={{ fontSize: '28px', fontWeight: 900, color: 'var(--accent-green)' }}>
                  ₹{paymentSession?.amount ?? tournament.entryFee}
                </span>
              </div>
            </div>

            {paymentSession && (
              <div style={{
                background: '#0c0d14',
                border: '1px solid #1f2336',
                borderRadius: 'var(--radius-md)',
                padding: '22px',
                marginBottom: '20px',
                textAlign: 'center',
              }}>
                <div style={{ color: 'var(--text-dim)', fontSize: '12px', textTransform: 'uppercase' }}>
                  Payment status
                </div>
                <div style={{ color: '#ffffff', fontWeight: 800, margin: '5px 0 12px' }}>
                  {paymentSession.status === 'PENDING'
                    ? `Complete your ₹${paymentSession.amount} UPI payment`
                    : paymentSession.status === 'UTR_SUBMITTED'
                      ? 'Payment submitted. Waiting for admin verification.'
                      : paymentSession.status === 'VERIFIED'
                        ? 'Payment verified successfully.'
                        : paymentSession.status === 'REJECTED'
                          ? 'Payment could not be verified.'
                          : paymentSession.status}
                </div>
                {(paymentSession.status === 'PENDING' || paymentSession.status === 'REJECTED') && (
                  <>
                    <QRCodeSVG
                      value={paymentSession.upiUri}
                      size={220}
                      level="M"
                      includeMargin
                      title={`UPI payment QR for ₹${paymentSession.amount}`}
                      style={{ maxWidth: '100%', background: '#ffffff', padding: '8px', borderRadius: '8px' }}
                    />
                    <div style={{ color: '#ffffff', fontSize: '14px', fontWeight: 700, margin: '12px 0 4px' }}>
                      UPI ID: {paymentSession.upiId}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      Payee: {paymentSession.displayName} · Amount: ₹{paymentSession.amount}
                    </div>
                    {paymentSession.reservationExpiresAt && (
                      <div style={{ color: 'var(--text-dim)', fontSize: '12px', marginTop: '5px' }}>
                        Submit payment and UTR before {new Date(paymentSession.reservationExpiresAt).toLocaleString('en-IN')} to keep the slot reserved.
                      </div>
                    )}
                    <a
                      href={paymentSession.upiUri}
                      className="btn btn-secondary"
                      style={{ margin: '12px auto' }}
                    >
                      OPEN UPI APP
                    </a>
                  </>
                )}
                {paymentSession.registrationId && (
                  <div style={{ color: 'var(--text-dim)', fontSize: '12px', marginTop: '10px' }}>
                    Registration ID: {paymentSession.registrationId}
                  </div>
                )}
                {paymentSession.status === 'UTR_SUBMITTED' && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px' }}>
                    An admin will check your UPI payment manually. Your team is not confirmed until it is approved.
                  </div>
                )}
                {paymentSession.status === 'REJECTED' && (
                  <div className="alert alert-error" style={{ marginTop: '14px', textAlign: 'left' }}>
                    <AlertCircle size={18} />
                    <span>{paymentSession.rejectionReason || 'Please check the UTR and submit a corrected reference.'}</span>
                  </div>
                )}
              </div>
            )}

            {paymentSession && ['PENDING', 'REJECTED'].includes(paymentSession.status) ? (
              <form onSubmit={handleSubmitUtr} style={{ marginTop: '20px' }}>
                <div className="form-group">
                  <label className="form-label">UTR / Transaction Reference</label>
                  <input
                    type="text"
                    className="form-input"
                    value={utr}
                    onChange={(event) => setUtr(event.target.value)}
                    placeholder="Enter the UTR from your UPI app"
                    minLength={8}
                    maxLength={32}
                    pattern="[A-Za-z0-9-]{8,32}"
                    autoComplete="off"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || utr.trim().length < 8}
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%', padding: '18px', fontSize: '18px' }}
                >
                  {isSubmitting ? 'SUBMITTING UTR...' : 'SUBMIT PAYMENT FOR VERIFICATION'}
                </button>
              </form>
            ) : !paymentSession && (
              <button
                onClick={handlePayEntryFee}
                disabled={isSubmitting}
                className="btn btn-primary btn-lg"
                style={{ width: '100%', padding: '18px', fontSize: '18px' }}
              >
                <CreditCard size={22} />
                {isSubmitting ? 'PREPARING UPI DETAILS...' : 'SHOW UPI PAYMENT DETAILS'}
              </button>
            )}

            <ol style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.8, margin: '20px 0 0' }}>
              <li>Open a UPI app and scan the QR code or use the UPI ID.</li>
              <li>Pay exactly ₹{paymentSession?.amount ?? tournament.entryFee} and copy the UTR / transaction reference.</li>
              <li>Enter only the UTR here. Never enter your UPI PIN, OTP, or bank password.</li>
              <li>An admin checks the payment and approves or rejects it manually.</li>
            </ol>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '12px',
              color: 'var(--text-dim)',
              marginTop: '15px',
            }}>
              <ShieldCheck size={16} color="var(--accent-green)" />
              UTR submission is not payment verification. Only an authenticated admin can confirm this registration.
            </div>
          </div>
        )}

        {/* ================= STEP 4: CONFIRMATION ================= */}
        {currentStep === 4 && confirmedData && (
          <div className="ffa-card" style={{ padding: '45px', textAlign: 'center' }}>
            <div style={{
              width: '75px',
              height: '75px',
              borderRadius: '50%',
              background: 'rgba(0, 230, 118, 0.15)',
              color: 'var(--accent-green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              border: '2px solid var(--accent-green)',
              boxShadow: '0 0 25px rgba(0, 230, 118, 0.3)',
            }}>
              <CheckCircle size={40} />
            </div>

            <h1 style={{ fontSize: '32px', color: '#ffffff', marginBottom: '8px' }}>
              REGISTRATION CONFIRMED
            </h1>
            <p style={{ color: 'var(--accent-green)', fontSize: '15px', fontWeight: 700, marginBottom: '25px' }}>
              ✓ Payment of ₹{confirmedData.amountPaid} Successful • Slot Reserved
            </p>

            {/* Summary Box */}
            <div style={{
              background: '#0c0d14',
              border: '1px solid #1f2336',
              borderRadius: 'var(--radius-md)',
              padding: '24px',
              maxWidth: '520px',
              margin: '0 auto 30px',
              textAlign: 'left',
              lineHeight: 1.8,
            }}>
              <div style={{ fontSize: '14px', color: '#dddddd' }}>
                🏆 <strong>Tournament:</strong> {confirmedData.tournamentName}<br />
                👥 <strong>Squad Captain:</strong> {confirmedData.captainName}<br />
                🔢 <strong>Assigned Squad:</strong> {confirmedData.squadNumber ? `#${confirmedData.squadNumber}` : 'Pending update in your dashboard'}<br />
                💳 <strong>Payment Status:</strong> <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>₹{confirmedData.amountPaid} PAID</span><br />
                📧 <strong>Captain Email:</strong> {confirmedData.captainEmail}
              </div>
            </div>

            {/* Important Notice */}
            <div style={{
              background: '#1c160e',
              border: '1px solid rgba(255, 85, 0, 0.4)',
              borderRadius: 'var(--radius-md)',
              padding: '18px 24px',
              maxWidth: '520px',
              margin: '0 auto 30px',
              textAlign: 'left',
            }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--accent-orange)', marginBottom: '4px' }}>
                🚨 ROOM ID & PASSWORD DELIVERY
              </div>
              <p style={{ fontSize: '13px', color: '#d1d5db', margin: 0, lineHeight: 1.5 }}>
                Room credentials are sent manually by the administrator to confirmed captains. Check your dashboard and email before match time.
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/tournaments" className="btn btn-primary">
                BROWSE TOURNAMENTS
              </Link>
              <Link to={`/tournament/${tournamentId}`} className="btn btn-secondary">
                VIEW MATCH DETAILS
              </Link>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (min-width: 600px) {
          .step-label {
            display: inline-block !important;
          }
        }
      `}</style>
    </div>
  );
}
