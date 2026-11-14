ALTER TABLE tbl_feedback_ideas ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL, ADD COLUMN IF NOT EXISTS archive_reminded_at DATETIME NULL;

CREATE TRIGGER IF NOT EXISTS fb_ideas_archive_insert BEFORE INSERT ON tbl_feedback_ideas FOR EACH ROW
SET NEW.archived_at = IF(NEW.moderation='archived',COALESCE(NEW.archived_at,NOW()),NULL);

CREATE TRIGGER IF NOT EXISTS fb_ideas_archive_update BEFORE UPDATE ON tbl_feedback_ideas FOR EACH ROW
SET NEW.archived_at = CASE WHEN NEW.moderation<>'archived' THEN NULL WHEN OLD.moderation<>'archived' THEN NOW() ELSE COALESCE(NEW.archived_at,NOW()) END,
    NEW.archive_reminded_at = IF(NEW.moderation='archived' AND OLD.moderation='archived',NEW.archive_reminded_at,NULL);

UPDATE tbl_feedback_ideas SET archived_at=NOW() WHERE moderation='archived' AND archived_at IS NULL;

ALTER TABLE tbl_feedback_comments ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL, ADD COLUMN IF NOT EXISTS archive_reminded_at DATETIME NULL;

CREATE TRIGGER IF NOT EXISTS fb_comments_archive_insert BEFORE INSERT ON tbl_feedback_comments FOR EACH ROW
SET NEW.archived_at = IF(NEW.moderation='archived',COALESCE(NEW.archived_at,NOW()),NULL);

CREATE TRIGGER IF NOT EXISTS fb_comments_archive_update BEFORE UPDATE ON tbl_feedback_comments FOR EACH ROW
SET NEW.archived_at = CASE WHEN NEW.moderation<>'archived' THEN NULL WHEN OLD.moderation<>'archived' THEN NOW() ELSE COALESCE(NEW.archived_at,NOW()) END,
    NEW.archive_reminded_at = IF(NEW.moderation='archived' AND OLD.moderation='archived',NEW.archive_reminded_at,NULL);

UPDATE tbl_feedback_comments SET archived_at=NOW() WHERE moderation='archived' AND archived_at IS NULL;

ALTER TABLE tbl_feedback_reports ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL, ADD COLUMN IF NOT EXISTS archive_reminded_at DATETIME NULL;

CREATE TRIGGER IF NOT EXISTS fb_reports_archive_insert BEFORE INSERT ON tbl_feedback_reports FOR EACH ROW
SET NEW.archived_at = IF(NEW.status='archived',COALESCE(NEW.archived_at,NOW()),NULL);

CREATE TRIGGER IF NOT EXISTS fb_reports_archive_update BEFORE UPDATE ON tbl_feedback_reports FOR EACH ROW
SET NEW.archived_at = CASE WHEN NEW.status<>'archived' THEN NULL WHEN OLD.status<>'archived' THEN NOW() ELSE COALESCE(NEW.archived_at,NOW()) END,
    NEW.archive_reminded_at = IF(NEW.status='archived' AND OLD.status='archived',NEW.archive_reminded_at,NULL);

UPDATE tbl_feedback_reports SET archived_at=NOW() WHERE status='archived' AND archived_at IS NULL;

UPDATE tbl_feedback_ideas SET moderation='archived' WHERE merged_into IS NOT NULL AND moderation<>'archived';
