export type Range = { start_time: string; end_time: string };

export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export const fromMin = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

/** All bookable start times ("HH:MM") inside the ranges, each slot fully fitting. */
export function generateSlots(ranges: Range[], slotMinutes: number): string[] {
  if (slotMinutes <= 0) return [];
  const out = new Set<string>();
  for (const r of ranges) {
    const start = toMin(r.start_time);
    const end = toMin(r.end_time);
    for (let t = start; t + slotMinutes <= end; t += slotMinutes) out.add(fromMin(t));
  }
  return [...out].sort();
}

/** Current date ("YYYY-MM-DD") and minutes-of-day in Cairo. */
export function cairoNow(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, minutes: Number(g("hour")) * 60 + Number(g("minute")) };
}

export function isSlotPast(date: string, time: string, now: Date = new Date()) {
  const c = cairoNow(now);
  if (date < c.date) return true;
  if (date > c.date) return false;
  return toMin(time) <= c.minutes;
}

export function addDays(date: string, n: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday (same as Postgres dow). */
export const weekdayOf = (date: string) => new Date(date + "T00:00:00Z").getUTCDay();

export const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function formatTime(t: string) {
  const m = toMin(t.slice(0, 5));
  const h = Math.floor(m / 60);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "ص" : "م"}`;
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(date + "T00:00:00Z"),
  );
}
