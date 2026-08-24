# Healthcare Appointment & Follow-up Manager

## Project Overview
A comprehensive, multi-portal healthcare management platform designed to streamline the appointment lifecycle for patients, doctors, and administrators. The system handles role-based access, concurrency-safe booking, LLM-powered pre-visit and post-visit summaries, background medication reminders, email notifications, and Google Calendar synchronization.

## Tech Stack & Architecture
- **Backend**: FastAPI (Python 3.12+), SQLAlchemy (Async), asyncpg, Pydantic, Celery (Background Jobs).
- **Frontend**: React 18, Vite, TanStack Router, TailwindCSS, TypeScript.
- **Database**: PostgreSQL 16 (Relational data), Redis 7 (Celery Broker/Backend).
- **Integrations**: Anthropic Claude 3.5 Sonnet (LLM Summaries), SendGrid (Emails), Google Calendar API (OAuth 2.0).
- **Concurrency Strategy**: `SELECT FOR UPDATE SKIP LOCKED` combined with partial unique indexes to guarantee race-condition-free bookings and idempotent background job processing.

## Setup Guide (Local Development)

### Prerequisites
- Python 3.12+ and `uv` package manager.
- Node.js 20+ and `pnpm` (v11+).
- Docker & Docker Compose (for Postgres and Redis).

### 1. Database & Cache
```bash
docker compose up -d
```
This spins up PostgreSQL on port 5432 and Redis on port 6379.

### 2. Backend Setup
```bash
cd backend
uv venv
uv pip install -e .
uv run alembic upgrade head
```

Run the API server:
```bash
uv run uvicorn app.main:app --reload --port 8000
```

### 3. Background Job Worker (Celery)
In a separate terminal, start the Celery worker and Beat scheduler:
```bash
cd backend
uv run celery -A app.workers.celery_app worker --loglevel=info
uv run celery -A app.workers.celery_app beat --loglevel=info
```

### 4. Frontend Setup
```bash
cd frontend
pnpm install
pnpm dev
```
The frontend runs on `http://localhost:5173`.

## Environment Variables (`.env.example`)

Create a `.env` file in the `backend/` directory using these categories:

```env
# --- App Core ---
APP_ENV=development # development | production
APP_SECRET_KEY=change-me-to-a-long-random-string # General crypto key
APP_ALLOWED_ORIGINS=http://localhost:5173 # CORS origins

# --- Database ---
# PostgreSQL connection string
DATABASE_URL=postgresql+asyncpg://healthcare_user:healthcare_pass@localhost:5432/healthcare_db

# --- JWT Auth ---
JWT_SECRET_KEY=change-me-to-another-long-random-string # Used to sign JWTs
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# --- Redis / Celery (Background Jobs) ---
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1

# --- LLM (Anthropic) ---
ANTHROPIC_API_KEY=sk-ant-... # Claude API key
ANTHROPIC_MODEL=claude-3-5-sonnet-20240620 # Target model
LLM_TIMEOUT_SECONDS=10.0 # Timeout for API calls
LLM_MAX_ATTEMPTS=3 # Max retries for failures
LLM_INITIAL_DELAY=1.0 # Backoff starting delay

# --- Email (SendGrid) ---
SENDGRID_API_KEY=SG.... # SendGrid API key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com # Verified sender email
SENDGRID_FROM_NAME=HealthCare Manager # Display name
APP_BASE_URL=http://localhost:5173 # Base URL for email links
CLINIC_ADDRESS=HealthCare Clinic, 123 Main St, Bangalore

# --- Google OAuth / Calendar ---
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/oauth/google/callback
```

## Database Schema Highlights
- **users**: Base table for Patients, Doctors, and Admins (`id`, `role`, `hashed_password`).
- **doctor_profiles**: 1-to-1 with users (role=doctor), stores `working_days`, `slot_duration_minutes`.
- **doctor_leaves**: Tracks doctor unavailability.
- **appointments**: Core transactional table. Uses partial unique index (`doctor_id`, `slot_start`) `WHERE status IN ('held', 'confirmed')` to prevent double-booking.
- **symptom_forms**: Pre-visit symptoms submitted by patient.
- **visit_notes**: Doctor's clinical notes, diagnosis, and follow-up data.
- **prescriptions**: Tracks medication. Includes `times_per_day`, `reminder_times` (JSONB), and `duration_days` for automated Celery reminders.
- **notifications**: Email tracking queue (`status`, `retry_count`, `error_message`).
- **calendar_events**: Tracks Google Calendar sync status and IDs.
- **google_calendar_tokens**: Secure storage for OAuth access/refresh tokens.
- **pre_visit_summaries / post_visit_summaries**: Results of LLM processing, tracking `status` (pending/success/failed).

