import "dotenv/config";
import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is not set.");
  process.exit(1);
}
const client = new MongoClient(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
});
await client.connect();
const db = client.db(process.env.MONGODB_DB || "dayplan");
const col = {
  tasks: db.collection("tasks"),
  schedule: db.collection("schedule"),
};
const done = db.collection("completions"),
  notes = db.collection("learning_notes"),
  settings = db.collection("settings");
await done.createIndex({ scheduleId: 1, date: 1 }, { unique: true });
await notes.createIndex({ scheduleId: 1, date: 1 }, { unique: true });

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
app.use(express.json());
const h = (fn) => async (req, res, next) => {
  try {
    res.json((await fn(req, res)) ?? { ok: true });
  } catch (e) {
    e.user ? res.status(400).json({ error: e.user }) : next(e);
  }
};

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
