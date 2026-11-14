CREATE TABLE IF NOT EXISTS review_reopen_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    source VARCHAR(24) NOT NULL,
    entry_key VARCHAR(100) NOT NULL,
    previous_decision JSON NOT NULL,
    reopened_by VARCHAR(100) NOT NULL,
    reopened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY review_entry (source, entry_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
