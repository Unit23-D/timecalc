const Database = require("better-sqlite3");
const path = require("path");

const db = new Database('/data/timecalc.sqlite');

db.exec(`
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  start_iso TEXT NOT NULL,
  end_iso TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  preset TEXT,
  note TEXT
);
`);

module.exports = db;
