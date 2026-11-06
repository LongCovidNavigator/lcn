CREATE TABLE IF NOT EXISTS tbl_feedback_images (
 id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 owner_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 idea_id BIGINT UNSIGNED NULL,
 mime_type VARCHAR(32) NOT NULL,
 image_data MEDIUMBLOB NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY one_image_per_idea (idea_id),
 KEY draft_cleanup (idea_id,created_at),
 CONSTRAINT fk_feedback_image_idea FOREIGN KEY (idea_id) REFERENCES tbl_feedback_ideas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
