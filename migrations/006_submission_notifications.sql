CREATE TABLE IF NOT EXISTS submission_notification_runs (
    run_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    period_start DATETIME NULL,
    delivery_status ENUM('running', 'sent', 'skipped', 'failed', 'dry_run') NOT NULL DEFAULT 'running',
    new_submission_count INT UNSIGNED NOT NULL DEFAULT 0,
    pending_submission_count INT UNSIGNED NOT NULL DEFAULT 0,
    error_message VARCHAR(255) NULL,
    PRIMARY KEY (run_id),
    KEY idx_submission_notification_status_time (delivery_status, completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
