import "dotenv/config";
import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import path from "path";
import fs from "fs";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "url";
import { rateLimit } from "express-rate-limit";
import webPush from "web-push";
import { createPushScheduler } from "./push.js";

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is not set.");
  process.exit(1);
}
const client = new MongoClient(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
});
const APP_PASSWORD = process.env.APP_PASSWORD || "";
if (APP_PASSWORD.length < 6) {
  console.error("Set APP_PASSWORD to a private password with at least 6 characters.");
  process.exit(1);
}
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "";
const pushSettings = [VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT];
const pushConfigured = pushSettings.every(Boolean);
if (pushSettings.some(Boolean) && !pushConfigured) {
  throw new Error(
    "Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT together.",
  );
}
if (pushConfigured)
  webPush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );
const APP_PASSWORD_HASH = createHash("sha256").update(APP_PASSWORD).digest();
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const SESSION_COOKIE = "dayplan_session";

function sessionSignature(expires) {
  return createHmac("sha256", APP_PASSWORD)
    .update(String(expires))
    .digest("hex");
}

function hasValidSession(req) {
  if (!APP_PASSWORD) return true;
  const token = (req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!token) return false;
  const [expires, signature] = token.split(".");
  if (!/^\d+$/.test(expires || "") || Number(expires) <= Date.now()) return false;
  const expected = Buffer.from(sessionSignature(expires));
  const actual = Buffer.from(signature || "");
  return (
    expected.length === actual.length && timingSafeEqual(expected, actual)
  );
}

function cookieOptions(req, maxAge) {
  const secure =
    req.secure || req.get("x-forwarded-proto")?.split(",")[0] === "https";
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

await client.connect();
const db = client.db(process.env.MONGODB_DB || "dayplan");
const col = {
  tasks: db.collection("tasks"),
  schedule: db.collection("schedule"),
};
const done = db.collection("completions"),
  notes = db.collection("learning_notes"),
  settings = db.collection("settings"),
  pushSubscriptions = db.collection("push_subscriptions"),
  pushDeliveries = db.collection("push_deliveries");
await done.createIndex({ scheduleId: 1, date: 1 }, { unique: true });
await notes.createIndex({ scheduleId: 1, date: 1 }, { unique: true });
await pushSubscriptions.createIndex({ endpoint: 1 }, { unique: true });
await pushDeliveries.createIndex({ key: 1 }, { unique: true });
await pushDeliveries.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
);

const COLS = {
  tasks: {
    title: "",
    description: "",
    priority: "medium",
    status: "pending",
    dueDate: null,
    dueTime: null,
    estimatedMinutes: null,
    category: "",
    reminder: null,
    subtasks: [],
    completedAt: null,
  },
  schedule: {
    title: "",
    kind: "class",
    date: null,
    startTime: null,
    endTime: null,
    location: "",
    description: "",
    reminder: null,
    recurring: "none",
    recurDays: [],
  },
};
const DEF = {
  task: true,
  class: true,
  event: true,
  summary: true,
  overdue: true,
  defaultReminder: 15,
};
const DATE = /^\d{4}-\d{2}-\d{2}$/,
  TIME = /^\d{2}:\d{2}$/;
const bad = (m) => {
  throw { user: m };
};
const ser = (d) => d && { ...d, id: String(d._id), _id: undefined };
const oid = (s) => {
  try {
    return new ObjectId(String(s));
  } catch {
    bad("That item no longer exists.");
  }
};
const pick = (t, b) =>
  Object.fromEntries(
    Object.keys(COLS[t])
      .filter((k) => k in b)
      .map((k) => [k, b[k]]),
  );

