import React from 'react';
import { Link } from 'react-router-dom';
import { Flame, Headphones } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-content">
        <Link to="/" className="footer-brand"><Flame size={20} /> Free Fire Arena</Link>
        <span className="support-contact"><Headphones size={16} /> Support: <a href="mailto:aasffa1@gmail.com">aasffa1@gmail.com</a> · <a href="https://t.me/gaiusmorgan901" target="_blank" rel="noreferrer">Telegram @gaiusmorgan901</a></span>
        <span>© {new Date().getFullYear()} Free Fire Arena · Asia/Kolkata (IST)</span>
      </div>
    </footer>
  );
}
