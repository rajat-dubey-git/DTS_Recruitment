
# DTS Recruitment & Staffing Platform

A recruitment and staffing management platform for managing customers, users, job profiles, hiring requirements, candidate pipelines, interviews, placements and commercial operations.

## Technology Stack

### Frontend
- React 18
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Axios
- React Hook Form
- Zod

### Backend
- Node.js
- Express
- MySQL2
- JWT
- bcrypt
- HttpOnly cookie-based authentication

### Database
- MySQL 8.0.16+
- InnoDB
- UTF-8 (`utf8mb4`)

## Project Structure

```text
DTS-Recruitment/
├── backend/
├── src/
├── database command and value.txt
├── database_additive_migration.sql
├── README.md
└── INSTRUCTIONS.md
```

## Prerequisites

- Node.js 20+
- npm
- MySQL 8.0.16+
- Git

## Local Setup

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd DTS-Recruitment
```

### 2. Configure MySQL

Create and configure the `dts_recruitment` database using the approved SQL setup.

Do not rerun the complete database seed script against an existing database.

### 3. Configure the backend

```bash
cd backend
npm install
```

Copy `.env.example` to `.env` and configure the database connection, JWT secret and administrator bootstrap credentials.

### 4. Initialize the administrator

```bash
npm run create-admin
```

### 5. Start the backend

```bash
npm run dev
```

The API runs at:

```text
http://127.0.0.1:3000
```

### 6. Start the frontend

Open a second terminal:

```bash
npm install
npm run dev
```

Open the Vite URL displayed in the terminal.

## Authentication

The application uses backend-managed authentication.

- Passwords are hashed using bcrypt.
- JWT access tokens are stored in HttpOnly cookies.
- The backend validates user status and role.
- Passwords and password hashes must never be exposed to the frontend.

Recruiter and customer-contact invitations use one-time setup links. Configure SMTP to deliver links; development can display links for manual sharing if SMTP is absent. Production refuses email-link creation without SMTP. Password reset and OTP authentication are not implemented.

## API

Current authentication endpoints:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Role-scoped dashboard analytics:

- `GET /api/dashboard/analytics` (requires an active authenticated user; data scope is derived from the user's ADMIN, CUSTOMER, RECRUITER, or CANDIDATE role)

Admin endpoints (all require an active ADMIN session):

- `GET /api/admin/dashboard`
- `GET /api/admin/customers`
- `GET /api/admin/customer-addresses`
- `GET /api/admin/customer-contacts`
- `GET /api/admin/recruiters`
- `GET /api/admin/users`
- `GET /api/admin/skills`
- `GET /api/admin/service-types`
- `GET /api/admin/job-profiles`
- `GET /api/admin/agreements`
- `GET /api/admin/rate-cards`
- `GET /api/admin/service-orders`
- `GET /api/admin/requirements`
- `GET /api/admin/requirements/options`
- `POST /api/admin/requirements`
- `GET /api/admin/requirement-intakes`
- `POST /api/admin/customers/:customerId/requirement-intakes`
- `POST /api/admin/requirement-intakes/:intakeId/convert`
- `POST /api/admin/service-orders/:serviceOrderId/approve`
- `POST /api/admin/users/invitations`
- `POST /api/auth/invitations/accept` (public, rate-limited, one-time token)
- `GET /api/public/requirement-intakes/:token` and `POST` (public, rate-limited, expiring one-time form)

Allowlisted create endpoints are available for customers, skills, service types, job profiles, agreements, rate cards and service orders. Admins can create requirements only against an approved/in-progress service order and active job profile; they start at `PENDING_APPROVAL`. List endpoints accept `limit`, `offset` and `search`. Responses contain only fields needed by these modules. Arbitrary database-table read/write endpoints were removed.

## Development Rules

1. MySQL schema is the source of truth.
2. Do not invent database fields or enum values in frontend code.
3. Validate data in the backend before database operations.
4. Use parameterized SQL queries.
5. Use transactions for multi-table business operations.
6. Never store plaintext passwords or OTPs.
7. Keep secrets in environment variables.
8. Do not commit `.env`, credentials, customer information or candidate documents.
9. Use database migrations for schema changes.
10. Protect all APIs with authentication and role-based authorization.

## Security

This project is under active development. It is not yet production-ready.

Before deployment, verify SMTP deliverability, complete password-reset workflows, add automated access-control tests and audit logging, and review production infrastructure. OTP is not implemented and must not be presented as a login option until its delivery and verification workflows are built and tested.

## Documentation

See [INSTRUCTIONS.md](INSTRUCTIONS.md) for setup, database safety, environment configuration, testing and development guidelines.
