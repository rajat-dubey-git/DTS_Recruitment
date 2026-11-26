/* Additive migration for permanent portal-account deletion and selected-candidate billing.
   Run once after database_migration_phase1_to_phase3.sql on a backed-up database.
   No requirement, agreement, service-order, or invoice numbers are generated or changed. */

USE dts_recruitment;

-- Keep customer contact and recruiter assignment history while allowing the account
-- reference to be removed.
ALTER TABLE customer_contacts
  DROP FOREIGN KEY fk_customer_contacts_user,
  MODIFY COLUMN user_id INT UNSIGNED NULL,
  ADD CONSTRAINT fk_customer_contacts_user
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE SET NULL;

ALTER TABLE requirement_assignments
  DROP FOREIGN KEY fk_requirement_assignments_rec,
  MODIFY COLUMN recruiter_id INT UNSIGNED NULL,
  ADD CONSTRAINT fk_requirement_assignments_rec
    FOREIGN KEY (recruiter_id) REFERENCES users (user_id) ON DELETE SET NULL;

ALTER TABLE candidates
  DROP FOREIGN KEY fk_candidates_user,
  ADD CONSTRAINT fk_candidates_user
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE SET NULL;

ALTER TABLE customer_candidate_decisions
  DROP FOREIGN KEY fk_customer_candidate_decisions_user,
  MODIFY COLUMN decided_by INT UNSIGNED NULL,
  ADD CONSTRAINT fk_customer_candidate_decisions_user
    FOREIGN KEY (decided_by) REFERENCES users (user_id) ON DELETE SET NULL;

-- Retain approval/verification timestamps after the actor account is deleted.
ALTER TABLE service_orders
  DROP CHECK ck_service_orders_approval,
  ADD CONSTRAINT ck_service_orders_approval
    CHECK (approved_by IS NULL OR approved_at IS NOT NULL);

ALTER TABLE job_requirements
  DROP CHECK ck_job_requirements_approval,
  ADD CONSTRAINT ck_job_requirements_approval
    CHECK (approved_by IS NULL OR approved_at IS NOT NULL);

ALTER TABLE candidate_documents
  DROP CHECK ck_candidate_documents_verified,
  ADD CONSTRAINT ck_candidate_documents_verified
    CHECK (verified_by IS NULL OR verified_at IS NOT NULL);

ALTER TABLE agreement_versions
  DROP CHECK ck_agreement_versions_activation,
  ADD CONSTRAINT ck_agreement_versions_activation
    CHECK (activated_by IS NULL OR activated_at IS NOT NULL);

-- Make existing selected applications invoiceable through the normal placement model.
INSERT INTO selections (application_id, selected_by, selected_at, notes)
SELECT a.application_id, NULL, a.applied_at, 'Selection record backfilled from selected application'
FROM applications a
LEFT JOIN selections existing_selection ON existing_selection.application_id = a.application_id
WHERE a.status = 'SELECTED' AND existing_selection.selection_id IS NULL;

INSERT INTO placements (selection_id, outcome)
SELECT s.selection_id, 'PENDING'
FROM selections s
INNER JOIN applications a ON a.application_id = s.application_id
LEFT JOIN placements existing_placement ON existing_placement.selection_id = s.selection_id
WHERE a.status = 'SELECTED' AND existing_placement.placement_id IS NULL;
