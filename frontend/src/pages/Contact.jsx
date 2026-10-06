import React, { useState } from 'react';
import { Mail, PhoneCall, MessageSquare, Send, CheckCircle2, Headphones, HelpCircle } from 'lucide-react';

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
    setName('');
    setEmail('');
    setSubject('');
    setMessage('');
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
                How is the tournament prize pool distributed?
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6' }}>
                Prize money is sent via instant UPI (Google Pay, PhonePe, Paytm, BHIM) to the winning squad captain within 30 minutes following final match screenshot verification.
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

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
              <div className="form-group">
                <label className="form-label">Your Name</label>
                <input
                  type="text"
                  required
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
                className="form-textarea"
                placeholder="Type your message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }}>
              <Send size={18} /> SEND MESSAGE
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
