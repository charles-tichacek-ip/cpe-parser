-- CPE Parser Schema
-- Run this against your Railway Postgres instance to initialize

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
-- Core CPE records (approved / committed)
-- ─────────────────────────────────────────────
CREATE TABLE cpe_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider         TEXT NOT NULL,
  course_title     TEXT NOT NULL,
  completion_date  DATE,
  credit_hours     NUMERIC(5,2),
  delivery_method  TEXT,
  is_verifiable    BOOLEAN DEFAULT true,
  is_ethics        BOOLEAN DEFAULT false,
  notes            TEXT,
  raw_input        TEXT,
  file_hash        TEXT UNIQUE,         -- SHA-256 of original PDF bytes
  certificate_url  TEXT,                -- Railway Storage signed URL path
  original_filename TEXT,
  confidence       NUMERIC(3,2),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
-- Designation breakdown (one record → many)
-- ─────────────────────────────────────────────
CREATE TABLE cpe_designations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpe_record_id UUID NOT NULL REFERENCES cpe_records(id) ON DELETE CASCADE,
  designation   TEXT NOT NULL CHECK (designation IN ('CIA','CISA','CPA','CITP','BABL')),
  category      TEXT,
  hours_claimed NUMERIC(5,2)
);

-- ─────────────────────────────────────────────
-- Staging table — all uploads land here first
-- ─────────────────────────────────────────────
CREATE TABLE cpe_staging (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_filename TEXT,
  file_hash         TEXT,
  certificate_url   TEXT,               -- Railway Storage path
  raw_extract       TEXT,               -- raw text extracted from PDF
  parsed_data       JSONB,              -- Claude's full structured output
  confidence        NUMERIC(3,2),
  low_conf_fields   TEXT[],
  is_duplicate      BOOLEAN DEFAULT false,
  duplicate_of      UUID REFERENCES cpe_records(id),
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  rejection_reason  TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  reviewed_at       TIMESTAMPTZ
);

-- ─────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────
CREATE INDEX ON cpe_records(completion_date);
CREATE INDEX ON cpe_records(file_hash);
CREATE INDEX ON cpe_designations(designation);
CREATE INDEX ON cpe_designations(cpe_record_id);
CREATE INDEX ON cpe_staging(status);
CREATE INDEX ON cpe_staging(file_hash);

-- ─────────────────────────────────────────────
-- Auto-update updated_at on cpe_records
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cpe_records_updated_at
  BEFORE UPDATE ON cpe_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
