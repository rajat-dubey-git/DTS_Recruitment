/* One-time upgrade for databases that already applied the agreement schema
   before typed-name electronic signatures were added.
   Do not run this after a fresh install of the updated master migration.
*/
USE dts_recruitment;

ALTER TABLE agreement_versions
  ADD COLUMN customer_signature_name VARCHAR(200) NULL AFTER customer_signed_by,
  ADD COLUMN customer_signature_method ENUM('TYPED_NAME', 'UPLOADED_PDF') NULL AFTER customer_signature_name;
