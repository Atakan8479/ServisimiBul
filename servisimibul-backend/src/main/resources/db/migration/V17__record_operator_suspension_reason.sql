ALTER TABLE operator_application_review
    DROP CONSTRAINT operator_application_review_decision_check;

ALTER TABLE operator_application_review
    ADD CONSTRAINT operator_application_review_decision_check CHECK (
        decision IN ('APPROVED', 'CHANGES_REQUESTED', 'SUSPENDED')
    );

ALTER TABLE operator_application_review
    DROP CONSTRAINT operator_application_review_reason_check;

ALTER TABLE operator_application_review
    ADD CONSTRAINT operator_application_review_reason_check CHECK (
        decision NOT IN ('CHANGES_REQUESTED', 'SUSPENDED')
        OR reason IS NOT NULL AND btrim(reason) <> ''
    );
