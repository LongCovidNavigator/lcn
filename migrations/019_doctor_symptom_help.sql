CREATE TABLE IF NOT EXISTS tbl_doctor_symptom_help_links (
 dr_id INT UNSIGNED NOT NULL,
 sym_id SMALLINT NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(dr_id,sym_id),
 CONSTRAINT fk_doctor_symptom_help_link_symptom FOREIGN KEY(sym_id) REFERENCES tbl_symptoms(sym_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS tbl_doctor_symptom_help_votes (
 dr_id INT UNSIGNED NOT NULL,
 sym_id SMALLINT NOT NULL,
 respondent_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 review_status VARCHAR(24) NOT NULL DEFAULT 'active',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(dr_id,sym_id,respondent_key),
 CONSTRAINT fk_doctor_symptom_help_vote_link FOREIGN KEY(dr_id,sym_id) REFERENCES tbl_doctor_symptom_help_links(dr_id,sym_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
