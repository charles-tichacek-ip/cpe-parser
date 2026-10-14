# CPE Parser

**Parse · Process · Prioritize**

An open-source tool that turns a folder of CPE certificates into a structured, queryable compliance log — powered by Claude.

Drop a PDF (or a ZIP of 50). Claude extracts and classifies every record against your professional designations. You review, edit, and approve. Nothing commits without your eyes on it.

Built to solve a real problem: CPE tracking for multi-designation professionals (CIA, CISA, CPA Ontario, CITP) whose legacy trackers export PDFs, not data.

---

## The Pattern

This project is also a reference implementation of a general pattern:

```
Unstructured input (PDF, text, image)
  → LLM structured extraction (Claude)
    → Staging table (human review)
      → Relational DB (Postgres)
```

The hard part of "AI + database" isn't the database — it's the extraction layer. This repo shows one clean way to do it.

---

## Features

- **Upload** — drop multiple PDFs and/or ZIPs at once; per-file progress
- **Deduplication** — SHA-256 checksum on every file; duplicates flagged, not blocked
- **Rename** — files renamed to `YYYY-MM_Provider_Title_Designations.pdf` on ingest
- **Review** — split-panel UI: list on left, editable detail on right; low-confidence fields highlighted
- **Accept / Reject** — nothing writes to the main table without explicit approval
- **Records** — filterable log with checkbox multi-select and ZIP download
- **Reporting** — compliance dashboard by designation and year (CIA, CISA, CPA Ontario, CITP), plus CISA 3-year cycle tracking
- **Auth** — password gate; the password is checked server-side and never bundled into the frontend. Repeated failures lock out the IP for 15 minutes

### Supported Designations

| Designation | Body | Annual Requirement |
|---|---|---|
| CIA | IIA | 40 hrs, incl. 2 ethics |
| CISA | ISACA | 20 hrs (120 over 3 yrs) |
| CPA | CPA Ontario | 20 hrs (10 verifiable) |
| CITP | AICPA | 20 hrs |

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | Fastify + TypeScript |
| Database | PostgreSQL (Railway) |
| Storage | Railway Storage Buckets (S3-compatible, no AWS account needed) |
| AI | Claude Sonnet 5.5 (`claude-sonnet-5-5`) |
| Deploy | Railway (monorepo) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- A Railway account
- An Anthropic API key

### Local Development

**1. Clone and install**

```bash
git clone https://github.com/charles-tichacek-ip/cpe-parser
cd cpe-parser

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

**2. Configure environment**

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env`, then fill in the values.

The `AWS_*` / `BUCKET_*` names are the S3-compatible credentials a Railway Storage Bucket provides. They are not AWS credentials. Never prefix secrets with `VITE_`; Vite bundles anything with that prefix into public client JS.

**3. Initialize the database**

```bash
psql $DATABASE_URL < db/schema.sql
```

**4. Run**

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

### Deploy to Railway

1. Push to GitHub
2. Create a new Railway project
3. Add a Postgres database service and a Storage Bucket
4. Create two services from the monorepo:
   - `backend` — root directory `backend/`, start `npm start`
   - `frontend` — root directory `frontend/`, build `npm run build`, serves on port 8080
5. Backend variables: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` (optional, defaults to `claude-sonnet-5-5`), `AUTH_USER`, `AUTH_PASS`, `FRONTEND_URL` (the frontend's public URL, used for CORS), `NODE_ENV=production`, and the bucket variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `BUCKET_NAME`, `BUCKET_ENDPOINT_URL`)
6. Frontend variables: `VITE_API_URL` (the backend's public URL). This is the only one; nothing secret goes here
7. Run `db/schema.sql` against Railway Postgres via the dashboard Query tab or the Railway CLI
8. Optional: add custom domains to both services and set `FRONTEND_URL` / `VITE_API_URL` to match

`AUTH_PASS` is checked by the backend. Use a long, random value.

On boot the backend verifies its env vars, the database, the bucket, and the Claude model, and exits with a clear error if any check fails. Set Railway's healthcheck path to `/health` so a failed deploy never replaces a working one.

---

## Project Structure

```
cpe-parser/
├── README.md
├── db/
│   └── schema.sql          # Full Postgres schema
├── backend/
│   ├── src/
│   │   ├── index.ts         # Fastify server
│   │   ├── lib/db.ts        # Postgres connection
│   │   ├── middleware/auth.ts
│   │   ├── routes/
│   │   │   ├── upload.ts    # PDF/ZIP ingest + Claude parse
│   │   │   ├── staging.ts   # Review queue (accept/reject)
│   │   │   ├── records.ts   # Approved records + compliance summary
│   │   │   └── download.ts  # ZIP export of selected certificates
│   │   └── services/
│   │       └── parser.ts    # Claude structured extraction
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.tsx           # Router + sidebar
    │   ├── lib/api.ts        # Typed API client
    │   └── pages/
    │       ├── Upload.tsx    # Drop zone
    │       ├── Review.tsx    # Staging review panel
    │       ├── Records.tsx   # Filterable log + ZIP download
    │       ├── Detail.tsx    # Single record + edit
    │       └── Reporting.tsx # Compliance dashboard
    └── package.json
```

---

## Notes

CISA 3-year cycle boundaries are hardcoded in `backend/src/routes/records.ts` to one person's ISACA renewal schedule (2026-2028, then every three years). Change them to match yours.

## Contributing

PRs welcome. Areas most useful:

- Additional designation support (BABL, CITP rules refinement)
- Configurable cycle boundaries instead of hardcoded ones
- Per-designation ethics hour tracking

---

## License

MIT
