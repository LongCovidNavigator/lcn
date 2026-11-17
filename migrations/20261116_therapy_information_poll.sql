CREATE TABLE IF NOT EXISTS therapy_information_poll (
 treatment_id INT NOT NULL,
 respondent_key CHAR(64) NOT NULL,
 answer VARCHAR(16) NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (treatment_id, respondent_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
