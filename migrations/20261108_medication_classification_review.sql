CREATE TABLE IF NOT EXISTS medication_classification_reviews (
    treatment_id INT UNSIGNED NOT NULL,
    role ENUM('group','ingredient','brand') NOT NULL,
    decision ENUM('approved','rejected') NOT NULL,
    treatment_name VARCHAR(255) NOT NULL,
    support INT UNSIGNED NOT NULL,
    related_id INT UNSIGNED NULL,
    reviewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_by VARCHAR(100) NOT NULL,
    PRIMARY KEY (treatment_id,role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
