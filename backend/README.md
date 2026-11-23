# DTS login API

The API connects the frontend to the existing MySQL schema. Login, session restoration, and logout use an HttpOnly cookie. Passwords are checked with bcrypt; the API never returns `password_hash`.

## Local setup

1. Copy `.env.example` to `.env` and set the MySQL connection, a random `JWT_ACCESS_SECRET` (at least 32 random bytes), and `ADMIN_INITIAL_PASSWORD`.
2. Confirm the configured database already contains the project schema. Do not run a SQL file containing `DROP DATABASE` against a database with data.
3. From this directory, run `npm install`, then `npm run create-admin`. The seed only creates the configured active admin if it is missing, or adds a bcrypt hash if its password hash is empty. It does not replace an existing password hash unless you explicitly pass `npm run create-admin -- --reset-password`.
4. Run `npm run dev`. The Vite development server proxies `/api` to `http://127.0.0.1:3000`.

The local admin email is `admin@dts.com`; its password is the value of `ADMIN_INITIAL_PASSWORD` in `.env`. Use a strong password and never reuse a demo password outside local development.

To rotate the local admin password, change `ADMIN_INITIAL_PASSWORD` in `.env` and run `npm run create-admin -- --reset-password`.

The login endpoints are `POST /api/auth/login`, `GET /api/auth/me`, and `POST /api/auth/logout`.

## Database records

After login, an `ADMIN` can browse all base tables at `/app/admin`. The database API uses the live schema to provide paginated reads and create, update, and delete operations:

- `GET /api/admin/tables` returns table metadata and row counts.
- `GET /api/admin/tables/:table/records` lists records; `limit` is capped at 100 and `offset` is zero-based.
- `POST /api/admin/tables/:table/records` accepts `{ "values": { ... } }`.
- `PUT /api/admin/tables/:table/records` accepts `{ "keys": { ...primary-key fields }, "values": { ...changed fields } }`.
- `DELETE /api/admin/tables/:table/records` accepts `{ "keys": { ...primary-key fields } }`.

Table names and columns are resolved from the configured database schema, and all values are parameterized. `password_hash` is excluded from reads and writes. Foreign-key and unique-constraint errors are returned as actionable client errors. The current schema already contains sample records; do not rerun its destructive database-reset statement or insert a second seed set.
