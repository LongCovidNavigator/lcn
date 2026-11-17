CREATE TABLE IF NOT EXISTS therapy_orientation_poll (
 treatment_id INT NOT NULL,
 question VARCHAR(16) NOT NULL,
 respondent_key CHAR(64) NOT NULL,
 answer VARCHAR(3) NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (treatment_id, question, respondent_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
