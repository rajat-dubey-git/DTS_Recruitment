/* Add customer decision history for shared candidate profiles.
   Back up the database and verify the referenced tables exist before applying. */
USE dts_recruitment;

CREATE TABLE IF NOT EXISTS customer_candidate_decisions (
  decision_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  share_id INT UNSIGNED NOT NULL,
  customer_id INT UNSIGNED NOT NULL,
  decided_by INT UNSIGNED NOT NULL,
  decision ENUM('SHORTLIST','REJECT','HOLD') NOT NULL,
  notes VARCHAR(1000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (decision_id),
  KEY ix_customer_candidate_decisions_share (share_id, decision_id),
  KEY ix_customer_candidate_decisions_customer (customer_id, created_at),
  CONSTRAINT fk_customer_candidate_decisions_share
    FOREIGN KEY (share_id) REFERENCES resume_shares (share_id),
  CONSTRAINT fk_customer_candidate_decisions_customer
    FOREIGN KEY (customer_id) REFERENCES customers (customer_id),
  CONSTRAINT fk_customer_candidate_decisions_user
    FOREIGN KEY (decided_by) REFERENCES users (user_id)
) ENGINE=InnoDB;
