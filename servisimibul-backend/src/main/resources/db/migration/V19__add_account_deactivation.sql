-- Independent restriction flag for voluntary self-deactivation (APP-09, LEG-07 #200).
-- Deliberately separate from is_enabled (administrative suspension) so lifting one
-- can never lift the other. No code path clears this column; self-reactivation is
-- out of scope until the LEG-07 lifecycle policy is approved.
ALTER TABLE app_user
    ADD COLUMN deactivated_at TIMESTAMPTZ NULL;
