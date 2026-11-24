-- =============================================================================
-- 001_initial_schema.sql
-- P.D.O Classes Coaching Platform - multi-tenant attendance escalation engine
--
-- Source of truth: docs/backend_database_schema_document.md
-- Executed exactly once by src/db/migrate.ts inside a single transaction.
--
-- Multi-tenancy model
--   * Shared database, tenant discriminator column (institute_id) + RLS.
--   * The API sets `app.current_institute_id` transaction-locally before any
--     tenant query runs (see src/db/pool.ts).
--   * Policies are PERMISSIVE and compare against app_current_institute_id().
--   * When the GUC is missing/invalid the helper returns NULL, therefore every
--     predicate evaluates to NULL and zero rows are visible or writable.
--
-- Role ownership
--   * Run migrations and the seed as the database owner (pdo_migrator).
--   * Run the API as the dedicated `pdo_app` role (created at the bottom of this
--     file) so RLS is enforced. Table owners bypass RLS by design, which is what
--     lets the SECURITY DEFINER auth-lookup functions find a user before a
--     tenant context exists. Do NOT enable FORCE ROW LEVEL SECURITY on `users`
--     or `institutes`, or login would stop working.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 1. Custom ENUM types
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'user_role' AND n.nspname = 'public'
    ) THEN
        CREATE TYPE user_role AS ENUM (
            'SUPER_ADMIN',
            'INSTITUTE_ADMIN',
            'TEACHER',
            'RECEPTIONIST'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'attendance_status' AND n.nspname = 'public'
    ) THEN
        -- NOTE: the canonical schema spelling is ESCALATION_CALL_REQUIRED.
        -- Narrative documents sometimes shorten it to ESCALATED_CALL_REQUIRED;
        -- the database value is the one below and is what the API emits.
        CREATE TYPE attendance_status AS ENUM (
            'PRESENT',
            'ABSENT_UNCONFIRMED',
            'PARENT_VERIFIED_LEAVE',
            'PARENT_VERIFIED_LATE',
            'PARENT_FLAGGED_BUNK',
            'ESCALATION_CALL_REQUIRED',
            'CALL_RESOLVED'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'task_priority' AND n.nspname = 'public'
    ) THEN
        CREATE TYPE task_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'lead_status' AND n.nspname = 'public'
    ) THEN
        CREATE TYPE lead_status AS ENUM ('NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'ENROLLED', 'LOST');
    END IF;
END
$$;

-- =============================================================================
-- 2. Tables
-- =============================================================================

-- 2.1 Tenants ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS institutes (
    institute_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'Ranchi',
    whatsapp_api_config JSONB DEFAULT '{
        "provider": "META_CLOUD",
        "phone_number_id": "",
        "access_token": "",
        "business_account_id": ""
    }'::jsonb,
    verification_delay_minutes INT DEFAULT 10,
    escalation_timeout_minutes INT DEFAULT 3,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2.2 Staff accounts ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES institutes(institute_id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'TEACHER',
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2.3 Academic batches -------------------------------------------------------
CREATE TABLE IF NOT EXISTS batches (
    batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES institutes(institute_id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL, -- e.g. "CAT 2026 Batch A"
    target_exam VARCHAR(100) NOT NULL, -- e.g. "CAT", "CLASS_12_PCM"
    scheduled_start_time TIME NOT NULL,
    scheduled_end_time TIME NOT NULL,
    days_of_week INT[] DEFAULT '{1,2,3,4,5,6}', -- 1=Monday, 7=Sunday
    room_number VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2.4 Students & parent contacts --------------------------------------------
CREATE TABLE IF NOT EXISTS students (
    student_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES institutes(institute_id) ON DELETE CASCADE,
    batch_id UUID REFERENCES batches(batch_id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    roll_number VARCHAR(50) NOT NULL,
    parent_name VARCHAR(255) NOT NULL,
    parent_whatsapp VARCHAR(20) NOT NULL, -- Format: +91XXXXXXXXXX
    parent_secondary_phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_roll_per_institute UNIQUE (institute_id, roll_number)
);

-- 2.5 Class sessions ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES institutes(institute_id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES batches(batch_id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES users(user_id),
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    class_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verification_triggered BOOLEAN DEFAULT FALSE,
    total_students INT NOT NULL DEFAULT 0,
    present_count INT NOT NULL DEFAULT 0,
    absent_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2.6 Per-student attendance state ------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES attendance_sessions(session_id) ON DELETE CASCADE,
    institute_id UUID NOT NULL REFERENCES institutes(institute_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    status attendance_status NOT NULL DEFAULT 'PRESENT',
    whatsapp_message_id VARCHAR(255),
    whatsapp_sent_at TIMESTAMP WITH TIME ZONE,
    parent_response_raw VARCHAR(100),
    parent_responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_student_session UNIQUE (session_id, student_id)
);

-- 2.7 Red-alert call tasks ---------------------------------------------------
CREATE TABLE IF NOT EXISTS escalation_tasks (
    task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES institutes(institute_id) ON DELETE CASCADE,
    log_id UUID NOT NULL UNIQUE REFERENCES attendance_logs(log_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    priority task_priority NOT NULL DEFAULT 'HIGH',
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(user_id),
    call_outcome VARCHAR(100), -- 'VERIFIED_SICK', 'BUNK_CONFIRMED', 'UNREACHABLE'
    staff_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2.8 Public website leads ---------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
    lead_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES institutes(institute_id) ON DELETE CASCADE,
    student_name VARCHAR(255) NOT NULL,
    whatsapp_number VARCHAR(20) NOT NULL,
    target_course VARCHAR(100) NOT NULL,
    preferred_slot VARCHAR(50),
    status lead_status NOT NULL DEFAULT 'NEW',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 3. Indexing strategy
-- =============================================================================

-- Fast lookup for mobile app batch rosters
CREATE INDEX IF NOT EXISTS idx_students_batch_institute
    ON students (batch_id, institute_id) WHERE is_active = TRUE;

-- Fast index for today's attendance logs
CREATE INDEX IF NOT EXISTS idx_attendance_logs_session
    ON attendance_logs (session_id, status);

-- Real-time unresolved escalation tasks on the reception dashboard
CREATE INDEX IF NOT EXISTS idx_active_escalations
    ON escalation_tasks (institute_id, triggered_at) WHERE resolved_at IS NULL;

-- Fast WhatsApp payload / webhook matching
CREATE INDEX IF NOT EXISTS idx_attendance_logs_wa_msg
    ON attendance_logs (whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL;

-- Lead tracking
CREATE INDEX IF NOT EXISTS idx_leads_institute_status
    ON leads (institute_id, status, created_at DESC);

-- Tenant-scoped lookups used by dashboards and auth/me
CREATE INDEX IF NOT EXISTS idx_users_institute_role
    ON users (institute_id, role) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_batches_institute_active
    ON batches (institute_id, is_active);

CREATE INDEX IF NOT EXISTS idx_students_institute
    ON students (institute_id);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_batch_date
    ON attendance_sessions (batch_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_escalation_tasks_student
    ON escalation_tasks (student_id, triggered_at DESC);

-- =============================================================================
-- 4. Automatic updated_at maintenance
-- =============================================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_update_institutes ON institutes;
CREATE TRIGGER trig_update_institutes
    BEFORE UPDATE ON institutes
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trig_update_users ON users;
CREATE TRIGGER trig_update_users
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trig_update_batches ON batches;
CREATE TRIGGER trig_update_batches
    BEFORE UPDATE ON batches
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trig_update_students ON students;
CREATE TRIGGER trig_update_students
    BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trig_update_attendance_logs ON attendance_logs;
CREATE TRIGGER trig_update_attendance_logs
    BEFORE UPDATE ON attendance_logs
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- =============================================================================
-- 5. Row Level Security
-- =============================================================================

-- Defensive tenant resolver: returns NULL when the GUC is absent, empty or not
-- a UUID. A NULL predicate makes the policy deny by default.
CREATE OR REPLACE FUNCTION app_current_institute_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    raw_value TEXT := current_setting('app.current_institute_id', TRUE);
BEGIN
    IF raw_value IS NULL OR btrim(raw_value) = '' THEN
        RETURN NULL;
    END IF;

    RETURN raw_value::UUID;
EXCEPTION
    WHEN invalid_text_representation THEN
        RETURN NULL;
END;
$$;

ALTER TABLE institutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON institutes;
CREATE POLICY tenant_isolation_policy ON institutes
    AS PERMISSIVE
    FOR ALL
    TO PUBLIC
    USING (institute_id = app_current_institute_id())
    WITH CHECK (institute_id = app_current_institute_id());

DROP POLICY IF EXISTS tenant_isolation_policy ON users;
CREATE POLICY tenant_isolation_policy ON users
    AS PERMISSIVE
    FOR ALL
    TO PUBLIC
    USING (institute_id = app_current_institute_id())
    WITH CHECK (institute_id = app_current_institute_id());

DROP POLICY IF EXISTS tenant_isolation_policy ON batches;
CREATE POLICY tenant_isolation_policy ON batches
    AS PERMISSIVE
    FOR ALL
    TO PUBLIC
    USING (institute_id = app_current_institute_id())
    WITH CHECK (institute_id = app_current_institute_id());

DROP POLICY IF EXISTS tenant_isolation_policy ON students;
CREATE POLICY tenant_isolation_policy ON students
    AS PERMISSIVE
    FOR ALL
    TO PUBLIC
    USING (institute_id = app_current_institute_id())
    WITH CHECK (institute_id = app_current_institute_id());

DROP POLICY IF EXISTS tenant_isolation_policy ON attendance_sessions;
CREATE POLICY tenant_isolation_policy ON attendance_sessions
    AS PERMISSIVE
    FOR ALL
    TO PUBLIC
    USING (institute_id = app_current_institute_id())
    WITH CHECK (institute_id = app_current_institute_id());

DROP POLICY IF EXISTS tenant_isolation_policy ON attendance_logs;
CREATE POLICY tenant_isolation_policy ON attendance_logs
    AS PERMISSIVE
    FOR ALL
    TO PUBLIC
    USING (institute_id = app_current_institute_id())
    WITH CHECK (institute_id = app_current_institute_id());

DROP POLICY IF EXISTS tenant_isolation_policy ON escalation_tasks;
CREATE POLICY tenant_isolation_policy ON escalation_tasks
    AS PERMISSIVE
    FOR ALL
    TO PUBLIC
    USING (institute_id = app_current_institute_id())
    WITH CHECK (institute_id = app_current_institute_id());

DROP POLICY IF EXISTS tenant_isolation_policy ON leads;
CREATE POLICY tenant_isolation_policy ON leads
    AS PERMISSIVE
    FOR ALL
    TO PUBLIC
    USING (institute_id = app_current_institute_id())
    WITH CHECK (institute_id = app_current_institute_id());

-- =============================================================================
-- 6. Pre-authentication lookup bridge
--
-- Login happens before a tenant context exists, and users.email is globally
-- unique. These SECURITY DEFINER functions run as the migration owner (which
-- bypasses RLS, as ENABLE without FORCE intends) and expose only the columns
-- required to authenticate. EXECUTE is revoked from PUBLIC and granted to
-- pdo_app only.
-- =============================================================================

CREATE OR REPLACE FUNCTION auth_lookup_user_by_email(p_email TEXT)
RETURNS TABLE (
    user_id UUID,
    institute_id UUID,
    full_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    password_hash VARCHAR(255),
    role user_role,
    is_active BOOLEAN,
    institute_is_active BOOLEAN,
    institute_name VARCHAR(255),
    last_login_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT
        u.user_id,
        u.institute_id,
        u.full_name,
        u.email,
        u.phone,
        u.password_hash,
        u.role,
        COALESCE(u.is_active, FALSE),
        COALESCE(i.is_active, FALSE),
        i.name,
        u.last_login_at
    FROM users u
    JOIN institutes i ON i.institute_id = u.institute_id
    WHERE lower(u.email) = lower(p_email)
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_lookup_user_by_id(p_user_id UUID)
RETURNS TABLE (
    user_id UUID,
    institute_id UUID,
    full_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    password_hash VARCHAR(255),
    role user_role,
    is_active BOOLEAN,
    institute_is_active BOOLEAN,
    institute_name VARCHAR(255),
    last_login_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT
        u.user_id,
        u.institute_id,
        u.full_name,
        u.email,
        u.phone,
        u.password_hash,
        u.role,
        COALESCE(u.is_active, FALSE),
        COALESCE(i.is_active, FALSE),
        i.name,
        u.last_login_at
    FROM users u
    JOIN institutes i ON i.institute_id = u.institute_id
    WHERE u.user_id = p_user_id
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_record_login(p_user_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    UPDATE users
    SET last_login_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION auth_lookup_user_by_email(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_lookup_user_by_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_record_login(UUID) FROM PUBLIC;

-- =============================================================================
-- 7. Application role & grants
--
-- pdo_app is NOLOGIN until an operator explicitly enables it:
--   ALTER ROLE pdo_app LOGIN PASSWORD '<strong-password>';
-- Then point DATABASE_URL at it. Migrations/seed keep using the owner.
-- Failures are non-fatal notices so managed providers with restricted role
-- management still allow the schema migration to complete.
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pdo_app') THEN
        CREATE ROLE pdo_app NOLOGIN;
    END IF;
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipping pdo_app role creation: current role lacks CREATEROLE.';
END
$$;

DO $$
BEGIN
    GRANT USAGE ON SCHEMA public TO pdo_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pdo_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pdo_app;
    GRANT EXECUTE ON FUNCTION app_current_institute_id() TO pdo_app;
    GRANT EXECUTE ON FUNCTION auth_lookup_user_by_email(TEXT) TO pdo_app;
    GRANT EXECUTE ON FUNCTION auth_lookup_user_by_id(UUID) TO pdo_app;
    GRANT EXECUTE ON FUNCTION auth_record_login(UUID) TO pdo_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pdo_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT USAGE, SELECT ON SEQUENCES TO pdo_app;
EXCEPTION
    WHEN undefined_object OR insufficient_privilege THEN
        RAISE NOTICE 'Skipping pdo_app grants: role does not exist or caller cannot grant.';
END
$$;
