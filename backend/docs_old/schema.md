# Database Schema — Healthcare Appointment & Follow-up Manager

## Entity Relationship Overview

```
users (1) ──────────────── (0..1) doctor_profiles
users (1) ──────────────── (0..*) doctor_leaves
users (1) ──────────────── (0..*) appointments  [as patient]
users (1) ──────────────── (0..*) appointments  [as doctor]
appointments (1) ────────── (0..1) symptom_forms
appointments (1) ────────── (0..1) visit_notes
visit_notes (1) ─────────── (0..*) prescriptions
appointments (1) ────────── (0..*) notifications
appointments (1) ────────── (0..1) calendar_events
users (1) ──────────────── (0..*) notifications
```

## Double-Booking Prevention

The `appointments` table has:
```sql
UNIQUE (doctor_id, slot_start)
```
This constraint is evaluated atomically by PostgreSQL within a transaction,
meaning even concurrent INSERT attempts for the same (doctor_id, slot_start)
will result in exactly one success and one `UniqueViolation` error.

Application-level: the `UniqueViolation` (pgcode 23505) is caught and
returned as HTTP 409 Conflict.

## Key Constraints

| Table | Constraint | Purpose |
|---|---|---|
| `appointments` | `UNIQUE(doctor_id, slot_start)` | Anti-double-booking |
| `appointments` | `CHECK(slot_end > slot_start)` | Slot integrity |
| `appointments` | `CHECK(patient_id != doctor_id)` | Self-booking prevention |
| `doctor_leaves` | `UNIQUE(doctor_id, leave_date)` | No duplicate leaves |
| `symptom_forms` | `CHECK(severity BETWEEN 1 AND 10)` | Rating validation |
| `users` | `UNIQUE(email)` | Login identity |
| `doctor_profiles` | `UNIQUE(user_id)` | One profile per doctor |

## Table Summaries

| Table | Rows represent |
|---|---|
| `users` | All platform users (patients, doctors, admins) |
| `doctor_profiles` | Doctor-specific metadata (hours, specialisation) |
| `doctor_leaves` | Leave days per doctor |
| `appointments` | Booked time slots between patient & doctor |
| `symptom_forms` | Pre-visit patient symptom submissions |
| `visit_notes` | Post-visit doctor notes + LLM summaries |
| `prescriptions` | Individual medications from a visit note |
| `notifications` | Email/SMS/push payloads with delivery tracking |
| `calendar_events` | Google Calendar sync state per appointment |
