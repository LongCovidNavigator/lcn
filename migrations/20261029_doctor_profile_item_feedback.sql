CREATE TABLE IF NOT EXISTS doctor_profile_item_feedback (
 dr_id INT NOT NULL,
 section_key VARCHAR(20) NOT NULL,
 field_key VARCHAR(30) NOT NULL,
 item_hash CHAR(64) NOT NULL,
 item_label VARCHAR(1000) NOT NULL,
 respondent_key CHAR(64) NOT NULL,
 stance TINYINT NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY(dr_id,section_key,field_key,item_hash,respondent_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
