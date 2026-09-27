# Buildora

**Multi-tenant construction and property management, from project planning to property sales.**

Buildora brings construction operations, property inventory, financial records, and customer leads into one workspace. Company memberships and role-based access separate each organization's data while supporting collaboration across project, engineering, sales, and finance teams.

> This README reflects the project handoff context. Repository files were not available for verification: directory names, environment keys, commands, and route examples below must be aligned with the actual code. Natural-language search is a planned, backend-first addition.

## Key features

- Manage projects and their land, buildings, floors, and apartments.
- Track construction stages, tasks, and task updates.
- Organize parties, payments, and payment categories.
- Manage leads and project-related documents.
- Provide company settings, public-facing pages, and platform administration.
- Enforce tenant isolation and role-based permissions through the backend.
- **Planned:** search authorized company data using natural-language questions.

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | Next.js App Router, TypeScript, Tailwind CSS |
| Forms and validation | React Hook Form and Zod |
| Backend | FastAPI, Pydantic |
| Data access and migrations | SQLAlchemy, Alembic |
| Database | PostgreSQL, optionally hosted on Supabase |
| Authentication | JWT |
| AI search, planned | LLM intent extraction with validated, approved backend queries |

## Core modules

| Module | Purpose |
| --- | --- |
| Companies, users, memberships | Tenant context, user accounts, and company roles |
| Projects | Project details, status, budgets, and related records |
| Land records | Land information associated with projects |
| Buildings, floors, apartments | Property hierarchy and apartment inventory |
| Construction stages | Phases of construction and progress tracking |
| Tasks and task updates | Work tracking and progress history |
| Parties | People and organizations associated with business activity |
| Payments and payment categories | Categorized financial records linked to relevant entities |
| Leads | Sales inquiries and follow-up tracking |
| Documents | Documents associated with company and project records |
| Settings | Company and account configuration |
| Public pages | Public-facing content, limited to explicitly published information |
| Platform admin | Platform-level administration for authorized users |

## Roles and permissions

Buildora separates **platform roles** from **company membership roles**. A user's company permissions come from their membership in the selected company.

| Scope | Roles |
| --- | --- |
| Platform | `SUPER_ADMIN`, `USER` |
| Company membership | `OWNER`, `PROJECT_MANAGER`, `SITE_ENGINEER`, `SALES`, `FINANCE`, `OTHER` |

Exact action permissions are defined by backend authorization rules; role names alone do not grant access. Protected requests must validate the authenticated user, active membership, company scope, and permission for the requested operation. Related resource IDs must belong to the authorized tenant. Platform administration requires explicit authorization; frontend visibility is not an access-control boundary.

## Architecture

```text
Next.js UI
    → FastAPI routes: authentication, tenant scope, permissions
    → Pydantic schemas and business services
    → SQLAlchemy models and approved queries
    → PostgreSQL / Supabase

Alembic → versioned database schema changes
```

The frontend handles presentation and form validation. The backend remains responsible for validation, authorization, business rules, and persistence. Supabase is a PostgreSQL hosting option; this context does not establish use of Supabase Auth or Storage.

### AI natural-language search — planned

The first version is **backend only**, tested through FastAPI Swagger before frontend integration.

Example questions:

- “Which tasks are overdue?”
- “Show available three-bedroom apartments under 150000.”
- “How much did we pay ABC Construction?”
- “Which projects are still in progress?”

```text
Question → LLM extracts intent and filters → Pydantic validation
         → permission and tenant checks → approved SQLAlchemy query
         → real database results → optional grounded answer
```

Initial domains: projects, tasks, apartments, payments, leads, parties, and construction stages.

**Required safety constraints:**

- Read-only operations: no creation, updates, deletion, or schema changes.
- Never execute arbitrary SQL or code produced by an LLM.
- Allowlist intents, filters, sort fields, and query handlers; reject unsupported requests.
- Derive access from verified authentication and memberships, never from model output.
- Apply company scope to every query and validate referenced resources.
- Calculate totals in approved backend queries; never invent records or financial values.
- Bound result sizes and send only necessary, authorized data to the model.
- Treat user prompts and retrieved text as untrusted input; fail safely on invalid output.

Proposed endpoint, subject to implementation and any API prefix:

```http
POST /companies/{company_id}/ai/search
Authorization: Bearer <access-token>
Content-Type: application/json

{"query": "Which tasks are overdue?"}
```

## Local setup

### Prerequisites

- Python and Node.js versions supported by the repository's manifests.
- A PostgreSQL database or Supabase PostgreSQL project.
- The package manager matching the frontend lockfile.

The examples assume `backend/`, `frontend/`, `requirements.txt`, and the FastAPI application at `app.main:app`. Substitute the repository's actual paths and dependency workflow where different.

