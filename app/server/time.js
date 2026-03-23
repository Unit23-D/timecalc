function combineToday(timeStr, now = new Date()) {
  // timeStr like "22:45" or "06:20"
  const [hh, mm] = timeStr.split(":").map(Number);
  const d = new Date(now);
  d.setHours(hh, mm, 0, 0);
  return d;
}

function roundDurationMinutes(ms) {
  return Math.max(0, Math.floor(ms / 60000));
}

function computeRange(startTimeStr, endTimeStr, now = new Date()) {
  const start = combineToday(startTimeStr, now);
  let end = combineToday(endTimeStr, now);

  // If end is same or earlier, assume next day
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }

  const ms = end.getTime() - start.getTime();
  const totalMinutes = roundDurationMinutes(ms);

  return { start, end, totalMinutes, ms };
}

module.exports = { computeRange, roundDurationMinutes };
