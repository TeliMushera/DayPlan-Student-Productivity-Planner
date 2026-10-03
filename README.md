# DayPlan

**A calmer space to plan your tasks, schedule, and everyday progress.**

DayPlan is a dark-themed daily planner for keeping tasks, classes, events, and personal learning notes together. Review what is on for today, see what is coming up, and look back at the work you have completed.

## Features

- **Daily dashboard** — review today's tasks and schedule, overdue work, upcoming activities, and task-completion progress.
- **Task management** — create and edit tasks with due dates and times, priority, status, categories, estimates, reminders, descriptions, and subtasks.
- **Schedule and calendar** — plan classes, labs, study sessions, meetings, exams, and personal events. Activities can repeat daily, on weekdays, weekly, or on selected days.
- **Completion history and learning notes** — mark tasks and activities complete, record what you learned, capture important points or questions, and keep follow-up notes.
- **Reminders and preferences** — choose a default reminder and control task, class, event, daily-summary, and overdue notifications.
- **Responsive dark interface** — use the same planner on desktop and mobile.

## Tech stack

- **Client:** React, TypeScript, Vite, and Tailwind CSS
- **Server:** Node.js and Express
- **Database:** MongoDB

## Getting started

### Requirements

- Node.js **22.x** (the required version is recorded in `.node-version`)
- npm
- A MongoDB database. A MongoDB Atlas cluster works; a local MongoDB server also works.

### 1. Configure MongoDB

Copy the example environment file and add your MongoDB connection string:

```powershell
Copy-Item server/.env.example server/.env
```

Edit `server/.env`:

```dotenv
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=dayplan
```

Replace the placeholders with your database username, password, and cluster host. For MongoDB Atlas, make sure the database user has access to the selected database and that the server's network can connect to your cluster. Keep `server/.env` private; it is excluded from Git.

`MONGODB_DB` is optional and defaults to `dayplan`. The server listens on port `4000` by default; set `PORT` to use a different port in production.

### 2. Install dependencies

From the project root:

```sh
npm run install:all
```

This installs the server and client dependencies. If npm reports an `ERESOLVE` peer-dependency error while installing the client, install the packages separately using the compatibility option:

```sh
npm --prefix server install
npm --prefix client install --include=dev --legacy-peer-deps
```

### 3. Run the development servers

Open two terminals in the project root.

Terminal 1 — API and database connection:

```sh
npm run dev:server
```

Terminal 2 — client:

```sh
npm run dev:client
```

Open [http://localhost:5173](http://localhost:5173). During development, Vite serves the client and forwards `/api` requests to the server at `http://localhost:4000`.

## Production build and start

Build the client, then start the Express server:

```sh
npm --prefix client run build
npm start
```

The client build is written to `client/dist`. When that directory exists, the server serves the built app and the API from the same Node.js process. The app is available at the server's configured port (default `4000`).

The root shortcut `npm run build` installs dependencies and then builds the client. If dependency installation fails with the peer-dependency error described above, use the separate install steps and client build command instead.

## Deployment

DayPlan needs both its **Node.js server and MongoDB database**. It is not a static-only app: the server provides the API and serves the production client from `client/dist`. Choose a host that can run a Node.js web service and reach your MongoDB instance.

Typical deployment configuration:

| Setting | Value |
| --- | --- |
| Node.js version | `22.x` |
| Build command | `npm --prefix server install && npm --prefix client install --include=dev --legacy-peer-deps && npm --prefix client run build` |
| Start command | `npm start` |
| Required environment variable | `MONGODB_URI` |
| Optional environment variables | `MONGODB_DB` (defaults to `dayplan`), `PORT` (defaults to `4000`) |

Add database credentials in your hosting provider's **environment/secrets settings**. Do not commit credentials, `.env` files, or database connection strings to the repository. Make sure the database accepts connections from your host.

Use **HTTPS** in production, especially if you want browser notifications to be available on phones. See [Reminders and notifications](#reminders-and-notifications) for how reminders work.

## Reminders and notifications

DayPlan uses browser notifications for task and schedule reminders. Notifications require browser permission. Reminders are checked while the app is open; the app does not include a server-side push-notification service. A browser or installed app that is closed may not receive reminders. On mobile, HTTPS is generally required for notification features.

## Data and privacy

DayPlan stores tasks, schedule entries, completions, learning notes, and notification preferences in MongoDB. The current app does **not** include user accounts or authentication. Anyone who can reach a deployed instance may be able to use its API and access or change the data in its configured database.

Do not put private or sensitive data in a publicly reachable deployment unless you have separately restricted access or added appropriate authentication and authorization.

## Project layout

```text
.
├── client/
│   ├── public/          # Static assets and service worker
│   └── src/             # React app, pages, forms, and styles
├── server/
│   ├── .env.example     # MongoDB environment-variable template
│   └── index.js         # Express API and production static-file server
├── .node-version        # Required Node.js version
└── package.json         # Root development and production scripts
```

## Useful commands

| Command | Description |
| --- | --- |
| `npm run install:all` | Install server and client dependencies |
| `npm run dev:server` | Start the API in watch mode |
| `npm run dev:client` | Start the Vite development server |
| `npm --prefix client run typecheck` | Check client TypeScript types |
| `npm --prefix client run build` | Build the client for production |
| `npm start` | Start the production server |

## Troubleshooting

- **`MONGODB_URI is not set`** — create `server/.env` from `server/.env.example` and set `MONGODB_URI`, or configure the variable in your deployment environment.
- **The app cannot reach the server during development** — start the API with `npm run dev:server` and confirm it is listening on port `4000`, which is the Vite proxy target.
- **MongoDB connection timeout** — check the URI, database credentials, and MongoDB Atlas network access settings.
- **npm `ERESOLVE` during client install** — use `npm --prefix client install --include=dev --legacy-peer-deps`, then build with `npm --prefix client run build`.
- **No reminders while the app is closed** — reminders are checked by the open app; DayPlan does not currently provide background push notifications.
