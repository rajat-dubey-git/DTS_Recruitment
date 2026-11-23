/* DTS Recruitment - additive database enhancements
   Target: MySQL 8.0.16+
   Review and back up the database before applying.
   Existing users.role ENUM is retained for the initial four fixed roles.
*/
USE dts_recruitment;

CREATE TABLE user_invitations (
  invitation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  accepted_at DATETIME NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (invitation_id),
  UNIQUE KEY uq_user_invitations_token (token_hash),
  KEY ix_user_invitations_user_expiry (user_id, expires_at),
  CONSTRAINT fk_user_invitations_user FOREIGN KEY (user_id) REFERENCES users(user_id),
  CONSTRAINT fk_user_invitations_creator FOREIGN KEY (created_by) REFERENCES users(user_id),
  CONSTRAINT ck_user_invitations_expiry CHECK (expires_at > created_at)
) ENGINE=InnoDB;

CREATE TABLE password_reset_tokens (
  reset_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (reset_id),
  UNIQUE KEY uq_password_reset_token (token_hash),
  KEY ix_password_reset_user_expiry (user_id, expires_at),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(user_id),
  CONSTRAINT ck_password_reset_expiry CHECK (expires_at > created_at)
) ENGINE=InnoDB;

CREATE TABLE user_sessions (
  session_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  refresh_token_hash CHAR(64) NOT NULL,
  device_label VARCHAR(150) NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(500) NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME NULL,
  PRIMARY KEY (session_id),
  UNIQUE KEY uq_user_sessions_token (refresh_token_hash),
  KEY ix_user_sessions_user_active (user_id, revoked_at, expires_at),
  CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(user_id),
  CONSTRAINT ck_user_sessions_expiry CHECK (expires_at > created_at)
) ENGINE=InnoDB;

CREATE TABLE application_status_history (
  history_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id INT UNSIGNED NOT NULL,
  old_status VARCHAR(20) NULL,
  new_status VARCHAR(20) NOT NULL,
  changed_by INT UNSIGNED NULL,
  change_reason VARCHAR(500) NULL,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (history_id),
  KEY ix_app_status_history_app_date (application_id, changed_at),
  KEY ix_app_status_history_actor (changed_by),
  CONSTRAINT fk_app_status_history_application FOREIGN KEY (application_id) REFERENCES applications(application_id),
  CONSTRAINT fk_app_status_history_user FOREIGN KEY (changed_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  audit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id INT UNSIGNED NULL,
  action_code VARCHAR(80) NOT NULL,
  entity_name VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80) NULL,
  old_values JSON NULL,
  new_values JSON NULL,
  ip_address VARCHAR(45) NULL,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (audit_id),
  KEY ix_audit_entity (entity_name, entity_id, occurred_at),
  KEY ix_audit_actor_date (actor_user_id, occurred_at),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE notifications (
  notification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  notification_type VARCHAR(60) NOT NULL,
  title VARCHAR(180) NOT NULL,
  message VARCHAR(1000) NOT NULL,
  target_url VARCHAR(500) NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id),
  KEY ix_notifications_user_read_date (user_id, read_at, created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

/* Role consistency guards. Validate existing data before creating these triggers. */
DELIMITER $$

CREATE TRIGGER trg_customer_contacts_bi_role
BEFORE INSERT ON customer_contacts FOR EACH ROW
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = NEW.user_id AND role = 'CUSTOMER') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'customer_contacts.user_id must reference a CUSTOMER user';
  END IF;
END$$

CREATE TRIGGER trg_customer_contacts_bu_role
BEFORE UPDATE ON customer_contacts FOR EACH ROW
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = NEW.user_id AND role = 'CUSTOMER') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'customer_contacts.user_id must reference a CUSTOMER user';
  END IF;
END$$

CREATE TRIGGER trg_requirement_assignments_bi_role
BEFORE INSERT ON requirement_assignments FOR EACH ROW
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = NEW.recruiter_id AND role = 'RECRUITER' AND status = 'ACTIVE') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'requirement_assignments.recruiter_id must reference an ACTIVE RECRUITER';
  END IF;
END$$

CREATE TRIGGER trg_requirement_assignments_bu_role
BEFORE UPDATE ON requirement_assignments FOR EACH ROW
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = NEW.recruiter_id AND role = 'RECRUITER') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'requirement_assignments.recruiter_id must reference a RECRUITER';
  END IF;
END$$

DELIMITER ;

/* Application status history is best written by the application service in the
   same transaction as the status update, so actor and reason are explicit.
   Do not add an automatic trigger unless the application can reliably supply actor context. */

/* Before applying: check existing customer_contacts and requirement_assignments
   for role mismatches. Also confirm whether every customer contact has exactly
   one customer relationship and whether candidate accounts are optional. */
