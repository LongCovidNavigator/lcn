CREATE TABLE IF NOT EXISTS community_submission_votes (
    submission_id BIGINT UNSIGNED NOT NULL,
    voter_key CHAR(64) NOT NULL,
    vote ENUM('pro', 'neutral', 'contra') NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    migrated_entity_type ENUM('doctor', 'treatment') NULL,
    migrated_target_id BIGINT UNSIGNED NULL,
    migrated_at TIMESTAMP NULL,
    PRIMARY KEY (submission_id, voter_key),
    KEY idx_community_submission_votes_target (migrated_entity_type, migrated_target_id),
    CONSTRAINT fk_community_submission_votes_submission
        FOREIGN KEY (submission_id) REFERENCES community_submissions(submission_id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO community_submission_votes (submission_id, voter_key, vote, created_at, updated_at)
SELECT submission_id, submitter_key, experience, created_at, created_at
FROM community_submissions
WHERE experience IS NOT NULL;
