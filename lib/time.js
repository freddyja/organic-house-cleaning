const TZ = "America/New_York";

function partsInTz(date = new Date(), timeZone = TZ) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const map = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  // hour12:false can still yield "24" in some engines for midnight — normalize
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    weekday: map.weekday,
    ymd: `${map.year}-${map.month}-${map.day}`,
  };
}

/** Parse datetime-local value as America/New_York wall time → ISO UTC string. */
function localNyToIso(localValue) {
  // localValue: "2026-10-07T09:00" or with seconds
  const m = String(localValue || "").match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/
  );
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const asUtcGuess = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s || 0)
  );
  // Adjust by difference between that instant's NY wall clock and intended wall clock
  const guess = new Date(asUtcGuess);
  const p = partsInTz(guess);
  const intendedMs = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s || 0));
  const actualMs = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
  const corrected = new Date(asUtcGuess + (intendedMs - actualMs));
  return corrected.toISOString();
}

function formatWhenNy(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function ymdInTz(iso, timeZone = TZ) {
  return partsInTz(new Date(iso), timeZone).ymd;
}

function addDaysYmd(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

module.exports = {
  TZ,
  partsInTz,
  localNyToIso,
  formatWhenNy,
  ymdInTz,
  addDaysYmd,
};
