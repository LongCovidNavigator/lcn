CREATE TABLE IF NOT EXISTS community_doctor_answers (
 submission_id BIGINT UNSIGNED NOT NULL,
 respondent_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 question_key VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 context_key VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
 option_value TINYINT UNSIGNED NOT NULL,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (submission_id,respondent_key,question_key,context_key),
 FOREIGN KEY (submission_id) REFERENCES community_submissions(submission_id) ON DELETE CASCADE,
 FOREIGN KEY (question_key,context_key,option_value) REFERENCES doctor_community_options(question_key,context_key,option_value)
) ENGINE=InnoDB;
