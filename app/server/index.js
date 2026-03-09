const express = require("express");
const path = require("path");
const db = require("./db");
const { computeRange } = require("./time");

const app = express();
app.use(express.json());

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidTimeString(value) {
  return typeof value === "string" && TIME_RE.test(value);
}

function normalizeOptionalText(value, fieldName, maxLen) {
  if (value == null) return null;
  if (typeof value !== "string") {
    return { error: `${fieldName} must be a string or null` };
  }
  if (value.length > maxLen) {
    return { error: `${fieldName} must be ${maxLen} characters or fewer` };
  }
  return value;
}

function parseClientLocalDate(value) {
  if (typeof value !== "string") return null;
  const m = DATE_RE.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function computeRangeFromClientContext(startTime, endTime, clientLocalDate, clientTzOffsetMinutes) {
  const startMatch = TIME_RE.exec(startTime);
  const endMatch = TIME_RE.exec(endTime);
  const dateParts = parseClientLocalDate(clientLocalDate);
  if (!startMatch || !endMatch || !dateParts) return null;
  if (!Number.isInteger(clientTzOffsetMinutes) || clientTzOffsetMinutes < -1440 || clientTzOffsetMinutes > 1440) {
    return null;
  }

  const startUtcMs = Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    Number(startMatch[1]),
    Number(startMatch[2])
  ) + clientTzOffsetMinutes * 60000;

  let endUtcMs = Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    Number(endMatch[1]),
    Number(endMatch[2])
  ) + clientTzOffsetMinutes * 60000;

  if (endUtcMs <= startUtcMs) endUtcMs += 24 * 60 * 60 * 1000;

  const ms = endUtcMs - startUtcMs;
  return {
    start: new Date(startUtcMs),
    end: new Date(endUtcMs),
    totalMinutes: Math.round(ms / 60000),
    ms
  };
}

// Serve frontend
app.use(express.static(path.join(__dirname, "..", "public")));

// Create entry
app.post("/api/entries", (req, res) => {
  const {
    startTime,
    endTime,
    preset = null,
    note = null,
    clientLocalDate,
    clientTzOffsetMinutes
  } = req.body || {};
  if (!isValidTimeString(startTime) || !isValidTimeString(endTime)) {
    return res.status(400).json({ error: "startTime and endTime required (HH:MM)" });
  }

  const normalizedPreset = normalizeOptionalText(preset, "preset", 100);
  if (normalizedPreset && normalizedPreset.error) {
    return res.status(400).json({ error: normalizedPreset.error });
  }

  const normalizedNote = normalizeOptionalText(note, "note", 1000);
  if (normalizedNote && normalizedNote.error) {
    return res.status(400).json({ error: normalizedNote.error });
  }

  const hasClientDate = clientLocalDate != null;
  const hasClientOffset = clientTzOffsetMinutes != null;
  if (hasClientDate !== hasClientOffset) {
    return res.status(400).json({ error: "clientLocalDate and clientTzOffsetMinutes must be provided together" });
  }

  let range = null;
  if (hasClientDate && hasClientOffset) {
    range = computeRangeFromClientContext(
      startTime,
      endTime,
      clientLocalDate,
      Number(clientTzOffsetMinutes)
    );
    if (!range) {
      return res.status(400).json({ error: "Invalid clientLocalDate or clientTzOffsetMinutes" });
    }
  } else {
    range = computeRange(startTime, endTime, new Date());
  }

  const { start, end, totalMinutes } = range;
  const createdAt = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO entries (created_at, start_iso, end_iso, duration_minutes, preset, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    createdAt,
    start.toISOString(),
    end.toISOString(),
    totalMinutes,
    normalizedPreset,
    normalizedNote
  );

  res.json({
    id: info.lastInsertRowid,
    created_at: createdAt,
    start_iso: start.toISOString(),
    end_iso: end.toISOString(),
    duration_minutes: totalMinutes
  });
});

// List recent entries
app.get("/api/entries", (req, res) => {
  const rawLimit = parseInt(String(req.query.limit ?? "50"), 10);
  const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 50;
  const rows = db.prepare(`
    SELECT * FROM entries
    ORDER BY datetime(created_at) DESC
    LIMIT ?
  `).all(limit);
  res.json(rows);
});

// Clear all entries
app.delete("/api/entries", (_req, res) => {
  const info = db.prepare(`DELETE FROM entries`).run();
  res.json({ deleted: info.changes || 0 });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`timecalc listening on :${port}`));
