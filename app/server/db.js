const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

function resolveDbPath() {
  if (process.env.TIMECALC_DB_PATH) {
    return process.env.TIMECALC_DB_PATH;
  }

  const containerDataDir = "/data";
  const localDbPath = path.join(__dirname, "timecalc.sqlite");

  if (fs.existsSync(containerDataDir)) {
    return path.join(containerDataDir, "timecalc.sqlite");
  }

  return localDbPath;
}

const dbPath = resolveDbPath();
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const dbAlreadyExists = fs.existsSync(dbPath);

const db = new Database(dbPath);

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

if (!dbAlreadyExists) {
  console.log(`Initialized new TimeCalc database at ${dbPath}`);
}

module.exports = db;
