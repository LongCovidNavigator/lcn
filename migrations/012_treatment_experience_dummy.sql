-- Synthetic four-category examples, separate from existing votes.
CREATE TABLE IF NOT EXISTS treatment_experience_dummy_counts (
    treat_id INT UNSIGNED NOT NULL PRIMARY KEY,
    worsening INT UNSIGNED NOT NULL,
    unchanged INT UNSIGNED NOT NULL,
    improvement INT UNSIGNED NOT NULL,
    healing INT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
