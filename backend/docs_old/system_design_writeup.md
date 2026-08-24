# System Design & Architecture Write-Up
**Healthcare Appointment & Follow-up Manager**

## 1. System Overview
The Healthcare Appointment & Follow-up Manager is a full-stack, multi-portal system catering to patients, doctors, and administrators. It manages the entire appointment lifecycle, leveraging modern concurrency controls to prevent booking conflicts, background queues for asynchronous tasks, and Large Language Models (LLMs) to enhance clinical documentation. 

The architecture is split between a React SPA frontend (Vite/TanStack Router) deployed on Vercel, and a Python FastAPI backend deployed on Render. The primary data stores are PostgreSQL (relational data and locking) and Redis (task queue brokering).

## 2. Concurrency & Booking Integrity
A core requirement of the system is absolute protection against double-booking and race conditions during high-traffic scheduling. The system employs a two-layered concurrency strategy:

1. **Database-Level Backstop**: We replaced standard unique constraints with a PostgreSQL **Partial Unique Index** on `(doctor_id, slot_start)` where `status IN ('held', 'confirmed')`. This ensures that cancelled or expired slots do not permanently block future bookings for the same time, while physically preventing two active appointments from occupying the same slot.
2. **Application-Level Locking**: When a patient selects a slot, the system executes a `SELECT FOR UPDATE SKIP LOCKED` query within a transaction. This creates an exclusive row-level lock. If two users attempt to hold the same slot at the exact same millisecond, the database serializes the requests. The loser immediately receives a 409 Conflict, while the winner secures a 5-minute hold.

**Hold Expiry**: Holds expire lazily. Rather than relying on a brittle cron job to clean up expired holds, the slot generation query filters out holds where `expires_at <= now()`. This ensures absolute real-time accuracy without background polling.

## 3. Asynchronous Workflows & LLM Integration
The system integrates Anthropic’s Claude 3.5 Sonnet to generate pre-visit symptom summaries and post-visit patient-friendly instructions. 

To ensure the core booking transaction is never blocked by third-party API latency or outages, all LLM calls are orchestrated asynchronously:
*   In the initial stages (Steps 4 & 6), we utilized FastAPI's built-in `BackgroundTasks` for fire-and-forget processing.
*   The system uses strict Pydantic schemas to validate JSON outputs. 
*   **Graceful Degradation**: If an LLM call fails permanently (e.g., Anthropic is down), the appointment confirmation is unaffected. The patient simply sees the doctor's raw clinical notes instead of a blank screen, ensuring continuous access to care instructions.

## 4. Background Job System & Idempotency
For scalable and isolated task execution (medication reminders, notification retries, and calendar syncing), the architecture utilizes **Celery** (backed by Redis) paired with **Celery Beat** as the scheduler. 

While a simple OS cron script was considered, a distributed queue was chosen to guarantee **crash isolation**. If one email in a batch of 100 has a malformed address and crashes its task, Celery ensures the remaining 99 emails are still processed independently.

**Preventing Double-Processing:**
To guarantee idempotency across multiple concurrent Celery workers, we implemented database-level atomic row claiming. Before sending reminders, the Celery Beat scanner executes:
```sql
UPDATE medication_reminders SET status = 'processing'
WHERE id IN (SELECT id FROM medication_reminders ... FOR UPDATE SKIP LOCKED)
```
This guarantees that even if two scheduler ticks overlap, they will fetch mutually exclusive sets of reminders, absolutely preventing duplicate emails from being sent to patients.

## 5. Third-Party Integrations
### 5.1 Email (SendGrid)
Email dispatch handles booking confirmations, cancellations, and medication reminders. Deliveries are tracked in a robust `notifications` table. A centralized Celery retry-worker periodically scans for `status = 'failed'` rows and re-attempts delivery using an **exponential backoff** algorithm (e.g., 1m, 2m, 4m delays), capping at 3 attempts before marking them `permanently_failed`.

### 5.2 Google Calendar API (OAuth 2.0)
Patients and doctors can optionally authorize Google Calendar synchronization. Secure OAuth tokens are stored in the `google_calendar_tokens` table.
*   **Reschedule Strategy**: We utilize the Calendar API's `events().patch()` method rather than a Delete+Recreate pattern. This preserves the original Google Event ID, retains any customizations the user made to their event, and prevents Google from spamming the user's inbox with cancellation and re-invitation emails.
*   **Revoked Access (Lazy Detection)**: If a user revokes calendar access directly from their Google Security Dashboard, Google does not immediately notify our system via webhook. Instead, we use **Lazy Detection**. During the next scheduled sync, the Google SDK throws a `RefreshError ("invalid_grant")`. Our background task catches this, immediately deletes the token record locally, and gracefully halts future sync attempts for that user without crashing the booking flow.

## 6. Deployment
The infrastructure is heavily optimized for zero-cost scalability on free-tier hosting:
*   **Frontend**: Vercel. 
*   **Backend, Workers, DB, and Cache**: Render.com.
*   **Limitations**: Render’s free tier spins down idle web services after 15 minutes. To mitigate this, background tasks are designed to be entirely decoupled from the HTTP request/response cycle. If the API experiences a 50-second "cold start" delay, all queue-based reminders and LLM processing will resume exactly where they left off once the instance is warm.
