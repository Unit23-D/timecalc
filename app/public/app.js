const startEl = document.getElementById("startTime");
const endEl = document.getElementById("endTime");
const durationEl = document.getElementById("durationText");
const endsAtEl = document.getElementById("endsAtText");
const statusEl = document.getElementById("statusText");
const recentEl = document.getElementById("recent");
const saveBtn = document.getElementById("saveBtn");
const refreshNowBtn = document.getElementById("refreshNowBtn");
const clearAllBtn = document.getElementById("clearAllBtn");

let selectedPreset = null;
let statusClearTimer = null;

function setStatus(message, type = "", clearAfterMs = 0) {
  if (!statusEl) return;
  if (statusClearTimer) {
    clearTimeout(statusClearTimer);
    statusClearTimer = null;
  }
  statusEl.textContent = message || "";
  statusEl.className = type ? `status ${type}` : "status";
  if (message && !type && clearAfterMs > 0) {
    statusClearTimer = setTimeout(() => {
      statusEl.textContent = "";
      statusEl.className = "status";
      statusClearTimer = null;
    }, clearAfterMs);
  }
}

async function readApiError(response, fallback) {
  try {
    const data = await response.json();
    if (data && typeof data.error === "string" && data.error) return data.error;
  } catch (_) {}
  return fallback;
}

function pad2(n) { return String(n).padStart(2, "0"); }

function timeNowHHMM() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function localDateYYYYMMDD(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function combineToday(timeStr, base = new Date()) {
  const [hh, mm] = timeStr.split(":").map(Number);
  const d = new Date(base);
  d.setHours(hh, mm, 0, 0);
  return d;
}

function computeRange(startTimeStr, endTimeStr, base = new Date()) {
  const start = combineToday(startTimeStr, base);
  let end = combineToday(endTimeStr, base);
  if (end.getTime() <= start.getTime()) end = new Date(end.getTime() + 86400000);
  const ms = end.getTime() - start.getTime();
  return { start, end, ms };
}

function roundDurationMinutes(ms) {
  return Math.max(0, Math.floor(ms / 60000));
}

function formatDuration(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h} hours ${m} minutes`;
}

function getCurrentDurationState(now = new Date()) {
  if (!startEl.value || !endEl.value) return null;

  const { end } = computeRange(startEl.value, endEl.value, now);
  const ms = Math.max(0, end.getTime() - now.getTime());
  const totalMinutes = roundDurationMinutes(ms);
  const discardedSeconds = Math.floor((ms % 60000) / 1000);

  return {
    now,
    end,
    ms,
    totalMinutes,
    discardedSeconds
  };
}

function logDurationRounding(state, context) {
  if (!state || state.discardedSeconds <= 0) return;
  console.info(
    `[TimeCalc] ${context}: floor(${state.ms}ms / 60000) = ${state.totalMinutes} minutes; ignoring ${state.discardedSeconds}s`
  );
}

function isSameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatEndsAtLabel(end, now = new Date()) {
  const timeText = end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (isSameLocalDay(end, now)) return `Ends today, ${timeText}`;
  if (isSameLocalDay(end, tomorrow)) return `Ends tomorrow, ${timeText}`;
  return `Ends ${end.toLocaleString()}`;
}

function formatRecentStart(dt) {
  return dt.toLocaleString([], {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function render() {
  const state = getCurrentDurationState(new Date());
  if (!state) {
    durationEl.textContent = "—";
    endsAtEl.textContent = "—";
    return;
  }
  durationEl.textContent = formatDuration(state.totalMinutes);
  endsAtEl.textContent = formatEndsAtLabel(state.end, state.now);
}

async function loadRecent() {
  try {
    const r = await fetch("/api/entries?limit=20");
    if (!r.ok) {
      const msg = await readApiError(r, "Failed to load recent entries.");
      throw new Error(msg);
    }

    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      recentEl.innerHTML = `<div class="row"><div class="muted">No entries yet.</div></div>`;
      return;
    }

    recentEl.innerHTML = rows.map(x => {
      const start = new Date(x.start_iso);
      return `<div class="row">
      <div><strong>${formatRecentStart(start)}</strong> → ${Math.floor(x.duration_minutes/60)}h ${x.duration_minutes%60}m</div>
      <div class="muted">${x.preset || ""}</div>
    </div>`;
    }).join("");
  } catch (err) {
    setStatus(err.message || "Failed to load recent entries.", "error");
    recentEl.innerHTML = `<div class="row"><div class="muted">${err.message || "Failed to load recent entries."}</div></div>`;
  }
}

document.querySelectorAll("button[data-time]").forEach(btn => {
  btn.addEventListener("click", () => {
    endEl.value = btn.dataset.time;
    selectedPreset = btn.dataset.preset || null;
    render();
  });
});

saveBtn.addEventListener("click", async () => {
  if (!startEl.value || !endEl.value) return;

  try {
    const now = new Date();
    const durationState = getCurrentDurationState(now);
    if (!durationState) return;
    logDurationRounding(durationState, "save");

    const r = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime: startEl.value,
        endTime: endEl.value,
        durationMinutes: durationState.totalMinutes,
        preset: selectedPreset,
        clientLocalDate: localDateYYYYMMDD(now),
        clientTzOffsetMinutes: now.getTimezoneOffset()
      })
    });

    if (!r.ok) {
      const msg = await readApiError(r, "Failed to save entry.");
      throw new Error(msg);
    }

    await loadRecent();
    setStatus("Saved.", "", 3000);
  } catch (err) {
    setStatus(err.message || "Failed to save entry.", "error");
  }
});

refreshNowBtn.addEventListener("click", () => {
  startEl.value = timeNowHHMM();
  setStatus("");
  render();
});

if (clearAllBtn) {
  clearAllBtn.addEventListener("click", async () => {
    const ok = window.confirm("Clear all recent entries?");
    if (!ok) return;

    try {
      const r = await fetch("/api/entries", { method: "DELETE" });
      if (!r.ok) {
        const msg = await readApiError(r, "Failed to clear entries.");
        throw new Error(msg);
      }

      await loadRecent();
      setStatus("Cleared all entries.", "", 3000);
    } catch (err) {
      setStatus(err.message || "Failed to clear entries.", "error");
    }
  });
}

// Init
startEl.value = timeNowHHMM();
const defaultPresetButton = document.querySelector("button[data-time]");
if (defaultPresetButton) {
  endEl.value = defaultPresetButton.dataset.time || "";
  selectedPreset = defaultPresetButton.dataset.preset || null;
}
render();
loadRecent();
setInterval(render, 1000);
