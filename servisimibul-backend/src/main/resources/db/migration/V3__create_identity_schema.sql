CREATE TABLE app_user (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    email_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT app_user_email_unique UNIQUE (email),
    CONSTRAINT app_user_email_normalized CHECK (
        email = lower(btrim(email))
        AND char_length(email) BETWEEN 3 AND 254
    ),
    CONSTRAINT app_user_password_hash_not_blank CHECK (btrim(password_hash) <> ''),
    CONSTRAINT app_user_role_check CHECK (role IN ('ADMIN', 'OPERATOR'))
);

CREATE TABLE operator_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    business_name VARCHAR(120) NOT NULL,
    contact_phone VARCHAR(16) NOT NULL,
    description TEXT,
    approval_status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_publicly_visible BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT operator_profile_user_fk
        FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE RESTRICT,
    CONSTRAINT operator_profile_user_unique UNIQUE (user_id),
    CONSTRAINT operator_profile_business_name_length CHECK (
        char_length(btrim(business_name)) BETWEEN 2 AND 120
    ),
    CONSTRAINT operator_profile_contact_phone_e164 CHECK (
        contact_phone ~ '^\+[0-9]{8,15}$'
    ),
    CONSTRAINT operator_profile_approval_status_check CHECK (
        approval_status IN ('DRAFT', 'PENDING', 'CHANGES_REQUESTED', 'APPROVED')
    )
);

CREATE TABLE email_verification_token (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT email_verification_token_user_fk
        FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE RESTRICT,
    CONSTRAINT email_verification_token_hash_unique UNIQUE (token_hash),
    CONSTRAINT email_verification_token_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT email_verification_token_expiry_check CHECK (expires_at > created_at),
    CONSTRAINT email_verification_token_consumed_check CHECK (
        consumed_at IS NULL OR consumed_at >= created_at
    )
);

CREATE TABLE password_reset_token (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT password_reset_token_user_fk
        FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE RESTRICT,
    CONSTRAINT password_reset_token_hash_unique UNIQUE (token_hash),
    CONSTRAINT password_reset_token_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT password_reset_token_expiry_check CHECK (expires_at > created_at),
    CONSTRAINT password_reset_token_consumed_check CHECK (
        consumed_at IS NULL OR consumed_at >= created_at
    )
);

CREATE TABLE operator_application_review (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id UUID NOT NULL,
    reviewed_by UUID NOT NULL,
    decision VARCHAR(30) NOT NULL,
    reason TEXT,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT operator_application_review_operator_fk
        FOREIGN KEY (operator_id) REFERENCES operator_profile (id) ON DELETE RESTRICT,
    CONSTRAINT operator_application_review_reviewer_fk
        FOREIGN KEY (reviewed_by) REFERENCES app_user (id) ON DELETE RESTRICT,
    CONSTRAINT operator_application_review_decision_check CHECK (
        decision IN ('APPROVED', 'CHANGES_REQUESTED')
    ),
    CONSTRAINT operator_application_review_reason_check CHECK (
        decision <> 'CHANGES_REQUESTED'
        OR reason IS NOT NULL AND btrim(reason) <> ''
    )
);

CREATE INDEX operator_profile_approval_visibility_idx
    ON operator_profile (approval_status, is_active, is_publicly_visible);
CREATE INDEX email_verification_token_user_id_idx ON email_verification_token (user_id);
CREATE INDEX email_verification_token_expires_at_idx ON email_verification_token (expires_at);
CREATE INDEX password_reset_token_user_id_idx ON password_reset_token (user_id);
CREATE INDEX password_reset_token_expires_at_idx ON password_reset_token (expires_at);
CREATE INDEX operator_application_review_operator_id_idx
    ON operator_application_review (operator_id);
CREATE INDEX operator_application_review_reviewed_by_idx
    ON operator_application_review (reviewed_by);

ALTER TABLE app_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_token ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_token ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_application_review ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
    app_user,
    operator_profile,
    email_verification_token,
    password_reset_token,
    operator_application_review
FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    app_user,
    operator_profile,
    email_verification_token,
    password_reset_token,
    operator_application_review
TO servisimibul_app;

CREATE POLICY app_user_backend_access ON app_user
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);
CREATE POLICY operator_profile_backend_access ON operator_profile
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);
CREATE POLICY email_verification_token_backend_access ON email_verification_token
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);
CREATE POLICY password_reset_token_backend_access ON password_reset_token
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);
CREATE POLICY operator_application_review_backend_access ON operator_application_review
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);

DO $$
DECLARE
    data_api_role TEXT;
BEGIN
    FOREACH data_api_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = data_api_role) THEN
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON TABLE app_user, operator_profile, email_verification_token, password_reset_token, operator_application_review FROM %I',
                data_api_role
            );
        END IF;
    END LOOP;
END
$$;
