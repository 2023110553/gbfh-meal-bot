const SOURCE = "https://www.gbfh.co.kr/0206/cafeteria/menu/w2/";

function esc(value) {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
}
function clean(html) {
  return esc(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " "))
    .replace(/&nbsp;|\u00a0/g, " ").split(/\r?\n/).map(s => s.replace(/\s+/g, " ").trim()).filter(Boolean);
}
function parse(html) {
  const match = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi)?.find(t => /food-info-box/i.test(t) || /아침/.test(t));
  if (!match) throw new Error("식단표를 찾지 못했습니다.");
  const rows = [...match.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m =>
    [...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => clean(c[1]))
  ).filter(r => r.length >= 5);
  return rows.slice(1, 8).map((r, i) => ({
    day: r[0].join(" "),
    date: r[1].join(" "),
    breakfast: r[2].join("\n"),
    lunch: r[3].join("\n"),
    dinner: r[4].join("\n")
  }));
}
function kakao(meals, symd) {
  const blocks = meals.map(d => `${d.day} ${d.date}\n아침: ${d.breakfast || "정보 없음"}\n점심: ${d.lunch || "정보 없음"}\n저녁: ${d.dinner || "정보 없음"}`).join("\n\n");
  return { version:"2.0", template:{ outputs:[{simpleText:{text:`기숙사 주간 식단 (${symd})\n\n${blocks}`}}] } };
}
export default async function handler(req, res) {
  const symd = String(req.query?.symd || new Date().toISOString().slice(0,10).replace(/-/g,""));
  if (!/^\d{8}$/.test(symd)) return res.status(400).json({error:"symd는 YYYYMMDD 형식이어야 합니다."});
  const url = new URL(SOURCE); url.searchParams.set("symd", symd);
  try {
    const upstream = await fetch(url, { signal:AbortSignal.timeout(15000), headers:{"user-agent":"Mozilla/5.0 (compatible; GBFHMealBot/1.0)"} });
    if (!upstream.ok) return res.status(502).json({error:"원본 사이트 응답 오류",status:upstream.status,region:process.env.VERCEL_REGION});
    const meals = parse(await upstream.text());
    if (req.query?.format === "kakao") return res.status(200).json(kakao(meals,symd));
    return res.status(200).json({symd,region:process.env.VERCEL_REGION,meals});
  } catch (error) {
    return res.status(502).json({error:error.message,region:process.env.VERCEL_REGION});
  }
}
