# AIUGIP LMS — Learning Management System

**All India Undergraduate Internship Program** — Full-stack LMS built with React (Vite) on the frontend and FastAPI (Python) on the backend, using MongoDB Atlas for data and Cloudflare R2 for file storage.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Tech Stack](#tech-stack)
3. [Local Development](#local-development)
4. [Deploying the Backend on Railway](#deploying-the-backend-on-railway)
5. [Deploying the Frontend on Vercel](#deploying-the-frontend-on-vercel)
6. [Environment Variables Reference](#environment-variables-reference)
7. [Post-Deployment Checklist](#post-deployment-checklist)
8. [Architecture Notes](#architecture-notes)

---

## Project Structure

```
lms/
├── frontend/          # React + Vite SPA
│   ├── src/
│   │   ├── pages/     # All route components (student + admin)
│   │   ├── context/   # AuthContext
│   │   └── services/  # api.js — Axios client
│   ├── vercel.json    # Vercel SPA rewrite rules
│   ├── .env.example   # Frontend env template
│   └── package.json
│
├── backend/           # FastAPI application
│   ├── app/
│   │   ├── main.py    # App entry point, CORS, router registration
│   │   ├── config.py  # Settings loaded from environment
│   │   ├── database.py
│   │   ├── routers/   # auth, courses, quizzes, assignments, grades, certificates, admin
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/  # r2_storage, seed_data, etc.
│   │   └── utils/
│   ├── railway.toml   # Railway deployment config
│   ├── Procfile       # Optional process type (Railway / Heroku-style)
│   ├── runtime.txt    # Nixpacks Python version (3.12)
│   ├── .env.example   # Backend env template
│   └── requirements.txt
│
├── .gitignore
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, React Router 7, Axios, Recharts |
| Backend | FastAPI, Uvicorn, Beanie (ODM), Motor (async MongoDB driver) |
| Database | MongoDB Atlas |
| File Storage | Cloudflare R2 (S3-compatible) |
| Auth | JWT (stored in cookie + `Authorization: Bearer` header) |
| Email / OTP | SMTP (Gmail App Password recommended) |
| Frontend Hosting | Vercel |
| Backend Hosting | Railway |

---

## Local Development

### Prerequisites

- Node.js ≥ 18
- Python **3.12** (recommended; matches Railway `runtime.txt`; 3.11–3.13 also work with current pins)
- A running MongoDB instance or MongoDB Atlas connection string

### Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and fill in env vars
cp .env.example .env
# Edit .env with your MongoDB URL, SECRET_KEY, etc.

# Run dev server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API will be at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy and fill in env vars
cp .env.example .env.local
# Set VITE_API_URL=http://localhost:8000/api

# Run dev server
npm run dev
```

App will be at `http://localhost:5173`.

---

## Deploying the Backend on Railway

### Step 1 — Create a Railway project

1. Go to [railway.app](https://railway.app) and sign in.
2. Click **New Project → Deploy from GitHub repo**.
3. Select your repository and choose the **`backend`** folder as the root directory.
   - In Railway project settings → **Source** → set **Root Directory** to `backend`.

### Step 2 — Set environment variables

In your Railway service → **Variables** tab, add every variable from `backend/.env.example`. The minimum required set:

| Variable | Description |
|---|---|
| `MONGODB_URL` | MongoDB Atlas connection string |
| `SECRET_KEY` | Long random string for JWT signing |
| `BASE_URL` | Your Railway public URL (set after first deploy) |
| `CORS_ORIGINS` | Your Vercel frontend URL (e.g. `https://yourapp.vercel.app`) |
| `COOKIE_SECURE` | `true` (production is HTTPS) |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 API key ID |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 API secret |
| `R2_BUCKET_NAME` | Your R2 bucket name |
| `R2_ACCOUNT_ID` | Your Cloudflare account ID |
| `R2_ENDPOINT_URL` | `https://<account_id>.r2.cloudflarestorage.com` |
| `R2_PUBLIC_URL` | Public URL of your R2 bucket |
| `SMTP_USER` | Gmail address for OTP emails |
| `SMTP_PASSWORD` | Gmail App Password |

> **Tip:** Railway injects `PORT` automatically — the `railway.toml` already passes it to Uvicorn via `$PORT`.

### Step 3 — Deploy

Railway auto-deploys on every push to the connected branch. The `railway.toml` file handles the build and start commands:

```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "sh -c 'exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}'"
healthcheckPath = "/health"
```

### Step 4 — Get your backend URL

After deployment, Railway gives you a public URL like `https://lms-backend-production.up.railway.app`. Copy it — you'll need it for the frontend.

### Railway troubleshooting: “service unavailable” on `/health`

Railway’s health check calls `GET /health`. You usually see **service unavailable** when either:

1. **Nothing was listening yet** — Older versions of this app blocked HTTP until MongoDB finished connecting and seeding ran. That is fixed: the server starts immediately and `/health` returns `{"status":"starting","database":"connecting"}` with HTTP 200 while MongoDB connects. After the DB is ready, the same path returns full health (including optional R2 checks).

2. **`MONGODB_URL` is missing or wrong** — If `MONGODB_URL` is not set in Railway, the app falls back to `mongodb://localhost:27017`, which will **not** work on Railway. Set `MONGODB_URL` to your **MongoDB Atlas** connection string (same as local `.env`).

3. **Atlas network access** — In MongoDB Atlas → **Network Access**, allow **`0.0.0.0/0`** (or Railway’s egress IPs) so the deployed container can reach the cluster.

4. **Startup failed** — If init or seed throws, `/health` still returns **200** with `"status":"degraded"`, `"ready":false`, and `"detail"`. Use **`GET /health/ready`** for a strict check (returns **503** until the database is usable). Check **Railway → Deployments → Logs** for `Database init or seed failed`.

5. **`ImportError: cannot import name '_QUERY_OPTIONS' from 'pymongo.cursor'`** — Pip installed **PyMongo 4.16+** while **Motor 3.3.x** expected older internals. This repo pins **Motor 3.7.1**, which supports current PyMongo 4.x. Run `pip install -r requirements.txt` again (or delete `venv` and recreate it) so versions match `requirements.txt`, then redeploy.

After fixing variables, redeploy or restart the service.

---

## Deploying the Frontend on Vercel

### Step 1 — Create a Vercel project

1. Go to [vercel.com](https://vercel.com) and sign in.
2. Click **Add New → Project → Import Git Repository**.
3. Select your repository.
4. In **Configure Project**, set:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build` (auto-detected)
   - **Output Directory:** `dist` (auto-detected)

### Step 2 — Set environment variables

In the Vercel project → **Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://your-backend.railway.app/api` |
| `VITE_STUDENT_COOKIE_NAME` | `lms_student` (or your custom value) |

> Variables prefixed with `VITE_` are inlined at build time by Vite and safe to expose in the browser.

### Step 3 — Deploy

Click **Deploy**. Vercel builds the project and serves it globally via CDN.

The `vercel.json` file at `frontend/vercel.json` ensures all routes are handled by `index.html` (required for React Router's `BrowserRouter`):

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

> Extra safety: there is also a `vercel.json` at the repo root (`/vercel.json`) so SPA rewrites still work even if Vercel’s “Root Directory” setting is set to the repository root.

### Step 4 — Update backend CORS

Once your Vercel URL is known (e.g. `https://yourapp.vercel.app`), update the Railway env var:

```
CORS_ORIGINS=https://yourapp.vercel.app
```

Trigger a Railway redeploy for the change to take effect.

---

## Environment Variables Reference

### Backend (`backend/.env.example`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGODB_URL` | Yes | `mongodb://localhost:27017` | MongoDB Atlas connection string |
| `MONGODB_DB_NAME` | No | `aiugip_lms` | Database name |
| `SECRET_KEY` | Yes | (weak default) | JWT signing secret — always override in production |
| `BASE_URL` | Yes | `http://localhost:8000` | Public URL of the backend |
| `CORS_ORIGINS` | Yes | localhost origins | Comma-separated allowed frontend origins |
| `COOKIE_SECURE` | No | `false` | Set `true` behind HTTPS |
| `STUDENT_COOKIE_NAME` | No | `lms_student` | Auth cookie name |
| `STUDENT_COOKIE_HTTPONLY` | No | `false` | Set `true` to hide cookie from JS |
| `STUDENT_COOKIE_SAMESITE` | No | (auto) | For Vercel->Railway cross-site cookies, set `none` (with `COOKIE_SECURE=true`) |
| `R2_ACCOUNT_ID` | If using R2 | — | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | If using R2 | — | R2 API key ID |
| `R2_SECRET_ACCESS_KEY` | If using R2 | — | R2 API secret |
| `R2_BUCKET_NAME` | If using R2 | — | R2 bucket name |
| `R2_ENDPOINT_URL` | If using R2 | — | `https://<account_id>.r2.cloudflarestorage.com` |
| `R2_PUBLIC_URL` | If using R2 | — | Public CDN/bucket URL for file access |
| `SMTP_HOST` | If using email | `smtp.gmail.com` | SMTP server |
| `SMTP_PORT` | If using email | `587` | SMTP port |
| `SMTP_USER` | If using email | — | Sender email address |
| `SMTP_PASSWORD` | If using email | — | SMTP password / app password |
| `UPLOAD_DIR` | No | `uploads` | Local upload directory (fallback when R2 is off) |
| `CERTIFICATE_DIR` | No | `uploads/certificates` | Certificate storage path |

### Frontend (`frontend/.env.example`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Full backend API URL, e.g. `https://xyz.railway.app/api` |
| `VITE_STUDENT_COOKIE_NAME` | No | Must match backend `STUDENT_COOKIE_NAME` |

---

## Post-Deployment Checklist

- [ ] Backend `/health` returns `"ready": true` and `"status": "healthy"` (or open `/health/ready` and get 200)
- [ ] Backend `/docs` (Swagger UI) is accessible
- [ ] `CORS_ORIGINS` on Railway includes your exact Vercel URL (no trailing slash)
- [ ] `COOKIE_SECURE=true` is set on Railway (HTTPS is enforced)
- [ ] `SECRET_KEY` is a strong random value (not the default)
- [ ] `BASE_URL` on Railway points to the Railway public URL
- [ ] `VITE_API_URL` on Vercel points to the Railway backend `/api` path
- [ ] R2 bucket CORS policy allows the Vercel domain (for direct presigned uploads)
- [ ] MongoDB Atlas IP allowlist includes `0.0.0.0/0` (or specific Railway IPs)
- [ ] Test student registration → login → course enrollment end-to-end
- [ ] Test admin login and dashboard

---

## Architecture Notes

### Authentication

- Student auth uses an **HttpOnly-compatible cookie** (`lms_student`) alongside an `Authorization: Bearer <token>` header. `api.js` prefers the cookie, then falls back to **`localStorage` (`lms_student_jwt`)** after login/register. That fallback is needed when the **frontend and API are on different domains** (e.g. Vercel + Railway): the Railway cookie is **third-party** for the Vercel origin, and Safari / ITP often drops it on refresh even when `SameSite=None; Secure`.
- Admin auth uses `localStorage` (`adminToken`).

### File Uploads

- When Cloudflare R2 env vars are configured, all file uploads (videos, PDFs, assignment submissions, certificates) go directly to R2.
- Without R2 config, files fall back to local disk under `uploads/` — **this will not persist on Railway** (ephemeral filesystem). Always configure R2 for production.

### Seed Data

- On every backend startup, `seed_demo_data()` runs and populates demo courses, a demo student, and an admin account if they don't already exist. This is safe to run repeatedly (idempotent).

### Database

- MongoDB Atlas (free M0 tier works for development). Enable **network access for all IPs (`0.0.0.0/0`)** in Atlas, or add Railway's outbound IP ranges.
