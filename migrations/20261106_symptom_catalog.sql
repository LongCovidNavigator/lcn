CREATE TABLE IF NOT EXISTS tbl_symptom_category_votes (
 sym_id INT NOT NULL,
 voter_key CHAR(64) NOT NULL,
 category_snapshot VARCHAR(255) NOT NULL,
 vote ENUM('confirm','disagree') NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY(sym_id,voter_key), KEY(updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS tbl_symptom_requests (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 sym_id INT NULL,
 name VARCHAR(100) NOT NULL,
 category VARCHAR(255) NOT NULL DEFAULT '',
 category_snapshot VARCHAR(255) NOT NULL DEFAULT '',
 reason VARCHAR(2000) NOT NULL DEFAULT '',
 voter_key CHAR(64) NOT NULL,
 status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
 reviewed_by VARCHAR(100) NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at TIMESTAMP NULL,
 KEY(status,id), KEY(voter_key,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
