-- Optional public page reference for ideas. Existing content is untouched.
CREATE TABLE IF NOT EXISTS tbl_feedback_page_references (
 idea_id BIGINT UNSIGNED PRIMARY KEY,
 page_path VARCHAR(500) NOT NULL,
 section_label VARCHAR(180) NULL,
 element_label VARCHAR(180) NULL,
 FOREIGN KEY(idea_id) REFERENCES tbl_feedback_ideas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

