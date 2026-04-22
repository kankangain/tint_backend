# Backend Documentation (backend)

Express API for the PRABUDDHA 2026 platform.

## Stack

- Node.js + Express
- MySQL (`mysql2/promise`)
- JWT (`jsonwebtoken`)
- Password hashing (`bcryptjs`)
- SMTP email (`nodemailer`)
- File upload (`multer`)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `backend/.env`:

```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=prabuddha_2026
DB_PORT=3306

JWT_SECRET=replace_with_strong_secret

ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin_password
ADMIN_PASSWORD_HASH=

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
EMAIL_FROM=no-reply@example.com
ADMIN_NOTIFICATION_EMAIL=admin@example.com
```

3. Import database schema:

```bash
mysql -u root -p < schema.sql
```

4. Run server:

```bash
npm run dev
```

Server URL: `http://localhost:5000`

## Scripts

- `npm run start` run with Node
- `npm run dev` run with nodemon

## Core Middleware and Validation

- CORS enabled globally
- JSON and URL-encoded body parsing
- `validateUserInput` for user create/update
- `validateQueryInput` for query create
- `authenticateAdmin` for protected admin endpoints

## Authentication

### User Login

- `POST /auth/login`
- checks user email/password hash
- returns JWT token (expires in 4 hours)

### Admin Login

- `POST /admin/login`
- validates admin credentials from environment
- returns JWT token (expires in 1 hour)
- sends login alert email

Protected admin routes require header:

```http
Authorization: Bearer <token>
```

## File Upload

- Endpoint: `POST /upload/id-card`
- Form field: `file`
- Allowed extensions: `.pdf`, `.png`, `.jpg`, `.jpeg`
- Max size: 5 MB
- Static serving: `/uploads/<filename>`

## API Routes

### Health

- `GET /api/health`

### Users

- `GET /users` (supports pagination via `page`, `limit`)
- `GET /users/:id`
- `POST /users`
- `PUT /users/:id`
- `DELETE /users/:id`

`POST /users` expects at least:

- `name`
- `email`
- `phone`
- `college`
- `year`
- `password`
- optional `role`
- optional `id_card_url`

### Events

- `GET /events`
- `GET /events/users/:id`
- `GET /events/list/categories`
- `POST /events/create`
- `PUT /events/:id`
- `DELETE /events/:id`

`GET /events` supports query params:

- `category`
- `term`
- `fromDate`
- `toDate`
- `sort` (`date_asc`, `date_desc`)

### Registrations

- `GET /reg/user/:userId`
- `GET /reg/event/:eventId`
- `POST /reg/user`
- `PUT /reg/:id`
- `DELETE /reg/:id`

`POST /reg/user` body:

- `user_id`
- `event_id`

Behavior:

- validates user and event existence
- blocks duplicate registrations
- sends confirmation email

### Admin Dashboard

- `GET /admin/dashboard/stats` (protected)
- `GET /admin/dashboard/recent` (protected)
- `GET /admin/registrations/all` (protected)

### Queries and FAQ

- `GET /query/all` (optional `status` filter)
- `GET /query/:id`
- `POST /query`
- `PUT /query/:id/respond`
- `PUT /query/:id/status`
- `GET /query/faq/all`

`PUT /query/:id/respond`:

- updates status to `resolved`
- stores `admin_response`
- sends email response to query submitter

## Database Overview

Primary tables from `schema.sql`:

- `users`
- `events`
- `registrations`
- `queries`
- `faq_categories`
- `faq`
- `roles`
- `admin_users`

Indexes are included for common filter fields such as event category/date, registration foreign keys, user email, and query status/email.
