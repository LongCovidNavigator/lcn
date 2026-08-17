ALTER TABLE community_submissions
    ADD COLUMN existing_target_id BIGINT UNSIGNED NULL AFTER entity_type,
    ADD KEY idx_community_submissions_existing_target (entity_type, existing_target_id);
