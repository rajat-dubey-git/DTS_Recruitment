# DTS Recruitment & Staffing Platform

Recruitment operations app with a React/TypeScript frontend, Node.js/Express API and MySQL database.

## Current working scope

- Server-backed login with bcrypt password hashes and HttpOnly JWT cookies
- Protected admin dashboard with live aggregate counts
- Database-backed creation for customers, job profiles, agreements, rate cards, service orders, skills and service types
- Recruiter and customer-contact invitations with one-time password setup by email
- Admin user directory and direct creation of requirements on approved service orders
- Customer requirement form links, submissions, admin review, and conversion to requirements linked to an active job profile and approved service order
- Admin agreement sample preview rendered by the same PDF generator as customer-specific agreement drafts
- Admin approval of service orders against active agreements
- Customer agreement requests, draft and signed PDF workflows, and customer/admin download archives
- Candidate self-service for profile, skills, education, work history, private resumes, open requirements, applications and application history
- Admin candidate invitations create/link the candidate profile and account transactionally; a valid candidate mobile number is required
- Recruiter-assigned requirement details, candidate matching, consent-confirmed submissions, application stage updates and interview scheduling
- Customer portal requirement submission and tracking, assigned recruiter views, customer interview schedules and active job-profile catalog
- Recruiter interview outcome updates and selected-candidate records
- Admin placement-invoice drafts for selected candidates, with manual pricing and explicit issue-to-customer workflow
- Admin user deletion that removes account access while retaining business records and clearing account references
- Customer candidate decisions (shortlist, reject or hold) and an admin candidate/document-review workspace

Customer requirement requests are staged and do not become active recruiting requirements until an administrator maps them to the customer's approved service order and an active job profile. New requirements start at `PENDING_APPROVAL`. Candidate resume files remain private and are only shared after candidate consent plus admin verification and an external malware scan attestation. OTP login and some full edit/archive workflows are not implemented. Do not use this build as a production system until deployment controls and end-to-end testing are complete.

Placement invoices are created as `DRAFT` records only for selected candidates. Admins manually enter invoice number, amount, tax and dates from approved terms; issuing the invoice makes it visible to the customer. This does not implement automatic fee calculation or automatic requirement/agreement/invoice number generation.

## Prerequisites

- Node.js 20+
- npm
- MySQL 8.0.16+

## Local setup

1. Install MySQL 8.0.16+ and connect as a MySQL administrator. On a **new, empty database only**, run `database command and value.txt` once; it creates and seeds `dts_recruitment`. Do not run this seed file against an existing database.
2. After the seed finishes, replace the password placeholder in `database_shareable_setup.sql` with a unique strong password and run that script as the MySQL administrator. It creates the least-privilege app account for `127.0.0.1`.
3. Run `database_migration_phase1_to_phase3.sql` as the MySQL administrator. This is the master additive migration for the current setup, including agreement, candidate-consent, document-security, and customer-decision schema. Do not also run `database_additive_migration.sql` or `database_phase2_agreements.sql`; those overlap and are one-time scripts. For an existing installation missing only customer decision history, apply `database_add_customer_candidate_decisions.sql` instead of rerunning the master migration. Back up an existing database before any migration.
4. Run `database_migration_user_deletion_and_invoice_selection.sql` once after the master migration. It adjusts selected foreign keys so user-account removal preserves business records, and it backfills placement records for applications already marked `SELECTED`. Back up the database first; this is an additive, one-time migration.
5. Run `database_migration_requirement_skills.sql` to add storage for customer-requested skills. The migration is safe to rerun and does nothing if the column already exists.
6. In `backend`, copy `.env.example` to `.env`. Set `DB_HOST=127.0.0.1`, `DB_USER=dts_app`, and `DB_PASSWORD` to the same unique password used in the setup script. Also set a random JWT secret of at least 32 bytes, a private initial admin password (at least 12 characters; bcrypt accepts at most 72 UTF-8 bytes), and SMTP settings. Never commit `.env`.
7. Create or initialize the admin password:

   ```powershell
   cd backend
   npm install
   npm run create-admin
   ```

