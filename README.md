# Archive & Document Management System (MERN)

A starter DMS built with MongoDB, Express, React + Vite, and Node.js.

## Features
- JWT authentication and bcrypt password hashing
- Admin can create users
- Incoming (IN) and Outgoing (OUT) document registration
- PDF, DOC, DOCX, XLS, XLSX, JPG, PNG uploads
- Search and status filtering
- Archive/unarchive documents
- Dashboard summary
- Incoming (IN) and Outgoing (OUT) reports, each Daily / Monthly / Annual, with totals, register table, Print and CSV export (`GET /api/documents/reports?direction=IN|OUT&period=daily|monthly|annual&date=YYYY-MM-DD | year=YYYY&month=M`)
- Protected API routes

## Requirements
- Node.js 20+
- MongoDB Atlas account or local MongoDB
- npm

## 1. Configure backend
Open a terminal in `backend` and run:
```bash
npm install
```
Copy `.env.example` to `.env`, then set `MONGO_URI` and a strong `JWT_SECRET`.

Create the first admin:
```bash
npm run seed:admin
```
The seed command reads `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` from `.env`.

Start backend:
```bash
npm run dev
```
API runs at `http://localhost:8000`; health check: `http://localhost:8000/api/health`.

## 2. Configure frontend
Open a second terminal in `frontend`:
```bash
npm install
```
Copy `.env.example` to `.env`, then run:
```bash
npm run dev
```
Open the Vite URL shown in terminal (normally `http://localhost:5173`).

## Important security notes
- Do not commit `.env` files or uploaded documents to Git.
- Uploaded files are stored in `backend/storage` and are downloaded through an authenticated API route.
- For production, use private object storage, HTTPS, rate limiting, malware scanning, backups, and a formal document-retention policy.
- This starter uses local disk storage. Do not expose the `storage` directory as a public static folder.


## Document permissions

- **Admin:** can create, read, update, archive/restore, download, and delete documents.
- **Staff/user:** can create, read, update, archive/restore, and download documents; the Delete control is hidden in the interface and the API also blocks deletion for non-admin users.

The backend enforces deletion permissions using the authenticated user role, so hiding the button is not the only protection.


## Latest access and branding updates
- Admin users can permanently delete former staff accounts from User Management.
- The API protects deletion with administrator authorization and prevents self-deletion and deletion of the last active administrator.
- User deletion is recorded in the audit log.
- Staff users retain Create, Read, and Update document access; document deletion remains admin-only.
- Primary interface accent updated to #0E84B3.
- Login page includes Somalia flag styling and Ministry of Communications and Technology bilingual identity. The ministry mark is a neutral building icon, not an official ministry seal; replace it with the official logo asset if supplied.

## Monthly and annual reports (V4)

The Reports page is available from the authenticated workspace navigation. It supports monthly and annual summaries, including total, incoming, outgoing, pending, processing, completed, and archived documents. The timeline is grouped by day for monthly reports and by month for annual reports. Reports can be printed or exported as CSV.

Report figures are calculated using each record's `documentDate` field. The report API is `GET /api/documents/reports?type=monthly&year=2026&month=11` or `GET /api/documents/reports?type=yearly&year=2026` and requires a signed-in user.
