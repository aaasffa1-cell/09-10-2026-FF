# Free Fire Arena - BR Esports Tournament Registration System

A full-stack esports tournament registration platform built for Free Fire Battle Royale (BR) 4-player squad tournaments with server-side OTP email verification, Razorpay integration, strict slot concurrency management, private room credentials handling, and automated 10-minute pre-match email scheduling.

---

## 🚀 Technology Stack

- **Frontend:** React.js (JavaScript), HTML, Vanilla CSS (Esports Dark Theme), Vite
- **Backend:** Node.js, Express.js (REST API)
- **Database:** PostgreSQL (Pure SQL schema, parameterized queries, transactions, indexes, constraints)
- **Payments:** Razorpay SDK (Server-controlled ₹40 fee, cryptographic HMAC-SHA256 signature verification)
- **Email:** Nodemailer (HTML templates for OTP, Confirmations, and Room Credentials)
- **Scheduler:** Node-Cron (Server-side 10-minute pre-match trigger with duplicate protection via SQL logs)

---

## 📁 Project Architecture

```
newarena/
├── backend/
│   ├── src/
│   │   ├── controllers/       # Tournament, Registration, Payment, Admin, and Room controllers
│   │   ├── database/          # schema.sql, seed.sql, db.js connection pool & migration runner
│   │   ├── jobs/              # roomScheduler.js (Node-Cron automated 10-min email runner)
│   │   ├── middleware/        # authMiddleware, rateLimiter, validateMiddleware
│   │   ├── routes/            # tournamentRoutes, registrationRoutes, paymentRoutes, adminRoutes
│   │   ├── services/          # emailService, otpService, razorpayService
│   │   ├── test/              # fullFlowTest.js, e2eHttpTest.js
│   │   └── server.js          # Express API server entry point
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/        # Navbar, Footer, LoadingSpinner, ProtectedRoute
    │   │   ├── pages/             # Home, Tournaments, TournamentDetail, Register, Rules, Contact
    │   │   │   └── admin/         # AdminLogin, AdminDashboard, AdminTournaments, AdminRegistrations, AdminRoomCredentials
    │   ├── services/          # api.js
    │   ├── index.css          # Esports design system & styling
    │   └── App.jsx            # React router definitions
    └── package.json
```

---

## ⚙️ Setup & Running Locally

### 1. Backend Setup
```bash
cd backend
npm install
npm run db:setup     # Runs SQL migrations and seed data
npm start            # Runs Express server on http://localhost:5000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev          # Runs Vite client on http://localhost:5173
```

---

## 🔑 Initial Admin Credentials
- **Email:** `admin@freefirearena.com`
- **Password:** `admin123456`
