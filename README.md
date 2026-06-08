# Production Planning Maestranza

Web platform for production planning and scheduling in a heavy equipment manufacturing workshop (maestranza).

## Overview

- Web-based platform for managing and scheduling equipment production orders
- Multi-process capacity management with configurable daily resource limits
- Priority-based scheduling with delay and buffer handling
- Historical planning tracking with version control and rollback support
- Excel reporting with summary tables, process breakdowns, and Gantt charts

---

## Architecture

```
Frontend (Next.js)
        │
        ▼
   API Layer (Next.js Route Handlers)
        │
        ▼
PostgreSQL Database (Supabase)
        │
        ▼
Planning Engine (Python + OR-Tools)
        │
        ▼
   Excel Reporting
```

The web application manages all user interactions and data operations. Planning runs are triggered via the API, which invokes a Python-based scheduling engine hosted on Railway. The engine reads inputs from the database, computes the schedule, and writes results back. Reports are generated on demand from the computed results.

---

## Main Features

- Equipment registration and management
- Finite-capacity production planning
- Priority management
- Delay and buffer management
- Working calendar customization
- Special working days support
- Historical planning tracking
- Planning version control with rollback
- Excel export (summary, process detail, Gantt)
- User management
- Authentication and role-based access control

---

## Planning Engine

- Finite-capacity scheduling across a fixed multi-step process chain
- Strict process sequencing — each step begins only after the previous completes
- Resource allocation respecting configurable per-process daily capacity limits
- Priority-based dispatching — lower priority number = higher scheduling precedence
- Working calendar constraints with special day injection
- Replanning support — buffers applied only to the first pending step, preserving completed work

---

## Project Structure

```
/data
    Planning rules and reference files (process definitions, time tables, product master)

/etp-app
    Web application: Next.js frontend, API route handlers, Prisma schema, DB migrations

/scripts
    Planning engine (planner.py), rule loaders, and utility scripts
```

---

## Technology Stack

### Frontend
- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS

### Backend
- Node.js
- Prisma ORM

### Database
- PostgreSQL
- Supabase

### Planning Engine
- Python
- Google OR-Tools (CP-SAT)

### Infrastructure
- Vercel
- Railway
- Supabase
- GitHub

---

## Security

- User authentication via Supabase Auth (email/password, PKCE flow)
- Role-based access control (admin / standard user)
- Server-side session validation on all API routes
- Protected planning operations restricted to admin role

---

## Scalability

- Cloud-native architecture with independently deployable components
- Decoupled planning engine — stateless, invoked on demand, replaceable without web layer changes
- Independent database layer managed and scaled by Supabase
- Extensible scheduling framework — process rules and capacities are data-driven

---

## Deployment

| Component | Platform |
|---|---|
| Frontend + API | Vercel (auto-deploy from `main`) |
| Planning engine | Railway |
| Database + Auth | Supabase |

---

## License

Proprietary — ETP Spa. All rights reserved.
