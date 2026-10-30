CREATE TABLE IF NOT EXISTS doctor_profile_feedback (
 dr_id INT NOT NULL,
 section_key VARCHAR(20) NOT NULL,
 respondent_key CHAR(64) NOT NULL,
 stance TINYINT NOT NULL,
 corrections JSON NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (dr_id,section_key,respondent_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
