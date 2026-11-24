-- =============================================================================
-- 003_auth_onboarding_lifecycle.sql
-- Phase 4: Production Auth Lifecycle, Self-Serve Institute Onboarding,
-- Profile Management & Account Deletion
--
-- Run as the database owner (pdo_migrator). The API keeps using the restricted
-- `pdo_app` role so RLS is enforced.
-- =============================================================================

-- =============================================================================
-- 1. Add auth lifecycle columns to users
-- =============================================================================
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS verification_token_hash TEXT,
    ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reset_token_hash TEXT,
    ADD COLUMN IF NOT EXISTS reset_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS avatar_initials TEXT,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Backfill: mark existing seeded P.D.O Classes users as verified
UPDATE users
SET email_verified = TRUE
WHERE institute_id = 'a0000000-0000-4000-8000-000000000001';

COMMENT ON COLUMN users.email_verified IS 'True after the user clicks the email verification link. Seeded P.D.O users are pre-verified.';
COMMENT ON COLUMN users.verification_token_hash IS 'SHA-256 hash of the one-time email verification token. NULL when verified.';
COMMENT ON COLUMN users.verification_expires_at IS 'Expiry timestamp for the verification token (typically 24h).';
COMMENT ON COLUMN users.reset_token_hash IS 'SHA-256 hash of the password reset token. NULL when used/expired.';
COMMENT ON COLUMN users.reset_expires_at IS 'Expiry timestamp for the reset token (typically 1h).';
COMMENT ON COLUMN users.phone IS 'User phone number (E.164 format). Separate from institute phone.';
COMMENT ON COLUMN users.avatar_initials IS '2-3 character initials for avatar fallback when no image is uploaded.';
COMMENT ON COLUMN users.deleted_at IS 'Soft-delete timestamp per DPDP Act. NULL means active.';

-- =============================================================================
-- 2. Refresh token store (rotation + revocation)
-- =============================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active
    ON refresh_tokens (user_id) WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expiry
    ON refresh_tokens (expires_at) WHERE revoked_at IS NULL;

COMMENT ON TABLE refresh_tokens IS 'Stores hashed refresh tokens for rotation and revocation. Access JWTs remain stateless.';

-- =============================================================================
-- 3. RLS on refresh_tokens
-- =============================================================================
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON refresh_tokens;
CREATE POLICY tenant_isolation_policy ON refresh_tokens
    AS PERMISSIVE
    FOR ALL
    TO PUBLIC
    USING (
        user_id IN (
            SELECT user_id FROM users
            WHERE institute_id = app_current_institute_id()
        )
    )
    WITH CHECK (
        user_id IN (
            SELECT user_id FROM users
            WHERE institute_id = app_current_institute_id()
        )
    );

-- =============================================================================
-- 4. SECURITY DEFINER helper functions (auth lifecycle)
-- =============================================================================

