# DayPlan
Database: MongoDB (Atlas free tier works). Set MONGODB_URI (and optionally MONGODB_DB, default "dayplan").
Local dev: copy server/.env.example to server/.env and fill it in, `npm run install:all`, then `npm run dev:server` and `npm run dev:client` (http://localhost:5173).
Production: `npm run build` then `npm start` (one Node process serves API + app). Use HTTPS so phone notifications work.
Reminders fire while DayPlan is open in the browser/installed app; there is no push server.
