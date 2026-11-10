# NotifyHub

An original MERN team dashboard with task tracking, role-based access, analytics, and real-time notifications.

## Requirements

- Node.js 20 or newer
- MongoDB (local or hosted)

## Setup

1. Install dependencies from the repository root:

   ```sh
   npm install
   npm run install:all
   ```

2. Copy `server/.env.example` to `server/.env` and set the values described below.
3. Copy `client/.env.example` to `client/.env` if the API is not running at its local default.
4. Create the first administrator:

   ```sh
   npm run seed:admin --workspace=server
   ```

   Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `server/.env` first. The seed command refuses to overwrite an existing account.
5. Start the API and web app:

   ```sh
   npm run dev
   ```

   Open the Vite URL printed in the terminal.

## Environment values

| Variable | Where | Purpose |
| --- | --- | --- |
| `PORT` | server | HTTP and WebSocket port |
| `MONGODB_URI` | server | MongoDB connection string |
| `JWT_SECRET` | server | Random secret used to sign login tokens |
| `CLIENT_ORIGIN` | server | Exact browser origin allowed by CORS |
| `NODE_ENV` | server | Use `development` locally and `production` when deployed |
| `SEED_ADMIN_EMAIL` | server | Email for the one-time administrator setup |
| `SEED_ADMIN_PASSWORD` | server | Strong password for the one-time administrator setup |
| `BREVO_API_KEY` | server | Brevo transactional email API key |
| `EMAIL_FROM` | server | Verified sender email address in Brevo |
| `EMAIL_FROM_NAME` | server | Sender display name (optional; defaults to `NotifyHub`) |
| `VITE_API_URL` | client | API base URL; blank uses the local Vite proxy |
| `VITE_SOCKET_URL` | client | WebSocket origin; blank uses the current host |

Keep actual `.env` files private. Never publish `JWT_SECRET`, database credentials, or the administrator password.

Configure both `BREVO_API_KEY` and `EMAIL_FROM` in the API service to enable task emails. The sender must be verified in Brevo. Task creators can choose an email on creation, one day before the due date, at the due date, or no email. The API stores scheduled emails in MongoDB, checks the queue every 30 seconds, and retries transient failures up to five times.

## Roles

- **Admin:** view and manage all tasks, assign tasks, and use team-wide analytics.
- **Member:** manage only their own tasks and receive their own notifications.

Newly registered users are always members. Role assignment is never accepted from the registration request.

## Scripts

- `npm run dev` — start the API and Vite development server
- `npm run build` — build the web client
- `npm run lint` — lint the client
- `npm test` — run API tests

The API listens on `/api`; Vite proxies local `/api` and `/socket.io` traffic to it.