-- 4.1 Lookup user by verification token hash (pre-auth, no tenant context)
CREATE OR REPLACE FUNCTION auth_lookup_user_by_verification_token(p_token_hash TEXT)
RETURNS TABLE (
    user_id UUID,
    institute_id UUID,
    email VARCHAR(255),
    email_verified BOOLEAN,
    verification_expires_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT
        u.user_id,
        u.institute_id,
        u.email,
        u.email_verified,
        u.verification_expires_at
    FROM users u
    WHERE u.verification_token_hash = p_token_hash
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION auth_lookup_user_by_verification_token(TEXT) FROM PUBLIC;

DO $$
BEGIN
    GRANT EXECUTE ON FUNCTION auth_lookup_user_by_verification_token(TEXT) TO pdo_app;
EXCEPTION
    WHEN undefined_object OR insufficient_privilege THEN
        RAISE NOTICE 'Skipping auth_lookup_user_by_verification_token grant: pdo_app role is unavailable.';
END
$$;

-- 4.2 Lookup user by password reset token hash (pre-auth, no tenant context)
CREATE OR REPLACE FUNCTION auth_lookup_user_by_reset_token(p_token_hash TEXT)
RETURNS TABLE (
    user_id UUID,
    institute_id UUID,
    email VARCHAR(255),
    reset_expires_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT
        u.user_id,
        u.institute_id,
        u.email,
        u.reset_expires_at
    FROM users u
    WHERE u.reset_token_hash = p_token_hash
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION auth_lookup_user_by_reset_token(TEXT) FROM PUBLIC;

DO $$
BEGIN
    GRANT EXECUTE ON FUNCTION auth_lookup_user_by_reset_token(TEXT) TO pdo_app;
EXCEPTION
    WHEN undefined_object OR insufficient_privilege THEN
        RAISE NOTICE 'Skipping auth_lookup_user_by_reset_token grant: pdo_app role is unavailable.';
END
$$;

-- 4.3 Atomic institute + admin registration (self-serve onboarding)
CREATE OR REPLACE FUNCTION register_institute_and_admin(
    p_institute_name VARCHAR(255),
    p_institute_slug VARCHAR(100),
    p_institute_phone VARCHAR(20),
    p_institute_email VARCHAR(255),
    p_institute_address TEXT,
    p_institute_city VARCHAR(100),
    p_admin_full_name VARCHAR(255),
    p_admin_email VARCHAR(255),
    p_admin_phone VARCHAR(20),
    p_admin_password_hash VARCHAR(255)
)
RETURNS TABLE (
    institute_id UUID,
    user_id UUID,
    verification_token_hash TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_institute_id UUID;
    v_user_id UUID;
    v_raw_token TEXT;
    v_token_hash TEXT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Validate slug uniqueness
    IF EXISTS (SELECT 1 FROM institutes WHERE lower(slug) = lower(btrim(p_institute_slug))) THEN
        RAISE EXCEPTION 'Institute slug already exists';
    END IF;

    -- Validate email uniqueness globally
    IF EXISTS (SELECT 1 FROM users WHERE lower(email) = lower(btrim(p_admin_email))) THEN
        RAISE EXCEPTION 'Admin email already registered';
    END IF;

    -- Create institute
    INSERT INTO institutes (name, slug, phone, email, address, city, is_active)
    VALUES (p_institute_name, lower(btrim(p_institute_slug)), p_institute_phone, p_institute_email, p_institute_address, p_institute_city, TRUE)
    RETURNING institute_id INTO v_institute_id;

    -- Generate verification token (32 bytes = 64 hex chars)
    v_raw_token := encode(gen_random_bytes(32), 'hex');
    v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');
    v_expires_at := CURRENT_TIMESTAMP + INTERVAL '24 hours';

    -- Create INSTITUTE_ADMIN user (unverified initially)
    INSERT INTO users (
        institute_id,
        full_name,
        email,
        phone,
        password_hash,
        role,
        is_active,
        email_verified,
        verification_token_hash,
        verification_expires_at,
        avatar_initials
    )
    VALUES (
        v_institute_id,
        p_admin_full_name,
        lower(btrim(p_admin_email)),
        p_admin_phone,
        p_admin_password_hash,
        'INSTITUTE_ADMIN',
        TRUE,
        FALSE,
        v_token_hash,
        v_expires_at,
        upper(substring(p_admin_full_name from '\b(\w)') || substring(p_admin_full_name from '\s+(\w)'))
    )
    RETURNING user_id INTO v_user_id;

    -- Return the raw token only once so the API can email it
    RETURN QUERY SELECT v_institute_id, v_user_id, v_raw_token;
END;
$$;

REVOKE ALL ON FUNCTION register_institute_and_admin(
    VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR,
    VARCHAR, VARCHAR, VARCHAR, VARCHAR
) FROM PUBLIC;

DO $$
BEGIN
    GRANT EXECUTE ON FUNCTION register_institute_and_admin(
        VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR,
        VARCHAR, VARCHAR, VARCHAR, VARCHAR
    ) TO pdo_app;
EXCEPTION
    WHEN undefined_object OR insufficient_privilege THEN
        RAISE NOTICE 'Skipping register_institute_and_admin grant: pdo_app role is unavailable.';
END
$$;

-- 4.4 Verify email token (consumes token, marks verified)
CREATE OR REPLACE FUNCTION auth_verify_email(p_token_hash TEXT)
RETURNS TABLE (
    user_id UUID,
    institute_id UUID,
    email VARCHAR(255),
    was_already_verified BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_institute_id UUID;
    v_email VARCHAR(255);
    v_already BOOLEAN;
BEGIN
    SELECT user_id, institute_id, email, email_verified
    INTO v_user_id, v_institute_id, v_email, v_already
    FROM users
    WHERE verification_token_hash = p_token_hash
    AND (verification_expires_at IS NULL OR verification_expires_at > CURRENT_TIMESTAMP)
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired verification token';
    END IF;

    IF v_already THEN
        RETURN QUERY SELECT v_user_id, v_institute_id, v_email, TRUE;
        RETURN;
    END IF;

    UPDATE users
    SET email_verified = TRUE,
        verification_token_hash = NULL,
        verification_expires_at = NULL
    WHERE user_id = v_user_id;

    RETURN QUERY SELECT v_user_id, v_institute_id, v_email, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION auth_verify_email(TEXT) FROM PUBLIC;

DO $$
BEGIN
    GRANT EXECUTE ON FUNCTION auth_verify_email(TEXT) TO pdo_app;
EXCEPTION
    WHEN undefined_object OR insufficient_privilege THEN
        RAISE NOTICE 'Skipping auth_verify_email grant: pdo_app role is unavailable.';
END
$$;

-- 4.5 Consume password reset token and update password (revokes all refresh tokens)
CREATE OR REPLACE FUNCTION auth_reset_password(
    p_token_hash TEXT,
    p_new_password_hash VARCHAR(255)
)
RETURNS TABLE (
    user_id UUID,
    institute_id UUID,
    email VARCHAR(255)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_institute_id UUID;
    v_email VARCHAR(255);
BEGIN
    SELECT user_id, institute_id, email
    INTO v_user_id, v_institute_id, v_email
    FROM users
    WHERE reset_token_hash = p_token_hash
    AND reset_expires_at > CURRENT_TIMESTAMP
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired reset token';
    END IF;

    -- Update password and clear reset token
    UPDATE users
    SET password_hash = p_new_password_hash,
        reset_token_hash = NULL,
        reset_expires_at = NULL
    WHERE user_id = v_user_id;

    -- Revoke all active refresh tokens for this user
    UPDATE refresh_tokens
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE user_id = v_user_id
    AND revoked_at IS NULL;

    RETURN QUERY SELECT v_user_id, v_institute_id, v_email;
END;
$$;

REVOKE ALL ON FUNCTION auth_reset_password(TEXT, VARCHAR) FROM PUBLIC;

DO $$
BEGIN
    GRANT EXECUTE ON FUNCTION auth_reset_password(TEXT, VARCHAR) TO pdo_app;
EXCEPTION
    WHEN undefined_object OR insufficient_privilege THEN
        RAISE NOTICE 'Skipping auth_reset_password grant: pdo_app role is unavailable.';
END
$$;

-- 4.6 Store refresh token hash
CREATE OR REPLACE FUNCTION auth_store_refresh_token(
    p_user_id UUID,
    p_token_hash TEXT,
    p_expires_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    VALUES (p_user_id, p_token_hash, p_expires_at);
$$;

REVOKE ALL ON FUNCTION auth_store_refresh_token(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;

DO $$
BEGIN
    GRANT EXECUTE ON FUNCTION auth_store_refresh_token(UUID, TEXT, TIMESTAMPTZ) TO pdo_app;
EXCEPTION
    WHEN undefined_object OR insufficient_privilege THEN
        RAISE NOTICE 'Skipping auth_store_refresh_token grant: pdo_app role is unavailable.';
END
$$;

-- 4.7 Validate and rotate refresh token (returns user_id if valid, NULL if revoked/expired)
CREATE OR REPLACE FUNCTION auth_validate_refresh_token(p_token_hash TEXT)
RETURNS TABLE (
    user_id UUID,
    institute_id UUID,
    role user_role,
    is_active BOOLEAN,
    institute_is_active BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT
        u.user_id,
        u.institute_id,
        u.role,
        COALESCE(u.is_active, FALSE),
        COALESCE(i.is_active, FALSE)
    FROM refresh_tokens rt
    JOIN users u ON u.user_id = rt.user_id
    JOIN institutes i ON i.institute_id = u.institute_id
    WHERE rt.token_hash = p_token_hash
    AND rt.revoked_at IS NULL
    AND rt.expires_at > CURRENT_TIMESTAMP
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION auth_validate_refresh_token(TEXT) FROM PUBLIC;

DO $$
BEGIN
    GRANT EXECUTE ON FUNCTION auth_validate_refresh_token(TEXT) TO pdo_app;
EXCEPTION
    WHEN undefined_object OR insufficient_privilege THEN
        RAISE NOTICE 'Skipping auth_validate_refresh_token grant: pdo_app role is unavailable.';
END
$$;

-- 4.8 Revoke refresh token (logout)
CREATE OR REPLACE FUNCTION auth_revoke_refresh_token(p_token_hash TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    UPDATE refresh_tokens
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE token_hash = p_token_hash;
$$;

REVOKE ALL ON FUNCTION auth_revoke_refresh_token(TEXT) FROM PUBLIC;

DO $$
BEGIN
    GRANT EXECUTE ON FUNCTION auth_revoke_refresh_token(TEXT) TO pdo_app;
EXCEPTION
    WHEN undefined_object OR insufficient_privilege THEN
        RAISE NOTICE 'Skipping auth_revoke_refresh_token grant: pdo_app role is unavailable.';
END
$$;

-- 4.9 Revoke all refresh tokens for a user (password change, account deletion)
CREATE OR REPLACE FUNCTION auth_revoke_all_refresh_tokens(p_user_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    UPDATE refresh_tokens
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id
    AND revoked_at IS NULL;
$$;

REVOKE ALL ON FUNCTION auth_revoke_all_refresh_tokens(UUID) FROM PUBLIC;

DO $$
BEGIN
    GRANT EXECUTE ON FUNCTION auth_revoke_all_refresh_tokens(UUID) TO pdo_app;
EXCEPTION
    WHEN undefined_object OR insufficient_privilege THEN
        RAISE NOTICE 'Skipping auth_revoke_all_refresh_tokens grant: pdo_app role is unavailable.';
END
$$;

-- 4.10 Soft-delete / anonymize user (DPDP Act compliance)
CREATE OR REPLACE FUNCTION auth_soft_delete_user(p_user_id UUID, p_confirmation TEXT)
RETURNS TABLE (
    user_id UUID,
    institute_id UUID,
    was_sole_admin BOOLEAN,
    institute_deleted BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_institute_id UUID;
    v_role user_role;
    v_admin_count INT;
    v_was_sole_admin BOOLEAN := FALSE;
    v_institute_deleted BOOLEAN := FALSE;
BEGIN
    -- Confirm the user typed "DELETE"
    IF p_confirmation <> 'DELETE' THEN
        RAISE EXCEPTION 'Confirmation text must be exactly DELETE';
    END IF;

    SELECT institute_id, role
    INTO v_institute_id, v_role
    FROM users
    WHERE user_id = p_user_id
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- If INSTITUTE_ADMIN, check if sole admin
    IF v_role = 'INSTITUTE_ADMIN' THEN
        SELECT COUNT(*) INTO v_admin_count
        FROM users
        WHERE institute_id = v_institute_id
        AND role = 'INSTITUTE_ADMIN'
        AND is_active = TRUE
        AND deleted_at IS NULL;

        IF v_admin_count = 1 THEN
            v_was_sole_admin := TRUE;

            -- Soft-delete the entire institute (cascade via RLS will hide data)
            UPDATE institutes
            SET is_active = FALSE
            WHERE institute_id = v_institute_id;

            v_institute_deleted := TRUE;
        END IF;
    END IF;

    -- Soft-delete the user (anonymize PII per DPDP)
    UPDATE users
    SET
        full_name = 'Deleted User',
        email = 'deleted_' || user_id || '@pdo.local',
        phone = NULL,
        password_hash = '',
        role = 'TEACHER',
        is_active = FALSE,
        deleted_at = CURRENT_TIMESTAMP,
        email_verified = FALSE,
        verification_token_hash = NULL,
        verification_expires_at = NULL,
        reset_token_hash = NULL,
        reset_expires_at = NULL,
        avatar_initials = NULL
    WHERE user_id = p_user_id;

    -- Revoke all refresh tokens
    PERFORM auth_revoke_all_refresh_tokens(p_user_id);

    RETURN QUERY SELECT p_user_id, v_institute_id, v_was_sole_admin, v_institute_deleted;
END;
$$;

REVOKE ALL ON FUNCTION auth_soft_delete_user(UUID, TEXT) FROM PUBLIC;

DO $$
BEGIN
    GRANT EXECUTE ON FUNCTION auth_soft_delete_user(UUID, TEXT) TO pdo_app;
EXCEPTION
    WHEN undefined_object OR insufficient_privilege THEN
        RAISE NOTICE 'Skipping auth_soft_delete_user grant: pdo_app role is unavailable.';
END
$$;

-- 4.11 Update user profile (name, phone, password)
CREATE OR REPLACE FUNCTION auth_update_profile(
    p_user_id UUID,
    p_full_name VARCHAR(255) DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_new_password_hash VARCHAR(255) DEFAULT NULL,
    p_avatar_initials TEXT DEFAULT NULL
)
RETURNS TABLE (
    user_id UUID,
    full_name VARCHAR(255),
    email VARCHAR(255),
    phone TEXT,
    avatar_initials TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_update_sql TEXT;
    v_params TEXT[];
BEGIN
    -- Build dynamic update
    v_update_sql := 'UPDATE users SET updated_at = CURRENT_TIMESTAMP';
    v_params := ARRAY[p_user_id];
    DECLARE
        param_idx INT := 2;
    BEGIN
        IF p_full_name IS NOT NULL THEN
            v_update_sql := v_update_sql || ', full_name = $' || param_idx;
            v_params := v_params || p_full_name;
            param_idx := param_idx + 1;
        END IF;
        IF p_phone IS NOT NULL THEN
            v_update_sql := v_update_sql || ', phone = $' || param_idx;
            v_params := v_params || p_phone;
            param_idx := param_idx + 1;
        END IF;
        IF p_new_password_hash IS NOT NULL THEN
            v_update_sql := v_update_sql || ', password_hash = $' || param_idx;
            v_params := v_params || p_new_password_hash;
            param_idx := param_idx + 1;
        END IF;
        IF p_avatar_initials IS NOT NULL THEN
            v_update_sql := v_update_sql || ', avatar_initials = $' || param_idx;
            v_params := v_params || p_avatar_initials;
            param_idx := param_idx + 1;
        END IF;

        v_update_sql := v_update_sql || ' WHERE user_id = $1 RETURNING user_id, full_name, email, phone, avatar_initials';

        RETURN QUERY EXECUTE v_update_sql USING v_params;
    END;
END;
$$;

REVOKE ALL ON FUNCTION auth_update_profile(UUID, VARCHAR, TEXT, VARCHAR, TEXT) FROM PUBLIC;

DO $$
BEGIN
    GRANT EXECUTE ON FUNCTION auth_update_profile(UUID, VARCHAR, TEXT, VARCHAR, TEXT) TO pdo_app;
EXCEPTION
    WHEN undefined_object OR insufficient_privilege THEN
        RAISE NOTICE 'Skipping auth_update_profile grant: pdo_app role is unavailable.';
END
$$;

-- =============================================================================
-- 5. Updated grant for new functions
-- =============================================================================
DO $$
BEGIN
    GRANT EXECUTE ON FUNCTION auth_lookup_user_by_verification_token(TEXT) TO pdo_app;
    GRANT EXECUTE ON FUNCTION auth_lookup_user_by_reset_token(TEXT) TO pdo_app;
    GRANT EXECUTE ON FUNCTION register_institute_and_admin(
        VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR,
        VARCHAR, VARCHAR, VARCHAR, VARCHAR
    ) TO pdo_app;
    GRANT EXECUTE ON FUNCTION auth_verify_email(TEXT) TO pdo_app;
    GRANT EXECUTE ON FUNCTION auth_reset_password(TEXT, VARCHAR) TO pdo_app;
    GRANT EXECUTE ON FUNCTION auth_store_refresh_token(UUID, TEXT, TIMESTAMPTZ) TO pdo_app;
    GRANT EXECUTE ON FUNCTION auth_validate_refresh_token(TEXT) TO pdo_app;
    GRANT EXECUTE ON FUNCTION auth_revoke_refresh_token(TEXT) TO pdo_app;
    GRANT EXECUTE ON FUNCTION auth_revoke_all_refresh_tokens(UUID) TO pdo_app;
    GRANT EXECUTE ON FUNCTION auth_soft_delete_user(UUID, TEXT) TO pdo_app;
    GRANT EXECUTE ON FUNCTION auth_update_profile(UUID, VARCHAR, TEXT, VARCHAR, TEXT) TO pdo_app;
EXCEPTION
    WHEN undefined_object OR insufficient_privilege THEN
        RAISE NOTICE 'Skipping some grants: pdo_app role is unavailable.';
END
$$;

-- =============================================================================
-- 6. Cleanup: remove expired refresh tokens periodically (run via pg_cron or app)
-- =============================================================================
COMMENT ON TABLE refresh_tokens IS 'Run: DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL ''30 days''; periodically to avoid bloat.';