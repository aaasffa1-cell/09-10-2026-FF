import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  fetchTournamentById, 
  submitSquadRegistration, 
  resendOtp, 
  verifyOtp, 
  createPaymentOrder, 
  verifyPayment 
} from '../services/api';
import { 
  Users, 
  ShieldCheck, 
  CreditCard, 
  CheckCircle, 
  AlertCircle, 
  ArrowLeft, 
  KeyRound, 
  Mail, 
  Phone, 
  User, 
  Flame, 
  Lock, 
  RefreshCw,
  Trophy,
  Calendar,
  Clock
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import confetti from 'canvas-confetti';

export default function Register() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();

  // Tournament Data
  const [tournament, setTournament] = useState(null);
  const [loadingTournament, setLoadingTournament] = useState(true);

  // Workflow Steps: 1: SQUAD_FORM, 2: OTP_VERIFY, 3: PAYMENT, 4: CONFIRMED
  const [currentStep, setCurrentStep] = useState(1);
  const [registrationId, setRegistrationId] = useState(null);

  // Step 1: Form State (Exactly 4 players)
  const [captainName, setCaptainName] = useState('');
  const [captainEmail, setCaptainEmail] = useState('');
  const [captainPhone, setCaptainPhone] = useState('');
  const [captainFreeFireId, setCaptainFreeFireId] = useState('');

  const [player2Name, setPlayer2Name] = useState('');
  const [player2FreeFireId, setPlayer2FreeFireId] = useState('');

  const [player3Name, setPlayer3Name] = useState('');
  const [player3FreeFireId, setPlayer3FreeFireId] = useState('');

  const [player4Name, setPlayer4Name] = useState('');
  const [player4FreeFireId, setPlayer4FreeFireId] = useState('');

  // Step 2: OTP State
  const [otp, setOtp] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(60);
  const [otpTimer, setOtpTimer] = useState(600); // 10 minutes (600s)

  // Status & Error states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Confirmed Data
  const [confirmedData, setConfirmedData] = useState(null);

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

    if (!player2Name.trim() || !player2FreeFireId.trim() ||
        !player3Name.trim() || !player3FreeFireId.trim() ||
        !player4Name.trim() || !player4FreeFireId.trim()) {
      setErrorMessage('Please fill in all 4 players details. No fields can be empty.');
      return;
    }

    // Check for duplicate Free Fire IDs
    const ffIds = [
      captainFreeFireId.trim().toLowerCase(),
      player2FreeFireId.trim().toLowerCase(),
      player3FreeFireId.trim().toLowerCase(),
      player4FreeFireId.trim().toLowerCase(),
    ];
    const uniqueFfIds = new Set(ffIds);
    if (uniqueFfIds.size !== 4) {
      setErrorMessage('Duplicate Free Fire ID detected. Every player in the squad must have a unique Free Fire ID.');
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
        players: [
          { fullName: captainName.trim(), freeFireId: captainFreeFireId.trim() },
          { fullName: player2Name.trim(), freeFireId: player2FreeFireId.trim() },
          { fullName: player3Name.trim(), freeFireId: player3FreeFireId.trim() },
          { fullName: player4Name.trim(), freeFireId: player4FreeFireId.trim() },
        ],
      };

      const res = await submitSquadRegistration(payload);
      setRegistrationId(res.registrationId);
      setCurrentStep(2);
      setOtpCooldown(60);
      setOtpTimer(600);
      setSuccessMessage(res.message || 'OTP sent to captain email.');
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
      const res = await verifyOtp(registrationId, otp.trim());
      setCurrentStep(3);
      setSuccessMessage('Email verified successfully! You may now proceed to payment.');
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
      const res = await resendOtp(registrationId);
      setOtpCooldown(60);
      setOtpTimer(600);
      setSuccessMessage(res.message || 'Fresh OTP dispatched to your email.');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to resend OTP.');
    }
  };

  // Step 3: Handle Payment (Razorpay)
  const handlePayEntryFee = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      // 1. Create Server-Controlled Order
      const orderData = await createPaymentOrder(registrationId);

      // Check if Razorpay SDK is available on window
      if (!window.Razorpay || orderData.isTestMode) {
        // In local test mode without live keys, verify sandbox payment directly
        console.log('[Payment] Executing test sandbox checkout for order:', orderData.orderId);
        
        const mockVerifyRes = await verifyPayment({
          registrationId,
          razorpay_order_id: orderData.orderId,
          razorpay_payment_id: `pay_test_${Date.now()}`,
          razorpay_signature: 'verified_dev',
        });

        setConfirmedData({
          tournamentName: tournament.name,
          captainName,
          captainEmail,
          squadId: registrationId,
          amountPaid: tournament.entryFee,
        });
        setCurrentStep(4);
        triggerConfetti();
        return;
      }

      // Live / Sandbox Razorpay Modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amountInPaise,
        currency: orderData.currency || 'INR',
        name: 'FREE FIRE ARENA',
        description: `Squad Entry Fee for ${tournament.name}`,
        order_id: orderData.orderId,
        prefill: {
          name: captainName,
          email: captainEmail,
          contact: captainPhone,
        },
        theme: {
          color: '#ff5500',
        },
        handler: async function (response) {
          try {
            setIsSubmitting(true);
            const verifyRes = await verifyPayment({
              registrationId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            setConfirmedData({
              tournamentName: tournament.name,
              captainName,
              captainEmail,
              squadId: registrationId,
              amountPaid: tournament.entryFee,
            });
            setCurrentStep(4);
            triggerConfetti();
          } catch (verErr) {
            setErrorMessage(verErr.message || 'Server-side payment verification failed.');
          } finally {
            setIsSubmitting(false);
          }
        },
        modal: {
          ondismiss: function () {
            setIsSubmitting(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        setErrorMessage(`Payment failed: ${resp.error?.description || 'Transaction cancelled'}`);
        setIsSubmitting(false);
      });
      rzp.open();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to initialize payment.');
      setIsSubmitting(false);
    }
  };

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff5500', '#ff2a4b', '#00ffcc', '#ffb700'],
      });
    } catch {}
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
            { num: 2, label: 'OTP VERIFY' },
            { num: 3, label: 'ENTRY FEE (₹40)' },
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
              <h2 style={{ fontSize: '24px', color: '#ffffff' }}>REGISTER 4-PLAYER SQUAD</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                Provide exact player names and Free Fire UID/IDs. Room credentials will be sent to the Captain email.
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
                  <Flame size={16} /> PLAYER 1 (CAPTAIN & CONTACT PERSON)
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
                      onChange={(e) => setCaptainEmail(e.target.value)}
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

              {/* Player 2 */}
              <div style={{
                background: '#0e1018',
                border: '1px solid #1f2336',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                marginBottom: '20px',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', marginBottom: '14px', textTransform: 'uppercase' }}>
                  PLAYER 2 DETAILS
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Player 2 Full Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Rohit Varma"
                      value={player2Name}
                      onChange={(e) => setPlayer2Name(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Player 2 Free Fire ID *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 2938472910"
                      value={player2FreeFireId}
                      onChange={(e) => setPlayer2FreeFireId(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Player 3 */}
              <div style={{
                background: '#0e1018',
                border: '1px solid #1f2336',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                marginBottom: '20px',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', marginBottom: '14px', textTransform: 'uppercase' }}>
                  PLAYER 3 DETAILS
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Player 3 Full Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Sanjay Kumar"
                      value={player3Name}
                      onChange={(e) => setPlayer3Name(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Player 3 Free Fire ID *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 3948271029"
                      value={player3FreeFireId}
                      onChange={(e) => setPlayer3FreeFireId(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Player 4 */}
              <div style={{
                background: '#0e1018',
                border: '1px solid #1f2336',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                marginBottom: '25px',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', marginBottom: '14px', textTransform: 'uppercase' }}>
                  PLAYER 4 DETAILS
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Player 4 Full Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Vikram Singh"
                      value={player4Name}
                      onChange={(e) => setPlayer4Name(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Player 4 Free Fire ID *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 4829103948"
                      value={player4FreeFireId}
                      onChange={(e) => setPlayer4FreeFireId(e.target.value)}
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
                {isSubmitting ? 'SUBMITTING & SENDING OTP...' : 'SUBMIT SQUAD & VERIFY EMAIL'}
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
            <div style={{ textAlign: 'center', marginBottom: '25px' }}>
              <div className="badge badge-open" style={{ marginBottom: '10px' }}>
                EMAIL VERIFIED ✓
              </div>
              <h2 style={{ fontSize: '26px', color: '#ffffff' }}>SQUAD ENTRY FEE PAYMENT</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
                Complete your ₹{tournament.entryFee} entry fee payment to confirm your 4-player squad slot.
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
                  ₹{tournament.entryFee}
                </span>
              </div>
            </div>

            {/* Payment Button */}
            <button
              onClick={handlePayEntryFee}
              disabled={isSubmitting}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', padding: '18px', fontSize: '18px' }}
            >
              <CreditCard size={22} />
              {isSubmitting ? 'PROCESSING PAYMENT...' : `PAY ₹${tournament.entryFee} VIA RAZORPAY`}
            </button>

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
              100% Secure 256-Bit SSL Encrypted Payment (Razorpay / UPI / Cards / NetBanking)
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
                👥 <strong>Squad Captain:</strong> {confirmedData.captainName} (Squad #{confirmedData.squadId})<br />
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
                "Your Room ID and Password will be sent to your verified email <strong>10 minutes before the tournament starts</strong>."
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
