CREATE TABLE IF NOT EXISTS doctor_votes (
    vote_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    voter_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    dr_id BIGINT UNSIGNED NOT NULL,
    vote ENUM('pro', 'neutral', 'contra') NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    review_status ENUM('active', 'suspicious', 'excluded') NOT NULL DEFAULT 'active',
    flag_reason VARCHAR(255) NULL,
    flagged_at DATETIME NULL,
    flag_event_id BIGINT UNSIGNED NULL,
    PRIMARY KEY (vote_id),
    UNIQUE KEY uq_doctor_votes_voter_target (voter_key, dr_id),
    KEY idx_doctor_votes_target_review (dr_id, review_status, vote),
    CONSTRAINT fk_doctor_votes_doctor
        FOREIGN KEY (dr_id) REFERENCES tbl_drs_03 (dr_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS treatment_votes (
    vote_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    voter_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    treat_id INT UNSIGNED NOT NULL,
    vote ENUM('pro', 'neutral', 'contra') NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    review_status ENUM('active', 'suspicious', 'excluded') NOT NULL DEFAULT 'active',
    flag_reason VARCHAR(255) NULL,
    flagged_at DATETIME NULL,
    flag_event_id BIGINT UNSIGNED NULL,
    PRIMARY KEY (vote_id),
    UNIQUE KEY uq_treatment_votes_voter_target (voter_key, treat_id),
    KEY idx_treatment_votes_target_review (treat_id, review_status, vote),
    CONSTRAINT fk_treatment_votes_treatment
        FOREIGN KEY (treat_id) REFERENCES tbl_treatments_03 (treat_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
