-- Additive, repeatable feedback V1 schema. No existing catalog tables are changed.
CREATE TABLE IF NOT EXISTS tbl_feedback_ideas (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 title VARCHAR(180) NOT NULL, description TEXT NOT NULL, category VARCHAR(32) NOT NULL,
 status VARCHAR(24) NOT NULL DEFAULT 'open', moderation VARCHAR(16) NOT NULL DEFAULT 'pending',
 display_name VARCHAR(80) NULL, email VARCHAR(254) NULL,
 entity_type VARCHAR(20) NULL, entity_id INT UNSIGNED NULL,
 team_reply TEXT NULL, merged_into BIGINT UNSIGNED NULL, seed_key VARCHAR(64) NULL UNIQUE,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX listing(moderation,status,category,created_at),
 FOREIGN KEY(merged_into) REFERENCES tbl_feedback_ideas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS tbl_feedback_votes (
 idea_id BIGINT UNSIGNED NOT NULL, voter_key CHAR(64) NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(idea_id,voter_key), FOREIGN KEY(idea_id) REFERENCES tbl_feedback_ideas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS tbl_feedback_comments (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, idea_id BIGINT UNSIGNED NOT NULL,
 body TEXT NOT NULL, display_name VARCHAR(80) NULL, moderation VARCHAR(16) NOT NULL DEFAULT 'pending',
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX listing(idea_id,moderation,created_at), FOREIGN KEY(idea_id) REFERENCES tbl_feedback_ideas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS tbl_feedback_reports (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, category VARCHAR(32) NOT NULL, body TEXT NOT NULL,
 email VARCHAR(254) NULL, page_path VARCHAR(500) NULL, entity_type VARCHAR(20) NULL, entity_id INT UNSIGNED NULL,
 status VARCHAR(16) NOT NULL DEFAULT 'open', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX queue(status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS tbl_feedback_history (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, idea_id BIGINT UNSIGNED NOT NULL,
 event_type VARCHAR(24) NOT NULL, old_value VARCHAR(32) NULL, new_value VARCHAR(32) NULL,
 reason TEXT NULL, admin_name VARCHAR(120) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX listing(idea_id,created_at), FOREIGN KEY(idea_id) REFERENCES tbl_feedback_ideas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS tbl_feedback_limits (
 bucket_key CHAR(64) PRIMARY KEY, hits INT UNSIGNED NOT NULL, expires_at DATETIME NOT NULL,
 INDEX expiry(expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
