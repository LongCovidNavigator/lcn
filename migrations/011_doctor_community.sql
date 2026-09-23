-- Independent of legacy pro/neutral/contra ratings. All options are one-based.
CREATE TABLE IF NOT EXISTS doctor_community_options (
    question_key VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    context_key VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
    option_value TINYINT UNSIGNED NOT NULL,
    label VARCHAR(160) NOT NULL,
    PRIMARY KEY (question_key, context_key, option_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS doctor_community_answers (
    dr_id INT UNSIGNED NOT NULL,
    respondent_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    question_key VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    context_key VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
    option_value TINYINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (dr_id, respondent_key, question_key, context_key),
    KEY idx_community_aggregate (dr_id, question_key, context_key, option_value),
    CONSTRAINT fk_community_answer_option FOREIGN KEY (question_key, context_key, option_value)
        REFERENCES doctor_community_options (question_key, context_key, option_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS doctor_community_dummy_answers (
    dr_id INT UNSIGNED NOT NULL,
    respondent_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    question_key VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    context_key VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
    option_value TINYINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (dr_id, respondent_key, question_key, context_key),
    KEY idx_community_dummy_aggregate (dr_id, question_key, context_key, option_value),
    CONSTRAINT fk_community_dummy_option FOREIGN KEY (question_key, context_key, option_value)
        REFERENCES doctor_community_options (question_key, context_key, option_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