8. Start the API in the `backend` directory:

   ```powershell
   npm run dev
   ```

9. In a second terminal at the project root:

   ```powershell
   npm install
   npm run dev
   ```

10. Sign in with the `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD` configured in the local backend environment. There are no demo credentials.

## Private document storage

Set `PRIVATE_FILE_STORAGE_PATH` in `backend/.env` to an absolute directory. Agreement PDFs and resume documents are stored on the server there; authorized agreement downloads are archived under `Admin_Downloads` or `Customer_Downloads`. For security, an in-repository path is accepted only when its root folder is named `DTS_Private_Storage`, which is ignored by Git.

The browser download is saved using the user's normal browser download settings; a web page cannot choose an arbitrary directory on the user's computer. The server-side archive is the copy placed in the configured private-storage folders.

Candidate resumes uploaded through the portal remain pending until an administrator reviews the document after using an approved external malware scanner. This application does not scan files itself. Only verified, clean documents can be previewed/shared through the authorized recruiter and customer workflows.

## Database and account passwords

`users.password_hash` being `NULL` is expected for an account that has not completed password setup. The invited user chooses a password through the one-time invitation link; the backend stores only a bcrypt hash. An active admin with no hash can be initialized with `npm run create-admin`. Existing passwordless recruiter and customer-contact accounts can be invited from their admin modules. `DB_PASSWORD` is different: it is the password for the MySQL connection account and must match that account's credentials.

An admin can find portal accounts under **Users**, invite recruiters there, and invite customer contacts from either **Users** or the related company under **Customers**. When the Customer contact role is selected, choose the customer organisation to link to that login. Each contact has a separate email and password, but active contacts linked to the same organisation share the same customer-level dashboard and portal records; access is scoped to that organisation. After accepting the one-time setup link, the contact signs in with their invited email. Admins do not set or view users' passwords. In development without SMTP, share the displayed link manually; production requires SMTP delivery.

Password login is implemented. Email/SMS OTP login is not available; it requires a delivery provider and a separate verified, rate-limited one-time-code workflow.

## Email setup

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `MAIL_FROM` in the private `backend/.env`. Use the credentials and sender address provided by your organization's mail administrator. Set `SMTP_SECURE=true` only when your provider requires implicit TLS (commonly port 465); port 587 commonly uses `false` with STARTTLS. Never put real mail credentials in Git or chat.

With SMTP configured, user invitations and customer requirement links are emailed. In development only, when SMTP is not configured, the UI displays a one-time link for manual sharing. Production refuses to create these email-based links without SMTP. Customer forms expire after 72 hours and their submissions wait for admin review; they are not published or assigned to recruiters automatically.

Admins can also add a requirement directly from **Requirements** by selecting an active job profile and an approved/in-progress customer service order. Directly created requirements start at `PENDING_APPROVAL`; this does not approve or publish them. Customer contacts can submit through the customer portal's **My Requirements** page or the separate **Request requirement** link on a customer record. Submitted customer requests appear in the **Requirements** module for review and conversion to an internal requirement.

Recruiter movement of an application to `SELECTED` records a selection and pending placement. Admins can create a manual placement-fee draft for that selection. The invoice is private until explicitly issued; customers can then view/download it from **Invoices**. Fees and taxes must be entered from client-approved terms; no automatic rate-card calculation is applied.

Admins can permanently delete a portal account from **Users**. Account-only invitation/session/reset/notification rows are removed; business records and audit history are retained with deleted-user actor references cleared. The current admin cannot delete their own account, and the last active admin cannot be deleted.

## Validation

```powershell
npm run build
cd backend
npm run check
npm test
```

For detailed setup, migration safety, and troubleshooting steps, see [INSTRUCTIONS.md](INSTRUCTIONS.md).
