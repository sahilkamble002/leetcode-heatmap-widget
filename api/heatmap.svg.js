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
  if (!calStr) throw new Error("No calendar data found.");

  return JSON.parse(calStr);
}

function levelFromCount(c) {
  if (c <= 0) return 0;
  if (c === 1) return 1;
  if (c <= 3) return 2;
  if (c <= 6) return 3;
  return 4;
}

function escapeXml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildHeatmapSVG(calendarMap, days = 365) {
  const cell = 16;
  const gap = 4;
  const rows = 7;

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

  const colors = ["#1f2937", "#0e4429", "#006d32", "#26a641", "#39d353"];

  let rects = "";

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);

    const col = Math.floor(i / 7);
    const row = d.getDay();

    const ts = Math.floor(d.getTime() / 1000);
    const count = calendarMap[String(ts)] ?? 0;
    const level = levelFromCount(count);

    const x = gap + col * (cell + gap);
    const y = gap + row * (cell + gap);

    const title = escapeXml(`${d.toISOString().slice(0, 10)}: ${count} submissions`);

    rects += `
      <g>
        <title>${title}</title>
        <rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="4" ry="4" fill="${colors[level]}" />
      </g>
    `;
  }

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#0b0f14"/>
    ${rects}
  </svg>
  `.trim();
}

export default async function handler(req, res) {
  try {
    const username = req.query.username;
    const days = Number(req.query.days || 365);

    if (!username) {
      res.status(400).send("Missing ?username=");
      return;
    }

    const calendarMap = await fetchLeetCodeCalendar(username);
    const svg = buildHeatmapSVG(calendarMap, Math.min(Math.max(days, 30), 365));

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=3600");
    res.status(200).send(svg);
  } catch (e) {
    res.status(500).send(String(e?.message || e));
  }
}
