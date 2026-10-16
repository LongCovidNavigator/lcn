CREATE TABLE IF NOT EXISTS tbl_treatment_dummy_counts_nd (
 treat_nd_id INT UNSIGNED NOT NULL,
 question_key VARCHAR(48) NOT NULL,
 option_index TINYINT UNSIGNED NOT NULL,
 answer_count INT UNSIGNED NOT NULL,
 PRIMARY KEY(treat_nd_id,question_key,option_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
