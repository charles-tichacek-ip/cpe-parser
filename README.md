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

- **Upload** — single PDF or ZIP of certificates
- **Deduplication** — SHA-256 checksum on every file; duplicates flagged, not blocked
- **Rename** — files renamed to `YYYY-MM_Provider_Title_Designations.pdf` on ingest
- **Review** — split-panel UI: list on left, editable detail on right; low-confidence fields highlighted
- **Accept / Reject** — nothing writes to the main table without explicit approval
- **Records** — filterable log with checkbox multi-select and ZIP download
- **Reporting** — compliance dashboard by designation and year (CIA, CISA, CPA Ontario, CITP)

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
| Storage | Railway Storage Buckets |
| AI | Claude claude-sonnet-4-20250514 |
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
git clone https://github.com/yourusername/cpe-parser
cd cpe-parser

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

**2. Configure environment**

Backend `.env`:
```
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...
STORAGE_BASE_URL=https://...railway.app/storage
AUTH_USER=admin
AUTH_PASS=your-password
PORT=3001
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

Frontend `.env`:
```
VITE_AUTH_USER=admin
VITE_AUTH_PASS=your-password
```

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
3. Add a Postgres database service
4. Add a Storage Bucket
5. Create two services from the monorepo:
   - `backend` — root: `backend/`, start: `npm start`
   - `frontend` — root: `frontend/`, start: `npm run preview`
6. Set environment variables in the Railway dashboard (never in the repo)
7. Run `schema.sql` against your Railway Postgres via the Railway CLI or dashboard query editor

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

## Contributing

PRs welcome. Areas most useful:

- Additional designation support (BABL, CITP rules refinement)
- Triennial compliance tracking (CISA 120-hr rolling window)
- Ethics hours sub-tracking per designation
- Railway Storage Bucket client implementation (currently stubbed)

---

## License

MIT
