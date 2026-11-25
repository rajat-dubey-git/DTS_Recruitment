# DTS Recruitment & Staffing Platform

Recruitment operations app with a React/TypeScript frontend, Node.js/Express API and MySQL database.

## Current working scope

- Server-backed login with bcrypt password hashes and HttpOnly JWT cookies
- Protected admin dashboard with live aggregate counts
- Database-backed creation for customers, job profiles, agreements, rate cards, service orders, skills and service types
- Recruiter and customer-contact invitations with one-time password setup by email
- Admin user directory and direct creation of requirements on approved service orders
- Customer requirement form links, submissions, admin review, and conversion to requirements linked to an active job profile and approved service order
- Admin approval of service orders against active agreements
- Customer agreement requests, draft and signed PDF workflows, and customer/admin download archives
- Candidate self-service for profile, skills, education, work history, private resumes, open requirements, applications and application history
- Recruiter-assigned requirement details, candidate matching, consent-confirmed submissions, application stage updates and interview scheduling
- Customer candidate decisions (shortlist, reject or hold) and an admin candidate/document-review workspace

Customer requirement requests are staged and do not become active recruiting requirements until an administrator maps them to the customer's approved service order and an active job profile. New requirements start at `PENDING_APPROVAL`. Candidate resume files remain private and are only shared after candidate consent plus admin verification and an external malware scan attestation. OTP login and some full edit/archive workflows are not implemented. Do not use this build as a production system until deployment controls and end-to-end testing are complete.

## Prerequisites

- Node.js 20+
- npm
- MySQL 8.0.16+

## Local setup

1. The schema and sample data are in `database command and value.txt`. It creates the database and contains multiple seed blocks; **do not run it again against an existing database**. Back up the database before any schema change.
2. Review and apply `database_additive_migration.sql` once to the existing `dts_recruitment` database. It creates the invitation, security-support, and customer requirement-intake tables. Apply `database_add_customer_candidate_decisions.sql` after confirming the base candidate-sharing tables exist. Back up the database before applying either migration. See [INSTRUCTIONS.md](INSTRUCTIONS.md).
3. In `backend`, copy `.env.example` to `.env`. Set the actual MySQL account password in `DB_PASSWORD`, a random JWT secret of at least 32 bytes, a private initial admin password (at least 12 characters; bcrypt accepts at most 72 UTF-8 bytes), and SMTP settings. Never commit `.env`.
4. Create or initialize the admin password:

   ```powershell
   cd backend
   npm install
   npm run create-admin
   ```

5. Start the API in the `backend` directory:

   ```powershell
   npm run dev
   ```

6. In a second terminal at the project root:

   ```powershell
   npm install
   npm run dev
   ```

7. Sign in with the `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD` configured in the local backend environment. There are no demo credentials.

## Private document storage

Set `PRIVATE_FILE_STORAGE_PATH` in `backend/.env` to an absolute directory. Agreement PDFs and resume documents are stored on the server there; authorized agreement downloads are archived under `Admin_Downloads` or `Customer_Downloads`. For security, an in-repository path is accepted only when its root folder is named `DTS_Private_Storage`, which is ignored by Git.

The browser download is saved using the user's normal browser download settings; a web page cannot choose an arbitrary directory on the user's computer. The server-side archive is the copy placed in the configured private-storage folders.

Candidate resumes uploaded through the portal remain pending until an administrator reviews the document after using an approved external malware scanner. This application does not scan files itself. Only verified, clean documents can be previewed/shared through the authorized recruiter and customer workflows.

## Database and account passwords

`users.password_hash` being `NULL` is expected for an account that has not completed password setup. The invited user chooses a password through the one-time invitation link; the backend stores only a bcrypt hash. An active admin with no hash can be initialized with `npm run create-admin`. Existing passwordless recruiter and customer-contact accounts can be invited from their admin modules. `DB_PASSWORD` is different: it is the password for the MySQL connection account and must match that account's credentials.

An admin can find portal accounts under **Users**, invite recruiters there, and invite customer contacts from the related company under **Customers**. The account holder opens the one-time setup link, chooses a password (at least 12 characters), and then signs in with their invited email and password. Admins do not set or view users' passwords. In development without SMTP, share the displayed link manually; production requires SMTP delivery.

Password login is implemented. Email/SMS OTP login is not available; it requires a delivery provider and a separate verified, rate-limited one-time-code workflow.

## Email setup

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `MAIL_FROM` in the private `backend/.env`. Use the credentials and sender address provided by your organization's mail administrator. Set `SMTP_SECURE=true` only when your provider requires implicit TLS (commonly port 465); port 587 commonly uses `false` with STARTTLS. Never put real mail credentials in Git or chat.

With SMTP configured, user invitations and customer requirement links are emailed. In development only, when SMTP is not configured, the UI displays a one-time link for manual sharing. Production refuses to create these email-based links without SMTP. Customer forms expire after 72 hours and their submissions wait for admin review; they are not published or assigned to recruiters automatically.

Admins can also add a requirement directly from **Requirements** by selecting an active job profile and an approved/in-progress customer service order. Directly created requirements start at `PENDING_APPROVAL`; this does not approve or publish them. Customer contacts can submit through the separate **Request requirement** link on a customer record, after which an admin reviews and converts the submitted request.

## Validation

```powershell
npm run build
cd backend
npm run check
```

For detailed setup, migration safety, and troubleshooting steps, see [INSTRUCTIONS.md](INSTRUCTIONS.md).