## LLM Prompts & Schemas

### 1. Pre-Visit Triage Summary
**Prompt:**
```text
You are a medical triage assistant. Analyse the patient's symptoms and respond
with ONLY a valid JSON object — no preamble, no explanation, no markdown.
The JSON must exactly match this schema:
{
  "urgency": "Low" | "Medium" | "High",
  "chief_complaint": "<string, the primary medical complaint in one sentence>",
  "suggested_questions": ["<question 1>", "<question 2>", "<question 3>"]
}
urgency levels: Low = routine, Medium = needs attention soon, High = urgent.
Do not include any text outside the JSON object.
Symptoms: {symptoms}
```
**Failure Handling:** Handled asynchronously via `BackgroundTasks`. Retries 3 times on `JSONDecodeError` or `ValidationError` with exponential backoff. Marks as `failed` on permanent errors, allowing manual retry by Admin/Doctor.

### 2. Post-Visit Patient Summary
**Prompt:**
```text
You are a medical communication assistant. Convert clinical notes into a
patient-friendly post-visit summary. Respond ONLY with a valid JSON object.
The JSON must exactly match this schema:
{
  "summary": "<plain English summary of the visit, what was found, what to do>",
  "medication_schedule": [
    {
      "medicine": "<name>",
      "dosage": "<amount>",
      "frequency": "<how often>",
      "duration_days": <integer or null>,
      "instructions": "<special notes or null>"
    }
  ],
  "follow_up_steps": "<what the patient should do next, plain English>"
}
Write for a patient with no medical background. Avoid jargon. Be concise but complete.
Notes: {raw_notes}
```

## API Documentation (Key Endpoints)

**Auth (`/api/v1/auth`)**
- `POST /register`: Register new user.
- `POST /login`: Authenticate and set HttpOnly JWT cookie.

**Admin (`/api/v1/admin`)**
- `POST /doctors`: Create doctor profile.
- `POST /doctors/{id}/leaves`: Mark doctor leave (triggers conflict cancellation).
- `GET /jobs/stats`: View background worker health (failed notifications, reminders).

**Patient (`/api/v1/patient`)**
- `GET /doctors`: Search doctors.
- `GET /doctors/{id}/slots`: Get available slots.
- `POST /appointments/hold`: Temporarily reserve slot (5m expiry).
- `POST /appointments/{id}/confirm`: Confirm booking (triggers Email + Calendar + Pre-visit LLM).

**Doctor (`/api/v1/doctor`)**
- `GET /appointments`: View schedule + pre-visit summaries.
- `POST /appointments/{id}/complete`: Submit clinical notes & prescriptions (triggers Post-visit LLM).

**OAuth (`/api/v1/oauth`)**
- `GET /google/login`: Initiate Google Calendar OAuth.
- `GET /google/callback`: Store tokens.

## Google Calendar Setup
1. Go to Google Cloud Console > APIs & Services > Credentials.
2. Create OAuth 2.0 Client IDs (Web application).
3. Set Authorized redirect URIs to match `GOOGLE_REDIRECT_URI` (e.g., `http://localhost:8000/api/v1/oauth/google/callback`).
4. Enable the **Google Calendar API**.
5. Add the generated Client ID and Secret to your `.env` file.
6. The app handles `refresh_token` revocation automatically by catching `RefreshError` and disconnecting the user locally.

## Deployment Strategy
- **Frontend**: Vercel (zero-config for Vite/React applications). Set env variable `VITE_API_URL` to point to the backend.
- **Backend & Background Workers**: Render.com.
  - *Web Service*: FastAPI app running `uvicorn`.
  - *Background Worker*: Celery worker process.
  - *Cron Job*: Celery Beat or Render Cron triggering `beat`.
- **Database**: Render PostgreSQL or Supabase.
- **Cache**: Render Redis or Upstash.
- **Limitations on Free Tier**: Render's free tier spins down inactive web services (cold starts take ~50s, affecting HTTP requests) and restricts background worker execution time. Vercel serverless functions have a 10s timeout on the Hobby tier, but since we use Render for the backend, only the Vite static build is hosted on Vercel.

## Known Limitations & Future Improvements
1. **Google Calendar Real-Time Updates**: We use lazy-detection for revoked tokens. Implementing Google Calendar Webhooks (Push Notifications) would allow instant reaction if a user deletes an event natively in Google.
2. **WebSocket Notifications**: Currently, the UI relies on polling or manual refresh to see LLM summary status updates (`pending` -> `success`). Integrating WebSockets would make the dashboard real-time.
3. **Database Migrations**: The project assumes Alembic migrations are run manually during deployment. A CI/CD step using GitHub Actions should automate `alembic upgrade head`.