### 1. Backend

From the repository root:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

```bash
# macOS / Linux
source .venv/bin/activate
```

```powershell
# Windows PowerShell
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
python -m pip install -r requirements.txt
```

Create the environment file expected by the backend settings loader, typically `backend/.env`. Use the actual settings field names; these are placeholders:

```dotenv
DATABASE_URL=postgresql+<driver>://<user>:<password>@<host>:<port>/<database>
JWT_SECRET_KEY=<replace-with-a-strong-random-secret>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
CORS_ORIGINS=["http://localhost:3000"]

# Planned AI integration; provider and model are not yet confirmed
AI_API_KEY=<provider-api-key>
AI_MODEL=<supported-model-id>
```

Select the PostgreSQL driver and connection URL required by the application's sync or async SQLAlchemy setup. For Supabase, use the appropriate project connection details and SSL configuration. Confirm the format accepted for CORS origins. Keep secrets out of version control and browser-exposed variables.

### 2. Database migrations

From `backend/`, with the environment configured:

```bash
alembic upgrade head
```

When developing a model change:

```bash
alembic revision --autogenerate -m "describe schema change"
# Review the generated migration before applying it.
alembic upgrade head
```

Ensure Alembic loads the application's models and targets the intended database.

### 3. Run the backend and explore Swagger

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- API: <http://localhost:8000>
- Swagger UI, if enabled: <http://localhost:8000/docs>
- OpenAPI schema, if enabled: <http://localhost:8000/openapi.json>

Use the implemented authentication endpoint to obtain a JWT, then authorize requests using the security scheme shown in Swagger. Test company access, validation errors, and role restrictions alongside successful requests. Once implemented, test AI search here before connecting a frontend.

### 4. Frontend

In a second terminal, from the repository root:

```bash
cd frontend
npm install
```

Create `frontend/.env.local`, matching the variable used by the API client:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Include the backend's API prefix if required. `NEXT_PUBLIC_*` values are exposed to the browser and must never contain secrets.

```bash
npm run dev
```

Open <http://localhost:3000>. For a production build, use `npm run build` and `npm run start` if those scripts exist in `package.json`.

## Seed data

The handoff proposes a dedicated `backend/scripts/seed.py`; a complete seed script is not confirmed. Implement it using the existing SQLAlchemy models and session, then run from `backend/` with the appropriate import configuration, for example:

```bash
python -m scripts.seed
```

Create records in foreign-key dependency order: users → companies → memberships → projects → land records → buildings → floors → apartments → construction stages → tasks → task updates; create parties and payment categories before dependent payments, followed by leads and documents as their relationships require.

Seed values must be supplied explicitly or generated by the script. IDs and timestamps may be omitted only when model or database defaults exist. Use model enum members and the application's existing password-hashing function. Never store plaintext passwords or a literal `"..."` password hash.

Use a development database, commit in a transaction, roll back on failure, and make repeated runs avoid duplicates. Do not delete existing data by default. Demo credentials should be configurable and excluded from production.

## Project structure

Illustrative layout; actual folder names may differ:

```text
buildora/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/          # Routes and dependencies
│   │   ├── core/         # Settings, authentication, authorization
│   │   ├── database/     # Engine and sessions
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   └── services/     # Business logic and planned AI handlers
│   ├── alembic/
│   ├── scripts/seed.py   # Proposed seed script
│   └── requirements.txt
├── frontend/
│   ├── app/             # Next.js App Router pages and layouts
│   ├── components/
│   ├── lib/             # API client, validation, shared utilities
│   └── package.json
└── README.md
```

## Main routes

These are navigation and API conventions to map to the implementation, not a verified route inventory. Swagger is the source of truth for registered backend endpoints.

| Area | Illustrative route |
| --- | --- |
| Public pages and sign-in | `/`, `/login` |
| Company workspace | `/companies/[companyId]` |
| Projects and property hierarchy | `/companies/[companyId]/projects/[projectId]` |
| Operational modules | Company-scoped `/tasks`, `/parties`, `/payments`, `/leads`, `/documents` |
| Company settings | `/companies/[companyId]/settings` |
| Platform administration | `/admin` |
| Backend resources | `/companies/{company_id}/<resource>`; API prefix may apply |
| AI search, proposed | `POST /companies/{company_id}/ai/search` |
| API documentation | `/docs` |

## Future improvements

- Implement and validate read-only AI search, then add its frontend experience.
- Add automated tests for tenant isolation, role permissions, and AI query validation.
- Extend reporting for project progress, payments, and budget visibility.
- Improve document workflows, notifications, and activity auditing.
- Add repeatable demo seeding, CI checks, and deployment documentation.
