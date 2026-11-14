export default async function handler(req, res) {
  const url = new URL("https://www.gbfh.co.kr/0206/cafeteria/menu/w2/");
  url.searchParams.set("symd", req.query?.symd || "20261114");
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; GBFHMealBot/1.0)" }
    });
    const html = await response.text();
    return res.status(200).json({
      status: response.status,
      htmlLength: html.length,
      hasFoodTable: html.includes("food-info-box"),
      region: process.env.VERCEL_REGION
    });
  } catch (error) {
    return res.status(502).json({
      error: error.message,
      region: process.env.VERCEL_REGION
    });
  }
}
