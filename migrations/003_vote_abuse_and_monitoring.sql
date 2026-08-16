CREATE TABLE IF NOT EXISTS vote_request_events (
    request_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    voter_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    target_type ENUM('doctor', 'treatment') NOT NULL,
    target_id BIGINT UNSIGNED NOT NULL,
    vote_direction ENUM('pro', 'neutral', 'contra') NOT NULL,
    vote_changed TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (request_id),
    KEY idx_vote_requests_source_time (source_key, occurred_at),
    KEY idx_vote_requests_target_time (target_type, target_id, occurred_at),
    KEY idx_vote_requests_voter_time (voter_key, occurred_at),
    KEY idx_vote_requests_cleanup (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vote_abuse_events (
    event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    detected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    event_type ENUM(
        'RATE_1MIN',
        'RATE_10MIN',
        'MANY_VOTERS_FROM_SOURCE',
        'TARGET_SPIKE_10MIN',
        'TARGET_SPIKE_1H',
        'TARGET_DIRECTION_SPIKE',
        'HARD_RATE_LIMIT'
    ) NOT NULL,
    severity ENUM('info', 'warning', 'critical') NOT NULL DEFAULT 'warning',
    target_type ENUM('doctor', 'treatment') NULL,
    target_id BIGINT UNSIGNED NULL,
    window_start DATETIME NOT NULL,
    window_end DATETIME NOT NULL,
    vote_count INT UNSIGNED NOT NULL DEFAULT 0,
    voter_count INT UNSIGNED NOT NULL DEFAULT 0,
    source_count INT UNSIGNED NOT NULL DEFAULT 0,
    vote_direction ENUM('pro', 'neutral', 'contra') NULL,
    source_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    details JSON NULL,
    review_status ENUM('open', 'confirmed', 'dismissed') NOT NULL DEFAULT 'open',
    reviewed_at DATETIME NULL,
    reported_at DATETIME NULL,
    dedupe_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    PRIMARY KEY (event_id),
    UNIQUE KEY uq_vote_abuse_dedupe (dedupe_key),
    KEY idx_vote_abuse_report (reported_at, detected_at),
    KEY idx_vote_abuse_target (target_type, target_id, detected_at),
    KEY idx_vote_abuse_source (source_key, detected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vote_source_blocks (
    source_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    blocked_until DATETIME NOT NULL,
    reason VARCHAR(80) NOT NULL,
    event_id BIGINT UNSIGNED NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (source_key),
    KEY idx_vote_blocks_expiry (blocked_until),
    CONSTRAINT fk_vote_blocks_event
        FOREIGN KEY (event_id) REFERENCES vote_abuse_events (event_id)
        ON UPDATE RESTRICT ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vote_monitoring_runs (
    run_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    delivery_status ENUM('running', 'sent', 'failed', 'dry_run') NOT NULL DEFAULT 'running',
    doctor_vote_count INT UNSIGNED NOT NULL DEFAULT 0,
    treatment_vote_count INT UNSIGNED NOT NULL DEFAULT 0,
    abuse_event_count INT UNSIGNED NOT NULL DEFAULT 0,
    error_message VARCHAR(255) NULL,
    PRIMARY KEY (run_id),
    KEY idx_monitoring_runs_status_time (delivery_status, completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
