# Production Planning Maestranza

## Overview

A full-stack production planning system for a heavy equipment manufacturing workshop (maestranza). The platform centralizes order intake, scheduling, and capacity allocation across a multi-process production flow, replacing informal coordination with a structured, data-driven planning cycle.

The system solves the core challenge of scheduling multiple simultaneous work orders across constrained production resources — assigning each equipment unit to each process step on specific working days, respecting per-process daily capacity limits, arrival dates, and priority rankings. It tracks deviations from plan (delays, special working days) and recomputes the schedule on demand.

Scope includes order management, finite-capacity scheduling, planning versioning, Excel report generation, and role-based user access.

---

## Architecture

```
Browser (Next.js)
       │
       ▼
API Layer (Next.js Route Handlers)
       │
       ├──► PostgreSQL (Supabase)
       │
       └──► Planning Engine (Python / OR-Tools)
                  │
                  └──► PostgreSQL (write results)
```

The web application handles all CRUD operations and user interactions. When a planning run is triggered, the API invokes a Python script (hosted on Railway) that reads scheduling inputs from the database, runs the dispatch algorithm, and writes results back. The frontend then reads the updated results for display and export.

---

## Main Features

- Equipment registration and management
- Finite-capacity production planning
- Priority-based scheduling
- Delay management via configurable buffers
- Working calendar customization
- Special working days support
- Planning versioning with rollback to previous run
- Historical planning tracking per equipment
- Excel export (summary, process detail, Gantt charts)
- User management and role-based access control

---

## Planning Engine

The scheduling engine (`scripts/planner.py`) implements a forward-pass, finite-capacity dispatch heuristic:

- **Process sequencing** — each equipment unit advances through a fixed multi-step process chain; a step cannot begin until the previous completes
- **Daily capacity constraints** — each process has a configurable maximum number of simultaneous units per working day
- **Priority-based dispatching** — when available slots are fewer than eligible jobs, priority rank determines assignment order
- **Buffer support** — a two-pass approach freezes already-completed tasks for delayed jobs and applies the configured delay only to the first pending step, preserving progress
- **Working calendar** — scheduling operates on working days only; special days (weekends, holidays marked as working) are injected into the calendar before dispatch

The engine reads directly from and writes directly to the production database.

---

## Project Structure

```
/
├── etp-app/          # Next.js web application (frontend + API layer)
│   ├── src/app/      # Pages, route handlers (App Router)
│   ├── src/components/
│   ├── src/lib/
│   └── prisma/       # Database schema and migrations
│
├── scripts/          # Planning engine and utility scripts
│   ├── planner.py    # Core scheduling engine (Python / OR-Tools)
│   ├── seed_rules.py # Process rules loader from Excel
│   └── ...
│
└── data/             # Reference files: process definitions, time rules, product master
```

---

## Technology Stack

### Frontend
- Next.js 15 (App Router)
- React, TypeScript
- Tailwind CSS, shadcn/ui

### Backend
- Next.js Route Handlers (API)
- Prisma ORM

### Database
- PostgreSQL (Supabase)
- Supabase Auth

### Planning Engine
- Python 3
- Google OR-Tools (dispatch heuristic)

### Infrastructure
- Vercel (web application)
- Railway (planning engine runner)
- Supabase (managed PostgreSQL + authentication)

---

## Deployment

| Component | Platform |
|---|---|
| Web application | Vercel (auto-deploy from `main`) |
| Planning engine | Railway (invoked via API on demand) |
| Database + Auth | Supabase (managed PostgreSQL) |

The planning engine is not continuously running — it is invoked synchronously per planning request and exits after writing results.

---

## Security

- Authentication is managed by Supabase Auth (email/password, PKCE flow)
- Server-side session validation on every API route
- Role-based access: admin users can modify planning data, execute the planner, and manage users; standard users have read access
- `created_by` / `updated_by` fields are set server-side from the authenticated session, never from client input

---

## Scalability

- Cloud-native architecture: all components are independently deployable and scalable
- Decoupled planning engine: the scheduler runs as a stateless process and can be migrated, scaled, or replaced without changes to the web layer
- Independent database layer: Supabase provides managed scaling for storage and connections
- Extensible scheduling framework: process definitions, capacities, and calendar rules are data-driven and configurable without code changes

---

## License

Proprietary — ETP Spa. All rights reserved.
