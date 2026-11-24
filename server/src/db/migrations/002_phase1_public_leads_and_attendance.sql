-- =============================================================================
-- 002_phase1_public_leads_and_attendance.sql
-- Phase 1 core application support.
--
--   1. Guarantees one attendance sheet per (batch, calendar day) so the
--      submit endpoint is idempotent at the database level, not just in code.
--   2. Adds a narrow SECURITY DEFINER bridge that resolves an active institute
--      from its public slug. The public demo-booking endpoint needs this because
--      it runs before any JWT (and therefore before any tenant context) exists.
--
-- Run as the database owner. The API keeps using the restricted `pdo_app` role.
-- =============================================================================

-- =============================================================================
-- 1. Idempotent daily attendance sheet
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_sessions_batch_date
    ON attendance_sessions (batch_id, session_date);

COMMENT ON INDEX uq_attendance_sessions_batch_date IS
    'One attendance session per batch per calendar day. Backs POST /attendance/submit idempotency.';

-- =============================================================================
-- 2. Public institute lookup bridge
--
-- Returns only the fields the public lead endpoint and thank-you screen need.
-- No staff accounts, timings, configuration tokens or parent data are exposed.
-- The owner-defined SECURITY DEFINER function bypasses RLS intentionally so a
-- pre-authentication visitor can be attached to the correct tenant. EXECUTE is
-- revoked from PUBLIC and granted only to the API role.
-- =============================================================================

CREATE OR REPLACE FUNCTION public_institute_by_slug(p_slug TEXT)
RETURNS TABLE (
    institute_id UUID,
    name VARCHAR(255),
    slug VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    is_active BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT
        i.institute_id,
        i.name,
        i.slug,
        i.phone,
        i.address,
        i.city,
        COALESCE(i.is_active, FALSE)
    FROM institutes i
    WHERE lower(i.slug) = lower(btrim(p_slug))
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public_institute_by_slug(TEXT) FROM PUBLIC;

DO $$
BEGIN
    GRANT EXECUTE ON FUNCTION public_institute_by_slug(TEXT) TO pdo_app;
EXCEPTION
    WHEN undefined_object OR insufficient_privilege THEN
        RAISE NOTICE 'Skipping public_institute_by_slug grant: pdo_app role is unavailable.';
END
$$;
