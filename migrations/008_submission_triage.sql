ALTER TABLE community_submissions
    ADD COLUMN submission_kind ENUM('new','change') NOT NULL DEFAULT 'new' AFTER existing_target_id,
    ADD COLUMN triage_status ENUM('clear','needs_review','possible_duplicate','suspicious') NOT NULL DEFAULT 'needs_review' AFTER review_status,
    ADD COLUMN triage_score TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER triage_status,
    ADD COLUMN duplicate_target_id BIGINT UNSIGNED NULL AFTER triage_score,
    ADD COLUMN triage_reasons JSON NULL AFTER duplicate_target_id,
    ADD KEY idx_community_submissions_triage (review_status, triage_status, entity_type, created_at);
