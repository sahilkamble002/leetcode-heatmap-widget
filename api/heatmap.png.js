import { createCanvas } from "canvas";

const LEETCODE_GRAPHQL = "https://leetcode.com/graphql";

async function fetchLeetCodeCalendar(username) {
  const query = `
    query userProfileCalendar($username: String!) {
      matchedUser(username: $username) {
        userCalendar {
          submissionCalendar
        }
      }
    }
  `;

  const res = await fetch(LEETCODE_GRAPHQL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "referer": "https://leetcode.com"
    },
    body: JSON.stringify({
      query,
      variables: { username }
    })
  });

  if (!res.ok) throw new Error(`LeetCode fetch failed: ${res.status}`);

  const data = await res.json();
  const calStr = data?.data?.matchedUser?.userCalendar?.submissionCalendar;
  if (!calStr) throw new Error("No calendar data found (username wrong or blocked).");

  return JSON.parse(calStr);
}

function levelFromCount(c) {
  if (c <= 0) return 0;
  if (c === 1) return 1;
  if (c <= 3) return 2;
  if (c <= 6) return 3;
  return 4;
}

function drawHeatmap(calendarMap, days = 90) {
  const cell = 18, gap = 4, rows = 7;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));

  const startDay = start.getDay();
  start.setDate(start.getDate() - startDay);

  const totalDays = Math.ceil((today - start) / (24 * 3600 * 1000)) + 1;
  const cols = Math.ceil(totalDays / 7);

  const width = cols * (cell + gap) + gap;
  const height = rows * (cell + gap) + gap;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0b0f14";
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);

    const col = Math.floor(i / 7);
    const row = d.getDay();

    const ts = Math.floor(d.getTime() / 1000);
    const count = calendarMap[String(ts)] ?? 0;
    const level = levelFromCount(count);

    const colors = ["#1f2937", "#0e4429", "#006d32", "#26a641", "#39d353"];
    ctx.fillStyle = colors[level];

    const x = gap + col * (cell + gap);
    const y = gap + row * (cell + gap);

    const r = 4;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + cell, y, x + cell, y + cell, r);
    ctx.arcTo(x + cell, y + cell, x, y + cell, r);
    ctx.arcTo(x, y + cell, x, y, r);
    ctx.arcTo(x, y, x + cell, y, r);
    ctx.closePath();
    ctx.fill();
  }

  return canvas.toBuffer("image/png");
}

export default async function handler(req, res) {
  try {
    const username = req.query.username;
    const days = Number(req.query.days || 90);

    if (!username) return res.status(400).send("Missing ?username=");

    const calendarMap = await fetchLeetCodeCalendar(username);
    const png = drawHeatmap(calendarMap, Math.min(Math.max(days, 30), 365));

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=3600");
    res.status(200).send(png);
  } catch (e) {
    res.status(500).send(String(e?.message || e));
  }
}
