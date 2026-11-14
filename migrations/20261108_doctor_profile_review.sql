CREATE TABLE IF NOT EXISTS doctor_profile_review_decisions (
    proposal_key CHAR(64) NOT NULL PRIMARY KEY,
    dr_id INT UNSIGNED NOT NULL,
    decision ENUM('approved','rejected') NOT NULL,
    proposal JSON NOT NULL,
    reviewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_by VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
