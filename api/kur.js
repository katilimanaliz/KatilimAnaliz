export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.VITE_ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system: "Sen bir finansal veri asistanısın. Sadece JSON formatında yanıt ver.",
        messages: [{ role: "user", content: `Şu anki döviz kurlarını bul ve SADECE şu JSON formatında ver (markdown yok):\n{"USD_TRY":sayı,"EUR_TRY":sayı,"GBP_TRY":sayı,"CHF_TRY":sayı,"SAR_TRY":sayı,"AED_TRY":sayı,"JPY100_TRY":sayı,"XAU_USD":sayı,"XAU_TRY_gram":sayı,"XAG_TRY_gram":sayı,"EUR_USD":sayı}` }]
      })
    });
    const data = await r.json();
    const textBlock = data.content?.find(b => b.type === "text");
    if (!textBlock) return res.status(502).json({ error: "no text" });
    const clean = textBlock.text.replace(/```json|```/g, "").trim();
    res.status(200).json(JSON.parse(clean));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
