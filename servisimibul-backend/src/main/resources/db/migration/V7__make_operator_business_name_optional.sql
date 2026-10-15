ALTER TABLE operator_profile
    ALTER COLUMN business_name DROP NOT NULL;

ALTER TABLE operator_profile
    DROP CONSTRAINT operator_profile_business_name_length;

ALTER TABLE operator_profile
    ADD CONSTRAINT operator_profile_business_name_length CHECK (
        business_name IS NULL
        OR char_length(btrim(business_name)) BETWEEN 2 AND 120
    );
