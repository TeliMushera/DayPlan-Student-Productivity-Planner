# DayPlan

A simple dark-themed planner for organizing your day. Track tasks, classes, events, reminders, and learning notes in one place.

## What you can do

- See today's tasks, schedule, and progress.
- Add tasks with due dates, priorities, and subtasks.
- Plan classes and events on the calendar.
- Save notes about completed activities.
- Get browser reminders while the app is open.

## Run it on your computer

You'll need **Node.js 22** and a **MongoDB database** (MongoDB Atlas works).

1. Create `server/.env` by copying `server/.env.example`.
2. Open `server/.env` and add your MongoDB connection details:

   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
   MONGODB_DB=dayplan
   ```

   Replace the placeholders with your MongoDB details. Keep this file private; do not upload it.

3. Install dependencies from the project folder:

   ```sh
   npm --prefix server install
   npm --prefix client install --include=dev --legacy-peer-deps
   ```

4. Start the server in one terminal:

   ```sh
   npm run dev:server
   ```

5. Start the app in a second terminal:

   ```sh
   npm run dev:client
   ```

6. Open [http://localhost:5173](http://localhost:5173).

## Deploy

Deploy DayPlan as a **Node.js app**, not as a static website. Your host needs Node.js 22 and access to your MongoDB database.

- Build command: `npm --prefix client run build`
- Start command: `npm start`
- Add `MONGODB_URI` in your host's environment settings.

Use HTTPS for browser notifications. Reminders work while DayPlan is open; they are not sent when the app is closed.
