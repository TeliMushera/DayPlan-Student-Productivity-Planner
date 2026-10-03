# DayPlan

A simple dark-themed planner for organizing your day. Track tasks, classes, events, reminders, and learning notes in one place.

## What you can do

- See today's tasks, schedule, and progress.
- Add tasks with due dates, priorities, and subtasks.
- Plan classes and events on the calendar.
- Save notes about completed activities.
- Get push reminders while DayPlan is closed (after enabling notifications on each device).

## Run it on your computer

You'll need **Node.js 22** and a **MongoDB database** (MongoDB Atlas works).

1. Create `server/.env` by copying `server/.env.example`.
2. Open `server/.env` and add your MongoDB connection details. Also set a private `APP_PASSWORD` of at least 6 characters to keep your planner private:

   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
   MONGODB_DB=dayplan
   APP_PASSWORD=replace-this-with-a-private-password-of-at-least-6-characters
   ```

   Replace the placeholders with your MongoDB details and password. Keep this file private; do not upload it.

3. Generate push keys. From the project folder, run:

   ```sh
   npm --prefix server exec -- web-push generate-vapid-keys
   ```

   Copy the generated public key to `VAPID_PUBLIC_KEY` and the private key to `VAPID_PRIVATE_KEY` in `server/.env`. Set `VAPID_SUBJECT` to your contact email, for example `mailto:you@example.com`. Keep the private key secret. Use the **same keys** in local development and production.

4. Install dependencies from the project folder:

   ```sh
   npm --prefix server install
   npm --prefix client install --include=dev --legacy-peer-deps
   ```

5. Start the server in one terminal:

   ```sh
   npm run dev:server
   ```

6. Start the app in a second terminal:

   ```sh
   npm run dev:client
   ```

7. Open [http://localhost:5173](http://localhost:5173), unlock DayPlan with `APP_PASSWORD`, and open **Settings** to install the app and enable reminders on this device.

## Deploy

Deploy DayPlan as a **Node.js web service**, not as a static website. Your host needs Node.js 22 and access to your MongoDB database.

- Build command: `npm --prefix server install && npm --prefix client install --include=dev --legacy-peer-deps && npm --prefix client run build`
- Start command: `npm start`
- Add `MONGODB_URI`, `APP_PASSWORD`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` in your host's environment settings. `MONGODB_DB` is optional and defaults to `dayplan`.

Keep your service running for reliable reminders while the app is closed. Services that go to sleep cannot check for reminders while asleep; on Render, use an always-on paid web service for reliable background reminders.

## Use DayPlan on your phone

1. Deploy the app and open its **HTTPS** link on your phone.
2. Sign in with your `APP_PASSWORD`.
3. Open **Settings** and install DayPlan:
   - **iPhone:** open the link in Safari, tap **Share → Add to Home Screen**, then open the new DayPlan icon. Push notifications need iOS 16.4 or later.
   - **Android:** open the link in Chrome, tap **⋮ → Install app** or **Add to Home screen**.
4. In the installed app, open **Settings → Enable reminders on this device**, allow notifications, and tap **Send test notification**.
5. Choose which task and schedule reminders you want. Add a due time and reminder to tasks; add a reminder to scheduled activities.

Each phone or browser must enable push separately. Reminders use the device's local timezone. Push notification delivery depends on the phone's notification settings, network connection, and the hosting service staying awake.

The app uses one shared password for your personal planner, not separate user accounts. Do not share the deployment URL or password with others.
