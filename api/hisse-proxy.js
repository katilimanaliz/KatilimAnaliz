export default async function handler(req, res) {
  try {
    const r = await fetch(
      "https://www.getmidas.com/wp-json/midas-api/v1/midas_table_data?sortId=&return=table",
      { headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" } }
    );

    const text = await r.text();
    const ilk500 = text.slice(0, 500);
    
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      ok: r.ok,
      status: r.status,
      contentType: r.headers.get("content-type"),
      ilk500,
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
