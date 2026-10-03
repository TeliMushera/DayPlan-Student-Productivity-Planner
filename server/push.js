import { createHash } from "node:crypto";

const WINDOW_MS = 2 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function localParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function addDays(date, days) {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, "0")}-${String(result.getUTCDate()).padStart(2, "0")}`;
}

function zonedTime(date, time, timeZone) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const local = localParts(new Date(guess), timeZone);
    const represented = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
    guess += target - represented;
  }
  return guess;
}

function occursOn(item, date) {
  if (date < item.date) return false;
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  switch (item.recurring) {
    case "none":
      return date === item.date;
    case "daily":
      return true;
    case "weekdays":
      return weekday > 0 && weekday < 6;
    case "weekly":
      return weekday === new Date(`${item.date}T12:00:00Z`).getUTCDay();
    default:
      return (item.recurDays || []).includes(weekday);
  }
}

function inWindow(when, now) {
  return when <= now && now - when < WINDOW_MS;
}

function eventMessage(item, minutes) {
  if (["class", "lab", "study"].includes(item.kind)) {
    return `${item.title} starts at ${item.startTime}${item.location ? ` in ${item.location}` : ""}. ${minutes > 0 ? `You have ${minutes} minutes before it begins.` : "It is starting now."}`;
  }
  return `${item.title} is scheduled from ${item.startTime} to ${item.endTime}.`;
}

export function createPushScheduler({
  webPush,
  subscriptions,
  deliveries,
  tasks,
  schedule,
  completions,
  settings,
  defaults,
}) {
  let scanning = false;

  async function sendOnce(subscription, key, body) {
    const endpointId = createHash("sha256")
      .update(subscription.endpoint)
      .digest("hex");
    const deliveryKey = `${endpointId}:${key}`;
    try {
      await deliveries.insertOne({ key: deliveryKey, createdAt: new Date() });
    } catch (error) {
      if (error?.code === 11000) return;
      throw error;
    }

    try {
      await webPush.sendNotification(
        { endpoint: subscription.endpoint, keys: subscription.keys },
        JSON.stringify({ title: "DayPlan", body, url: "/" }),
        { TTL: 120 },
      );
      await deliveries.updateOne(
        { key: deliveryKey },
        { $set: { sentAt: new Date() } },
      );
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await subscriptions.deleteOne({ endpoint: subscription.endpoint });
      } else {
        console.error("Could not send a DayPlan push notification:", error);
      }
      await deliveries.deleteOne({ key: deliveryKey });
    }
  }

  async function scan() {
    if (scanning) return;
    scanning = true;
    try {
      const [deviceList, taskList, itemList, completionList, savedSettings] =
        await Promise.all([
          subscriptions.find().toArray(),
          tasks.find().toArray(),
          schedule.find().toArray(),
          completions.find().toArray(),
          settings.findOne({ _id: "main" }),
        ]);
      if (!deviceList.length) return;

      const preferences = { ...defaults, ...(savedSettings || {}) };
      const completed = new Set(
        completionList.map((entry) => `${entry.scheduleId}:${entry.date}`),
      );
      const now = Date.now();

      for (const device of deviceList) {
        const timeZone = device.timezone || "UTC";
        let current;
        try {
          current = localParts(new Date(now), timeZone);
        } catch (error) {
          console.error("Invalid timezone for a DayPlan device:", error);
          continue;
        }

        for (const task of taskList) {
          if (!task.dueDate || task.status === "completed") continue;
          const dueTime = task.dueTime || "23:59";
          const dueAt = zonedTime(task.dueDate, dueTime, timeZone);

          if (
            preferences.task &&
            task.reminder != null &&
            task.dueTime &&
            inWindow(dueAt - task.reminder * 60 * 1000, now) &&
            (task.reminder === 0 || now < dueAt)
          ) {
            await sendOnce(
              device,
              `task:${task._id}:reminder:${dueAt}`,
              `Your ${task.title} is due at ${task.dueTime}.`,
            );
          }

          if (preferences.overdue && inWindow(dueAt, now)) {
            await sendOnce(
              device,
              `task:${task._id}:overdue:${dueAt}`,
              `Your ${task.title} is overdue.`,
            );
          }
        }

        for (let offset = 0; offset <= 7; offset += 1) {
          const date = addDays(current.date, offset);
          for (const item of itemList) {
            if (
              item.reminder == null ||
              !occursOn(item, date) ||
              completed.has(`${item._id}:${date}`)
            )
              continue;
            const isClass = ["class", "lab", "study"].includes(item.kind);
            if (isClass ? !preferences.class : !preferences.event) continue;

            const startsAt = zonedTime(date, item.startTime, timeZone);
            const reminderAt = startsAt - item.reminder * 60 * 1000;
            if (
              inWindow(reminderAt, now) &&
              (item.reminder === 0 || now < startsAt)
            ) {
              await sendOnce(
                device,
                `schedule:${item._id}:${date}:${reminderAt}`,
                eventMessage(item, item.reminder),
              );
            }
          }
        }

        if (preferences.summary && current.hour === 8 && current.minute < 2) {
          const taskCount = taskList.filter(
            (task) => task.dueDate === current.date && task.status !== "completed",
          ).length;
          const itemCount = itemList.filter((item) =>
            occursOn(item, current.date),
          ).length;
          if (taskCount + itemCount > 0) {
            await sendOnce(
              device,
              `summary:${current.date}`,
              `Good morning! You have ${taskCount} task${taskCount === 1 ? "" : "s"} and ${itemCount} scheduled activit${itemCount === 1 ? "y" : "ies"} today.`,
            );
          }
        }
      }
    } finally {
      scanning = false;
    }
  }

  function start() {
    const run = () => scan().catch((error) => {
      console.error("DayPlan push reminder scan failed:", error);
    });
    run();
    return setInterval(run, 30 * 1000);
  }

  return { scan, start };
}
