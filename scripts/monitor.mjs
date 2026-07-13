import { mkdir, writeFile } from "node:fs/promises";

const hotelCode = "itmph";
const start = new Date("2026-07-13T00:00:00Z");
const end = new Date("2026-12-31T00:00:00Z");
const labels = {
  "2026-07-20": "日本海之日", "2026-08-11": "日本山之日",
  "2026-08-13": "盂兰盆节假期", "2026-08-14": "盂兰盆节假期",
  "2026-08-15": "盂兰盆节假期", "2026-08-16": "盂兰盆节假期",
  "2026-09-21": "日本敬老日", "2026-09-22": "日本国民假日",
  "2026-09-23": "日本秋分日", "2026-09-25": "最高优先日期",
  "2026-09-26": "最高优先日期", "2026-10-01": "国庆假期",
  "2026-10-02": "国庆假期", "2026-10-03": "国庆假期",
  "2026-10-04": "国庆假期", "2026-10-05": "国庆假期",
  "2026-10-06": "国庆假期", "2026-10-07": "国庆假期",
  "2026-10-12": "日本体育日", "2026-11-03": "日本文化日",
  "2026-11-23": "日本勤劳感谢日", "2026-12-29": "日本年末假期",
  "2026-12-30": "日本年末假期", "2026-12-31": "日本年末假期"
};
const priority = new Set(["2026-09-25", "2026-09-26"]);

function iso(date) { return date.toISOString().slice(0, 10); }
function nextDay(value) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return iso(date);
}
function bookingUrl(checkin, checkout) {
  const params = new URLSearchParams({ checkinDate: checkin, checkoutDate: checkout, rooms: "1", adults: "2", kids: "0", rate: "woh", usePoints: "true" });
  return `https://www.hyatt.com/shop/rooms/${hotelCode}?${params}`;
}
function numeric(value) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

const dates = [];
for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
  const value = iso(date);
  const day = date.getUTCDay();
  if (day === 0 || day === 6 || labels[value]) {
    dates.push({
      checkin: value,
      checkout: nextDay(value),
      label: labels[value] ?? (day === 6 ? "周六" : "周日"),
      kind: priority.has(value) ? "priority" : labels[value] ? "holiday" : "weekend"
    });
  }
}

async function check(stay) {
  const checkedAt = new Date().toISOString();
  const params = new URLSearchParams({ spiritCode: hotelCode, rooms: "1", adults: "2", kids: "0", checkinDate: stay.checkin, checkoutDate: stay.checkout, rate: "woh", suiteUpgrade: "true" });
  try {
    const response = await fetch(`https://www.hyatt.com/en-US/shop/service/rooms/roomrates/${hotelCode}?${params}`, {
      headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (Kyoto Hyatt Award Monitor)" },
      signal: AbortSignal.timeout(25000)
    });
    if (!response.ok) throw new Error(`Hyatt returned ${response.status}`);
    const payload = await response.json();
    const rates = payload.roomRates && typeof payload.roomRates === "object" ? Object.values(payload.roomRates) : [];
    const pointFields = ["lowestPointValue", "lowestAvgPointValue", "points", "totalPoints"];
    const availableRates = rates.filter((rate) => rate && (rate.stexPointAvailable === true || pointFields.some((field) => numeric(rate[field]))));
    const points = availableRates.flatMap((rate) => pointFields.map((field) => numeric(rate[field])).filter(Boolean));
    return { ...stay, status: availableRates.length ? "available" : "unavailable", points: points.length ? Math.min(...points) : null, checkedAt, bookingUrl: bookingUrl(stay.checkin, stay.checkout) };
  } catch (error) {
    return { ...stay, status: "error", points: null, checkedAt, bookingUrl: bookingUrl(stay.checkin, stay.checkout), detail: error instanceof Error ? error.message : "查询失败" };
  }
}

const results = [];
for (let index = 0; index < dates.length; index += 5) {
  results.push(...await Promise.all(dates.slice(index, index + 5).map(check)));
}
await mkdir("public", { recursive: true });
await writeFile("public/data.json", `${JSON.stringify({ results, fetchedAt: new Date().toISOString() }, null, 2)}\n`);
console.log(`Saved ${results.length} dates; ${results.filter((item) => item.status === "available").length} available.`);
