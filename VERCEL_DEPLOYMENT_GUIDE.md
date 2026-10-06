# 🚀 Free Fire Arena - Complete Vercel Deployment Guide

This guide walks you step-by-step through deploying your **Free Fire Arena** full-stack esports tournament platform to **Vercel**.

---

## 📋 Overview of Deployment Architecture

- **Frontend:** React + Vite SPA deployed on Vercel's Edge Network / CDN.
- **Backend:** Express API running seamlessly as a Vercel Serverless Function (`/api/*`).
- **Database:** Managed Cloud PostgreSQL (e.g., [Neon.tech](https://neon.tech) or [Supabase](https://supabase.com) - both offer generous free tiers).
- **Match Scheduler:** Free tier friendly &mdash; trigger room credentials via Admin Panel or free external cron pinger (e.g., [cron-job.org](https://cron-job.org)) hitting `/api/cron/check-rooms`.

---

## Step 1: Create a Free Cloud PostgreSQL Database

Because Vercel runs serverless functions, you need a persistent cloud PostgreSQL database:

### Option A: Neon.tech (Recommended - Takes 1 minute)
1. Go to [https://neon.tech](https://neon.tech) and sign up for a free account.
2. Create a new project (e.g., `freefire-arena-db`).
3. Under **Dashboard**, copy your **Connection String** (`postgresql://...`). It will look like:
   ```env
   postgresql://neondb_owner:npg_xxxx@ep-cool-fog-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

### Option B: Supabase
1. Go to [https://supabase.com](https://supabase.com) and create a new project.
2. Go to **Project Settings > Database > Connection string > URI** and copy the Postgres URL.

---

## Step 2: Initialize Database Schema & Seed Data

Before deploying, run the database setup script once to create the tables, indexes, constraints, and default admin user.

In your terminal / PowerShell in the project directory:

```bash
# 1. Set your DATABASE_URL in backend/.env (or pass in terminal)
# In backend/.env, ensure:
# DATABASE_URL=your_copied_postgresql_connection_string

# 2. Run the database setup script
npm run db:setup
```

You will see:
```text
[DB] Connected to PostgreSQL database successfully.
[DB] Running schema migrations...
[DB] Schema migrations completed.
[DB] Seeding initial data...
[DB] Seed data populated successfully.
[Migration] Migration finished successfully.
```

---

## Step 3: Deploy to Vercel

You can deploy using either **Vercel Dashboard (GitHub)** or **Vercel CLI**.

### Method 1: Deploy via GitHub (Recommended)

1. Push your project to a GitHub repository:
   ```bash
   git add .
   git commit -m "Configure project for Vercel deployment"
   git push origin main
   ```
2. Go to [https://vercel.com/new](https://vercel.com/new) and log in.
3. Select **"Import Git Repository"** and select your repository (`newarena`).
4. In the configuration screen:
   - **Framework Preset:** `Vite` (or `Other`)
   - **Root Directory:** `./` (leave default root)
   - **Build Command:** `npm run vercel-build` (or leave as configured in `vercel.json`)
   - **Output Directory:** `frontend/dist`
5. Expand **Environment Variables** and add the variables listed in [Step 4](#step-4-configure-environment-variables-on-vercel).
6. Click **Deploy**! 🚀

---

### Method 2: Deploy via Vercel CLI (Direct from Terminal)

1. Open your terminal in the root project folder:
   ```bash
   npx vercel
   ```
2. Follow the interactive prompts:
   - `Set up and deploy?` &rarr; **y**
   - `Which scope do you want to deploy to?` &rarr; Select your Vercel account
   - `Link to existing project?` &rarr; **N**
   - `What's your project's name?` &rarr; **freefire-arena** (or press Enter)
   - `In which directory is your code located?` &rarr; **./**
3. When ready for production deployment:
   ```bash
   npx vercel --prod
   ```

---

## Step 4: Configure Environment Variables on Vercel

Go to **Vercel Dashboard &rarr; Your Project &rarr; Settings &rarr; Environment Variables** and add:

| Variable Name | Description | Example / Recommended Value |
|---|---|---|
| `DATABASE_URL` | Cloud PostgreSQL connection string from Step 1 | `postgresql://user:pass@ep-xyz.aws.neon.tech/neondb?sslmode=require` |
| `DB_SSL` | Enable SSL for cloud database connection | `true` |
| `NODE_ENV` | Environment mode | `production` |
| `SESSION_SECRET` | Secret key for JWT admin authentication | `any_long_random_secret_string_123` |
| `TZ` | Timezone for match scheduling and timestamps | `Asia/Kolkata` |
| `RAZORPAY_KEY_ID` | Razorpay Key ID (Test or Live) | `rzp_test_...` or `rzp_live_...` |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret | `your_razorpay_secret` |
| `EMAIL_HOST` | SMTP server host | `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP port | `587` |
| `EMAIL_USER` | Gmail/Email account | `your_email@gmail.com` |
| `EMAIL_PASSWORD` | Google 16-character App Password | `abcd efgh ijkl mnop` |
| `EMAIL_FROM` | Sender address | `"Free Fire Arena <support@freefirearena.com>"` |
| `ADMIN_EMAIL` | Default admin email | `admin@freefirearena.com` |
| `ADMIN_PASSWORD` | Default admin password | `admin123456` |
| `CRON_SECRET` | Secret to secure scheduled cron triggers | `ffa_cron_secret_key_2026` |

> 💡 **Tip for Gmail SMTP:** Generate a 16-character App Password by going to [Google Account > Security > 2-Step Verification > App passwords](https://myaccount.google.com/apppasswords).

After updating environment variables, go to **Deployments** &rarr; click the three dots on the latest deployment &rarr; select **Redeploy**.

---

## Step 5: Verify Your Live Deployment

Once deployed, test the following key flows on your live `https://your-project.vercel.app` URL:

1. **Tournaments Page (`/tournaments`):**
   - Verify public tournaments load cleanly from the database.
2. **Squad Registration & OTP:**
   - Click **Register**, enter captain and squad member details.
   - Verify OTP is sent to the captain's email and verified accurately.
3. **Razorpay Payment:**
   - Complete checkout with Razorpay test cards/UPI.
   - Verify registration status updates to `CONFIRMED` and slot count decreases.
4. **Admin Panel (`/admin`):**
   - Log in with `admin@freefirearena.com` / `admin123456`.
   - Test creating a tournament, saving custom room credentials (Room ID + Password), and viewing confirmed squads.
5. **Room Credentials Dispatch:**
   - On the Vercel free tier, automated room credentials dispatch can be triggered manually from the Admin dashboard or by setting up a 100% free external cron pinger (e.g., [cron-job.org](https://cron-job.org)) pointing to `https://your-project.vercel.app/api/cron/check-rooms`.

---

## 🛠️ Summary of Created / Configured Files

- [`vercel.json`](file:///c:/Users/bhara/OneDrive/Desktop/newarena/vercel.json) &mdash; Root Vercel configuration for SPA rewrites and serverless function routing (Free tier optimized without Vercel crons).
- [`api/index.js`](file:///c:/Users/bhara/OneDrive/Desktop/newarena/api/index.js) &mdash; Serverless adapter connecting Vercel requests to Express and database pool.
- [`frontend/vercel.json`](file:///c:/Users/bhara/OneDrive/Desktop/newarena/frontend/vercel.json) &mdash; Direct SPA rewrite rules for standalone frontend deployments.
- [`package.json`](file:///c:/Users/bhara/OneDrive/Desktop/newarena/package.json) &mdash; Monorepo scripts for builds, database setup, and dependencies.
- [`.env.example`](file:///c:/Users/bhara/OneDrive/Desktop/newarena/.env.example) &mdash; Production environment variables reference.
- [`frontend/src/services/api.js`](file:///c:/Users/bhara/OneDrive/Desktop/newarena/frontend/src/services/api.js) &mdash; Dynamic API base URL configuration supporting both serverless `/api` and custom backend domains.
- [`backend/src/server.js`](file:///c:/Users/bhara/OneDrive/Desktop/newarena/backend/src/server.js) &mdash; Updated with CORS support for Vercel preview URLs and cron endpoint.
- [`backend/src/database/db.js`](file:///c:/Users/bhara/OneDrive/Desktop/newarena/backend/src/database/db.js) &mdash; Cloud PostgreSQL SSL auto-detection for Neon/Supabase.
