export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const KEY = process.env.VITE_ANTHROPIC_KEY;
    const headers = {
      "Content-Type": "application/json",
      "x-api-key": KEY,
      "anthropic-version": "2023-06-01",
    };
    const prompt = `Şu anki döviz kurlarını bul ve SADECE şu JSON formatında ver (markdown yok):
{"USD_TRY":sayı,"EUR_TRY":sayı,"GBP_TRY":sayı,"CHF_TRY":sayı,"SAR_TRY":sayı,"AED_TRY":sayı,"JPY100_TRY":sayı,"XAU_USD":sayı,"XAU_TRY_gram":sayı,"XAG_TRY_gram":sayı,"EUR_USD":sayı}`;

    // 1. İlk istek - web search tool ile
    const r1 = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }]
      })
    });
    const d1 = await r1.json();

    // Eğer direkt text geldiyse
    const directText = d1.content?.find(b => b.type === "text");
    if (directText) {
      const clean = directText.text.replace(/```json|```/g, "").trim();
      return res.status(200).json(JSON.parse(clean));
    }

    // tool_use + tool_result döngüsü
    const toolUse = d1.content?.find(b => b.type === "tool_use");
    if (!toolUse) return res.status(502).json({ error: "no tool_use" });

    // 2. Tool result ile ikinci istek
    const r2 = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [
          { role: "user", content: prompt },
          { role: "assistant", content: d1.content },
          { role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, content: toolUse.input ? JSON.stringify(toolUse.input) : "" }] }
        ]
      })
    });
    const d2 = await r2.json();
    const textBlock = d2.content?.find(b => b.type === "text");
    if (!textBlock) return res.status(502).json({ error: "no text after tool" });
    const clean = textBlock.text.replace(/```json|```/g, "").trim();
    res.status(200).json(JSON.parse(clean));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