function check(t, b, full) {
  if ((full || "title" in b) && !String(b.title || "").trim())
    bad("Please enter a title.");
  for (const k of ["dueDate", "date"])
    if (
      (b[k] || (full && t === "schedule" && k === "date")) &&
      !DATE.test(b[k] || "")
    )
      bad("That date does not look right.");
  for (const k of ["dueTime", "startTime", "endTime"])
    if (
      (b[k] || (full && t === "schedule" && k !== "dueTime")) &&
      !TIME.test(b[k] || "")
    )
      bad("That time does not look right.");
  if (
    b.reminder != null &&
    !(Number.isInteger(b.reminder) && b.reminder >= 0 && b.reminder <= 10080)
  )
    bad("Reminder must be a whole number of minutes.");
  if (t === "schedule" && b.startTime && b.endTime && b.endTime <= b.startTime)
    bad("End time must be after the start time.");
  if (
    t === "tasks" &&
    !["high", "medium", "low"].includes(b.priority ?? "medium")
  )
    bad("Pick a valid priority.");
}

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
const h = (fn) => async (req, res, next) => {
  try {
    res.json((await fn(req, res)) ?? { ok: true });
  } catch (e) {
    e.user ? res.status(400).json({ error: e.user }) : next(e);
  }
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Wait a few minutes and try again." },
});
app.get("/api/auth/status", (req, res) =>
  res.json({
    required: Boolean(APP_PASSWORD),
    authenticated: hasValidSession(req),
  }),
);
app.post("/api/auth/login", loginLimiter, (req, res) => {
  if (!APP_PASSWORD)
    return res.status(503).json({
      error: "Set APP_PASSWORD in the server environment before signing in.",
    });
  const submitted = createHash("sha256")
    .update(String(req.body?.password || ""))
    .digest();
  if (!timingSafeEqual(APP_PASSWORD_HASH, submitted))
    return res.status(401).json({ error: "That password is not correct." });
  const expires = Date.now() + SESSION_MAX_AGE * 1000;
  const secure =
    req.secure || req.get("x-forwarded-proto")?.split(",")[0] === "https";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${expires}.${sessionSignature(expires)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MAX_AGE}${secure ? "; Secure" : ""}`,
  );
  return res.json({ ok: true });
});
app.post("/api/auth/logout", (req, res) => {
  res.setHeader("Set-Cookie", cookieOptions(req, 0));
  res.json({ ok: true });
});
app.use("/api", (req, res, next) => {
  if (
    ["/auth/status", "/auth/login", "/auth/logout", "/health"].includes(
      req.path,
    )
  )
    return next();
  if (!hasValidSession(req))
    return res.status(401).json({ error: "Unlock DayPlan to continue." });
  return next();
});

app.get("/api/push/status", async (req, res, next) => {
  try {
    const endpoint = String(req.query.endpoint || "");
    const subscribed = endpoint
      ? Boolean(await pushSubscriptions.findOne({ endpoint }))
      : false;
    res.json({ configured: pushConfigured, subscribed });
  } catch (error) {
    next(error);
  }
});
app.get("/api/push/public-key", (_req, res) =>
  res.json({
    configured: pushConfigured,
    publicKey: pushConfigured ? VAPID_PUBLIC_KEY : null,
  }),
);
app.post(
  "/api/push/subscribe",
  h(async (req) => {
    if (!pushConfigured) bad("Push notifications are not configured yet.");
    const sub = req.body?.subscription;
    if (
      typeof sub?.endpoint !== "string" ||
      !sub.endpoint.startsWith("https://") ||
      typeof sub?.keys?.p256dh !== "string" ||
      typeof sub?.keys?.auth !== "string"
    )
      bad("That notification subscription is not valid.");
    const timezone = req.body?.timezone || "UTC";
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone });
    } catch {
      bad("That device timezone is not valid.");
    }
    await pushSubscriptions.updateOne(
      { endpoint: sub.endpoint },
      {
        $set: {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
          timezone,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  }),
);
app.delete(
  "/api/push/subscribe",
  h(async (req) => {
    const endpoint = String(req.query.endpoint || "");
    if (!endpoint) bad("Choose a device to unsubscribe.");
    await pushSubscriptions.deleteOne({ endpoint });
  }),
);
app.post(
  "/api/push/test",
  h(async (req) => {
    if (!pushConfigured) bad("Push notifications are not configured yet.");
    const endpoint = String(req.body?.endpoint || "");
    const subscription = await pushSubscriptions.findOne({ endpoint });
    if (!subscription) bad("Enable reminders on this device first.");
    try {
      await webPush.sendNotification(
        { endpoint: subscription.endpoint, keys: subscription.keys },
        JSON.stringify({
          title: "DayPlan test",
          body: "Push notifications are working on this device.",
          url: "/",
        }),
        { TTL: 60 },
      );
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await pushSubscriptions.deleteOne({ endpoint });
        bad("This device subscription expired. Enable reminders again.");
      }
      throw error;
    }
  }),
);

for (const t of Object.keys(COLS)) {
  app.get(
    `/api/${t}`,
    h(async () => (await col[t].find().sort({ _id: 1 }).toArray()).map(ser)),
  );
  app.post(
    `/api/${t}`,
    h(async (req, res) => {
      check(t, req.body, true);
      const doc = {
        ...COLS[t],
        ...pick(t, req.body),
        ...(t === "tasks" ? { createdAt: new Date().toISOString() } : {}),
      };
      const r = await col[t].insertOne(doc);
      res.status(201);
      return ser({ ...doc, _id: r.insertedId });
    }),
  );
  app.put(
    `/api/${t}/:id`,
    h(async (req) => {
      check(t, req.body, false);
      const _id = oid(req.params.id);
      const set = pick(t, req.body);
      if (Object.keys(set).length)
        await col[t].updateOne({ _id }, { $set: set });
      const r = await col[t].findOne({ _id });
      if (!r) bad("That item no longer exists.");
      return ser(r);
    }),
  );
  app.delete(
    `/api/${t}/:id`,
    h(async (req) => {
      const _id = oid(req.params.id);
      await col[t].deleteOne({ _id });
      if (t === "schedule") {
        await done.deleteMany({ scheduleId: String(_id) });
        await notes.deleteMany({ scheduleId: String(_id) });
      }
    }),
  );
}
app.get(
  "/api/done",
  h(async () =>
    (await done.find().toArray()).map(({ scheduleId, date, completedAt }) => ({
      scheduleId,
      date,
      completedAt,
    })),
  ),
);
app.post(
  "/api/done",
  h(async (req) => {
    const { scheduleId, date } = req.body;
    if (!scheduleId || !DATE.test(date || "")) bad("Invalid activity.");
    await done.updateOne(
      { scheduleId: String(scheduleId), date },
      { $setOnInsert: { completedAt: new Date().toISOString() } },
      { upsert: true },
    );
  }),
);
app.delete(
  "/api/done",
  h(async (req) => {
    await done.deleteOne({
      scheduleId: String(req.query.scheduleId),
      date: String(req.query.date),
    });
  }),
);
app.get(
  "/api/notes",
  h(async () => (await notes.find().toArray()).map(ser)),
);
app.put(
  "/api/notes",
  h(async (req) => {
    const {
      scheduleId,
      date,
      whatLearned = "",
      importantPoints = "",
      doubts = "",
      followUp = "",
    } = req.body;
    if (!scheduleId || !DATE.test(date || "")) bad("Invalid activity.");
    const now = new Date().toISOString();
    await notes.updateOne(
      { scheduleId: String(scheduleId), date },
      {
        $set: {
          whatLearned,
          importantPoints,
          doubts,
          followUp,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }),
);
app.get(
  "/api/settings",
  h(async () => {
    const { _id, ...s } = (await settings.findOne({ _id: "main" })) || {};
    return { ...DEF, ...s };
  }),
);
app.put(
  "/api/settings",
  h(async (req) => {
    const s = {
      ...DEF,
      ...Object.fromEntries(
        Object.keys(DEF)
          .filter((k) => k in req.body)
          .map((k) => [k, req.body[k]]),
      ),
    };
    await settings.replaceOne(
      { _id: "main" },
      { _id: "main", ...s },
      { upsert: true },
    );
    return s;
  }),
);
app.get("/api/health", (_req, res) => res.json({ ok: true }));

if (pushConfigured) {
  const pushScheduler = createPushScheduler({
    webPush,
    subscriptions: pushSubscriptions,
    deliveries: pushDeliveries,
    tasks: col.tasks,
    schedule: col.schedule,
    completions: done,
    settings,
    defaults: DEF,
  });
  pushScheduler.start();
}

const dist = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../client/dist",
);
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_, res) => res.sendFile(path.join(dist, "index.html")));
}
app.use((e, _req, res, _next) => {
  console.error(e);
  res
    .status(500)
    .json({ error: "Something went wrong on our side. Please try again." });
});
app.listen(process.env.PORT || 4000, () => console.log("DayPlan API running"));
