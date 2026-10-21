ALTER TABLE demand_support DROP CONSTRAINT demand_support_status_check;
ALTER TABLE demand_support ADD CONSTRAINT demand_support_status_check CHECK (status IN (
    'ACTIVE',
    'AWAITING_FEEDBACK',
    'SATISFIED',
    'INACTIVE_EXPIRED',
    'WITHDRAWN'
));

ALTER TABLE demand ADD COLUMN closure_reason VARCHAR(20);
ALTER TABLE demand ADD COLUMN closed_at TIMESTAMPTZ;
ALTER TABLE demand ADD CONSTRAINT demand_closure_check CHECK (
    (status = 'OPEN' AND closure_reason IS NULL AND closed_at IS NULL)
    OR (status = 'CLOSED' AND closure_reason IN ('FULFILLED', 'INACTIVE', 'ADMIN') AND closed_at IS NOT NULL)
    OR (status = 'ARCHIVED')
);

CREATE TABLE demand_service_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    support_id UUID NOT NULL,
    publication_event_id UUID NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'AWAITING_FEEDBACK',
    opened_at TIMESTAMPTZ,
    reminder_due_at TIMESTAMPTZ,
    reminder_triggered_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    evaluated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT demand_service_feedback_support_fk
        FOREIGN KEY (support_id) REFERENCES demand_support (id) ON DELETE CASCADE,
    CONSTRAINT demand_service_feedback_publication_event_fk
        FOREIGN KEY (publication_event_id)
        REFERENCES demand_service_publication_event (id) ON DELETE CASCADE,
    CONSTRAINT demand_service_feedback_unique
        UNIQUE (support_id, publication_event_id),
    CONSTRAINT demand_service_feedback_status_check CHECK (status IN (
        'AWAITING_FEEDBACK',
        'SATISFIED',
        'NOT_SATISFIED',
        'INACTIVE_EXPIRED',
        'SUPERSEDED'
    )),
    CONSTRAINT demand_service_feedback_open_check CHECK (
        (opened_at IS NULL AND reminder_due_at IS NULL)
        OR (opened_at IS NOT NULL AND reminder_due_at IS NOT NULL)
    ),
    CONSTRAINT demand_service_feedback_reminder_check CHECK (
        reminder_triggered_at IS NULL OR opened_at IS NOT NULL
    ),
    CONSTRAINT demand_service_feedback_evaluation_check CHECK (
        (status IN ('SATISFIED', 'NOT_SATISFIED') AND evaluated_at IS NOT NULL)
        OR (status NOT IN ('SATISFIED', 'NOT_SATISFIED') AND evaluated_at IS NULL)
    )
);

CREATE TABLE demand_lifecycle_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    demand_id UUID NOT NULL,
    event_type VARCHAR(24) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT demand_lifecycle_event_demand_fk
        FOREIGN KEY (demand_id) REFERENCES demand (id) ON DELETE CASCADE,
    CONSTRAINT demand_lifecycle_event_type_check CHECK (event_type IN (
        'CLOSED_FULFILLED',
        'CLOSED_INACTIVE',
        'CLOSED_ADMIN',
        'REOPENED'
    ))
);

CREATE INDEX demand_service_feedback_due_idx
    ON demand_service_feedback (status, expires_at, reminder_due_at);
CREATE INDEX demand_service_feedback_support_idx
    ON demand_service_feedback (support_id, created_at DESC);
CREATE INDEX demand_lifecycle_event_demand_idx
    ON demand_lifecycle_event (demand_id, occurred_at DESC, id DESC);

ALTER TABLE demand_service_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE demand_lifecycle_event ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE demand_service_feedback, demand_lifecycle_event FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE demand_service_feedback, demand_lifecycle_event
TO servisimibul_app;

CREATE POLICY demand_service_feedback_backend_access ON demand_service_feedback
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);
CREATE POLICY demand_lifecycle_event_backend_access ON demand_lifecycle_event
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);

DO $$
DECLARE
    data_api_role TEXT;
BEGIN
    FOREACH data_api_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = data_api_role) THEN
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON TABLE demand_service_feedback, demand_lifecycle_event FROM %I',
                data_api_role
            );
        END IF;
    END LOOP;
END
$$;
