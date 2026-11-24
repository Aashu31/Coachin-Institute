-- =============================================================================
-- 004_fix_auth_lookup_email_verified.sql
-- Update auth_lookup_user_by_email to include email_verified column
-- so that login can properly check email verification status
-- =============================================================================

-- Drop and recreate auth_lookup_user_by_email with email_verified
DROP FUNCTION IF EXISTS auth_lookup_user_by_email(TEXT);

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
    last_login_at TIMESTAMP WITH TIME ZONE,
    email_verified BOOLEAN
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
        u.last_login_at,
        COALESCE(u.email_verified, FALSE)
    FROM users u
    JOIN institutes i ON i.institute_id = u.institute_id
    WHERE lower(u.email) = lower(p_email)
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION auth_lookup_user_by_email(TEXT) FROM PUBLIC;

DO $$
BEGIN
    GRANT EXECUTE ON FUNCTION auth_lookup_user_by_email(TEXT) TO pdo_app;
EXCEPTION
    WHEN undefined_object OR insufficient_privilege THEN
        RAISE NOTICE 'Skipping auth_lookup_user_by_email grant: pdo_app role is unavailable.';
END
$$;

-- Also update auth_lookup_user_by_id for consistency
DROP FUNCTION IF EXISTS auth_lookup_user_by_id(UUID);

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
    last_login_at TIMESTAMP WITH TIME ZONE,
    email_verified BOOLEAN
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
        u.last_login_at,
        COALESCE(u.email_verified, FALSE)
    FROM users u
    JOIN institutes i ON i.institute_id = u.institute_id
    WHERE u.user_id = p_user_id
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION auth_lookup_user_by_id(UUID) FROM PUBLIC;

DO $$
BEGIN
    GRANT EXECUTE ON FUNCTION auth_lookup_user_by_id(UUID) TO pdo_app;
EXCEPTION
    WHEN undefined_object OR insufficient_privilege THEN
        RAISE NOTICE 'Skipping auth_lookup_user_by_id grant: pdo_app role is unavailable.';
END
$$;