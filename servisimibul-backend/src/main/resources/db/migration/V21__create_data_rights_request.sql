-- APP-07 (#214): tracking scaffold for KVKK data-subject requests.
-- Intake and handling stay disabled (app.data-rights.enabled=false) until the LEG-06 (#199)
-- channel, request types, identity method and templates are approved. By design there is no
-- column for a T.C. identity number, identity document, postal address or other contact data.

-- Least privilege: only ADMIN accounts listed here may read or handle requests. Rows are
-- added by a reviewed operational change, never by an application endpoint.
CREATE TABLE data_rights_handler (
    user_id UUID NOT NULL,
    designated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT data_rights_handler_pk PRIMARY KEY (user_id),
    CONSTRAINT data_rights_handler_user_fk
        FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE
);

-- received_at is written only by the server when an intake actually commits; there is no
-- draft state. response_due_at is the verified 30-day statutory maximum from received_at and
-- is never paused or extended: how incomplete submissions or extra proof affect the period
-- is pending counsel (LEG-06 RQ3).
CREATE TABLE data_rights_request (
    id UUID NOT NULL,
    requester_id UUID NOT NULL,
    request_type VARCHAR(32) NOT NULL,
    details VARCHAR(2000) NOT NULL,
    status VARCHAR(32) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    response_due_at TIMESTAMPTZ NOT NULL,
    assigned_handler_id UUID NULL,
    identity_verified_at TIMESTAMPTZ NULL,
    identity_verified_by UUID NULL,
    handler_note VARCHAR(1000) NULL,
    closed_at TIMESTAMPTZ NULL,
    response_delivered_at TIMESTAMPTZ NULL,
    version BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT data_rights_request_pk PRIMARY KEY (id),
    CONSTRAINT data_rights_request_requester_fk
        FOREIGN KEY (requester_id) REFERENCES app_user (id),
    CONSTRAINT data_rights_request_handler_fk
        FOREIGN KEY (assigned_handler_id) REFERENCES app_user (id),
    CONSTRAINT data_rights_request_verifier_fk
        FOREIGN KEY (identity_verified_by) REFERENCES app_user (id),
    CONSTRAINT data_rights_request_type_check
        CHECK (request_type IN ('ACCESS', 'CORRECTION', 'ERASURE', 'OBJECTION', 'OTHER')),
    CONSTRAINT data_rights_request_status_check
        CHECK (status IN (
            'RECEIVED', 'UNDER_REVIEW', 'AWAITING_VERIFICATION',
            'RESPONDED', 'PARTIALLY_RESPONDED', 'REJECTED'
        )),
    CONSTRAINT data_rights_request_details_check CHECK (length(btrim(details)) > 0),
    CONSTRAINT data_rights_request_due_check
        CHECK (response_due_at = received_at + INTERVAL '720 hours'),
    CONSTRAINT data_rights_request_closed_check
        CHECK ((status IN ('RESPONDED', 'PARTIALLY_RESPONDED', 'REJECTED')) = (closed_at IS NOT NULL)),
    CONSTRAINT data_rights_request_reason_check
        CHECK (status NOT IN ('PARTIALLY_RESPONDED', 'REJECTED') OR handler_note IS NOT NULL),
    CONSTRAINT data_rights_request_delivery_check
        CHECK (response_delivered_at IS NULL OR closed_at IS NOT NULL),
    CONSTRAINT data_rights_request_identity_check
        CHECK ((identity_verified_at IS NULL) = (identity_verified_by IS NULL)),
    CONSTRAINT data_rights_request_version_check CHECK (version >= 0)
);

-- One open request per requester and type; concurrent duplicates fail on this index.
CREATE UNIQUE INDEX data_rights_request_open_type_uidx
    ON data_rights_request (requester_id, request_type)
    WHERE status IN ('RECEIVED', 'UNDER_REVIEW', 'AWAITING_VERIFICATION');
CREATE INDEX data_rights_request_requester_idx
    ON data_rights_request (requester_id, received_at DESC);
CREATE INDEX data_rights_request_due_idx
    ON data_rights_request (response_due_at, id);
CREATE INDEX data_rights_request_handler_idx
    ON data_rights_request (assigned_handler_id) WHERE assigned_handler_id IS NOT NULL;
CREATE INDEX data_rights_request_verifier_idx
    ON data_rights_request (identity_verified_by) WHERE identity_verified_by IS NOT NULL;

-- Minimal audit history: who did what and the status change, without copying request text.
CREATE TABLE data_rights_request_event (
    id UUID NOT NULL,
    request_id UUID NOT NULL,
    actor_id UUID NOT NULL,
    action VARCHAR(32) NOT NULL,
    from_status VARCHAR(32) NULL,
    to_status VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT data_rights_request_event_pk PRIMARY KEY (id),
    CONSTRAINT data_rights_request_event_request_fk
        FOREIGN KEY (request_id) REFERENCES data_rights_request (id),
    CONSTRAINT data_rights_request_event_actor_fk
        FOREIGN KEY (actor_id) REFERENCES app_user (id),
    CONSTRAINT data_rights_request_event_action_check
        CHECK (action IN (
            'RECEIVE', 'ASSIGN', 'START_REVIEW', 'REQUEST_VERIFICATION',
            'RECORD_IDENTITY_VERIFIED', 'RESPOND', 'RESPOND_PARTIALLY', 'REJECT',
            'RECORD_DELIVERY'
        ))
);

CREATE INDEX data_rights_request_event_request_idx
    ON data_rights_request_event (request_id, created_at, id);
CREATE INDEX data_rights_request_event_actor_idx
    ON data_rights_request_event (actor_id);

ALTER TABLE data_rights_handler ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_rights_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_rights_request_event ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE data_rights_handler, data_rights_request, data_rights_request_event
    FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE data_rights_handler, data_rights_request, data_rights_request_event
    TO servisimibul_app;

CREATE POLICY data_rights_handler_backend_access ON data_rights_handler
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);
CREATE POLICY data_rights_request_backend_access ON data_rights_request
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);
CREATE POLICY data_rights_request_event_backend_access ON data_rights_request_event
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);

DO $$
DECLARE
    data_api_role TEXT;
BEGIN
    FOREACH data_api_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = data_api_role) THEN
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON TABLE data_rights_handler, data_rights_request, '
                    || 'data_rights_request_event FROM %I',
                data_api_role
            );
        END IF;
    END LOOP;
END
$$;
