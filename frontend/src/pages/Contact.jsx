import React, { useState } from 'react';
import { Mail, PhoneCall, MessageSquare, Send, CheckCircle2, Headphones, HelpCircle } from 'lucide-react';
import { submitContactMessage } from '../services/api';

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setSent(false);
    setErrorMessage('');
    try {
      await submitContactMessage({ name, email, subject, message });
      setSent(true);
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (error) {
      setErrorMessage(error.message || 'We could not send your message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ padding: '40px 0 80px' }}>
      <div className="container" style={{ maxWidth: '950px' }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div className="badge badge-gold" style={{ marginBottom: '10px' }}>
            24/7 HELPDESK & PLAYER SUPPORT
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 42px)', marginBottom: '10px' }}>
            CONTACT & ASSISTANCE
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
            Have questions about room credentials, registrations, or payouts? Our team is here to help.
          </p>
        </div>

        {/* Support Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '25px',
          marginBottom: '40px',
        }}>
          {/* Email Support Card */}
          <div className="ffa-card" style={{ padding: '25px', display: 'flex', gap: '16px' }}>
            <div style={{
              width: '45px',
              height: '45px',
              borderRadius: '10px',
              background: 'rgba(255, 85, 0, 0.15)',
              color: 'var(--accent-orange)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Mail size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', color: '#ffffff', marginBottom: '4px' }}>EMAIL SUPPORT</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Official inquiry inbox</p>
              <a href="mailto:support@freefirearena.com" style={{ fontSize: '14px', color: 'var(--accent-orange)', fontWeight: 700 }}>
                support@freefirearena.com
              </a>
            </div>
          </div>

          {/* WhatsApp / Phone Support */}
          <div className="ffa-card" style={{ padding: '25px', display: 'flex', gap: '16px' }}>
            <div style={{
              width: '45px',
              height: '45px',
              borderRadius: '10px',
              background: 'rgba(0, 230, 118, 0.15)',
              color: 'var(--accent-green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <PhoneCall size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', color: '#ffffff', marginBottom: '4px' }}>WHATSAPP HELPDESK</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Direct match coordinator</p>
              <div style={{ fontSize: '14px', color: 'var(--accent-green)', fontWeight: 700 }}>
                +91 98765 43210 (10 AM - 11 PM IST)
              </div>
            </div>
          </div>

          {/* Discord Community */}
          <div className="ffa-card" style={{ padding: '25px', display: 'flex', gap: '16px' }}>
            <div style={{
              width: '45px',
              height: '45px',
              borderRadius: '10px',
              background: 'rgba(0, 255, 204, 0.15)',
              color: 'var(--accent-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <MessageSquare size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', color: '#ffffff', marginBottom: '4px' }}>DISCORD COMMUNITY</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Match announcements & results</p>
              <span style={{ fontSize: '14px', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                discord.gg/freefirearena
              </span>
            </div>
          </div>
        </div>

        {/* FAQs */}
        <div className="ffa-card" style={{ padding: '35px', marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '25px' }}>
            <HelpCircle size={24} color="var(--accent-gold)" />
            <h2 style={{ fontSize: '22px', color: '#ffffff' }}>FREQUENTLY ASKED QUESTIONS</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h4 style={{ color: 'var(--accent-orange)', fontSize: '15px', marginBottom: '6px' }}>
                When and how do I receive the Room ID and Password?
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6' }}>
                Our automated server dispatches the Custom Room ID and Password directly to your verified Captain email address exactly <strong>10 minutes before the match start time</strong>. Please check your Inbox and Spam/Promotions folder.
              </p>
            </div>

            <div>
              <h4 style={{ color: 'var(--accent-orange)', fontSize: '15px', marginBottom: '6px' }}>
                How is the winner prize funded?
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6' }}>
                The winner prize displayed for a tournament is funded and paid separately by the tournament organizer. Team registration fees are not pooled or used to fund prizes.
              </p>
            </div>

            <div>
              <h4 style={{ color: 'var(--accent-orange)', fontSize: '15px', marginBottom: '6px' }}>
                Can I edit or substitute a player after registration?
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6' }}>
                Player changes can be requested via WhatsApp Support up to 1 hour before match start time by providing your Squad ID and registered captain email.
              </p>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="ffa-card" style={{ padding: '35px' }}>
          <h3 style={{ fontSize: '20px', color: '#ffffff', marginBottom: '8px' }}>SEND US A MESSAGE</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '25px' }}>
            Fill out the form below and our tournament administrators will respond promptly.
          </p>

          {sent && (
            <div className="alert alert-success">
              <CheckCircle2 size={20} />
              Thank you! Your message has been received. Our support team will get back to you shortly.
            </div>
          )}

          {errorMessage && (
            <div className="alert alert-error">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
              <div className="form-group">
                <label className="form-label">Your Name</label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  className="form-input"
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Your Email</label>
                <input
                  type="email"
                  required
                  maxLength={254}
                  className="form-input"
                  placeholder="e.g. rahul@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Subject</label>
              <input
                type="text"
                required
                maxLength={150}
                className="form-input"
                placeholder="e.g. Room ID inquiry / Match Question"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Message</label>
              <textarea
                rows={4}
                required
                maxLength={5000}
                className="form-textarea"
                placeholder="Type your message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <button type="submit" disabled={sending} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
              <Send size={18} /> {sending ? 'SENDING...' : 'SEND MESSAGE'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
