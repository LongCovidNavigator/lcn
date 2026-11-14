CREATE TABLE IF NOT EXISTS review_approval_snapshots (
    source VARCHAR(24) NOT NULL,
    entry_key VARCHAR(100) NOT NULL,
    changes JSON NOT NULL,
    PRIMARY KEY (source, entry_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
