# Tint Backend Documentation

## Overview

This backend is an Express API for the PRABUDDHA 2026 event platform. It provides endpoints for user management, event management, registrations, admin dashboard access, query submission, and FAQ retrieval.

## Environment Variables

Required environment variables:

- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_PORT`
- `PORT`
- `NODE_ENV`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`
- `ADMIN_NOTIFICATION_EMAIL`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_PASSWORD_HASH`
- `JWT_SECRET`

## Database

The server uses a MySQL connection pool with `mysql2/promise`.

## Email

Nodemailer is configured using SMTP environment variables. The server sends:

- registration confirmation emails after `POST /reg/user`
- admin login notifications after `POST /admin/login`

## Middleware and Validation

- `validateEmail(email)` checks email format.
- `validatePhone(phone)` checks phone format for Indian mobile numbers (`6-9` prefix, 10 digits).
- `validateUserInput(req, res, next)` validates name, email, phone, college, and year for user signup/update.
- `validateQueryInput(req, res, next)` validates query submission data.
- `authenticateAdmin(req, res, next)` checks for a Bearer JWT token and verifies it using `JWT_SECRET`.

## Auth

- Admin login is handled by `POST /admin/login`.
- It validates `ADMIN_USERNAME` and password hashing stored in `ADMIN_PASSWORD_HASH`.
- If `ADMIN_PASSWORD_HASH` is not provided, the server can hash `ADMIN_PASSWORD` at startup.
- A JWT token is returned on successful login.

## Routes

### User Routes

- `GET /users`
  - Returns paginated users.
  - Query params: `page`, `limit`.

- `GET /users/:id`
  - Returns a single user by ID.

- `POST /users`
  - Creates a new user.
  - Body:
    - `name`
    - `email`
    - `phone`
    - `college`
    - `year`

- `PUT /users/:id`
  - Updates an existing user.
  - Body: same as `POST /users`.

- `DELETE /users/:id`
  - Deletes a user by ID.

### Event Routes

- `GET /events`
  - Returns all events.
  - Optional query param: `category`.

- `GET /events/users/:id`
  - Returns a single event by ID.

- `GET /events/list/categories`
  - Returns distinct event categories.

- `POST /events/create`
  - Creates a new event.
  - Body:
    - `title`
    - `category`
    - `description`
    - `date`
    - `time`
    - `venue`
    - `max_participants`
    - `registration_fee`
    - `image_url`

- `PUT /events/:id`
  - Updates an existing event.
  - Body: same as `POST /events/create`.

- `DELETE /events/:id`
  - Deletes an event by ID.

### Registration Routes

- `GET /reg/user/:userId`
  - Returns registration details for a specific user.

- `GET /reg/event/:eventId`
  - Returns registration details for a specific event.

- `POST /reg/user`
  - Creates a new registration.
  - Body:
    - `user_id`
    - `event_id`
  - Sends confirmation email to the user after registration.

- `PUT /reg/:id`
  - Updates registration status.
  - Body:
    - `status` (`confirmed`, `pending`, `cancelled`)

- `DELETE /reg/:id`
  - Deletes a registration by ID.

### Admin Routes

- `POST /admin/login`
  - Admin authentication.
  - Body:
    - `username`
    - `password`
  - Returns a JWT token on success.
  - Sends a login notification email.

- `GET /admin/dashboard/stats`
  - Requires Bearer JWT token.
  - Returns counts for users, events, registrations, and queries.

- `GET /admin/dashboard/recent`
  - Requires Bearer JWT token.
  - Returns recent users, registrations, and queries.

- `GET /admin/registrations/all`
  - Requires Bearer JWT token.
  - Returns all registrations with user and event details.

### Query Routes

- `GET /query/all`
  - Returns all queries.
  - Optional query param: `status` (`new`, `in-progress`, `resolved`).

- `GET /query/:id`
  - Returns a specific query by ID.

- `POST /query`
  - Submits a new query.
  - Body:
    - `name`
    - `email`
    - `phone`
    - `subject`
    - `message`

- `PUT /query/:id/respond`
  - Marks a query as resolved and sets `admin_response`.
  - Body:
    - `admin_response`

- `PUT /query/:id/status`
  - Updates the query status.
  - Body:
    - `status` (`new`, `in-progress`, `resolved`)

- `GET /query/faq/all`
  - Returns all FAQ entries.

### Health Check

- `GET /api/health`
  - Returns basic server status.

## Notes

- `authenticateAdmin` is used on admin-only routes to protect access.
- The server uses `nodemailer` to send emails from the configured SMTP account.
- JWT tokens expire in 1 hour.
- If `ADMIN_PASSWORD_HASH` is empty, `ADMIN_PASSWORD` is hashed at startup.

## Example Authorization

Header:

```
Authorization: Bearer <token>
```
