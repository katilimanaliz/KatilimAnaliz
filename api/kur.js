export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const KEY = process.env.VITE_ANTHROPIC_KEY;
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        tool_choice: { type: "any" },
        messages: [{
          role: "user",
          content: `Web'de ara: bugünkü döviz kurları USD/TRY EUR/TRY GBP/TRY. Aradıktan sonra SADECE şu JSON formatında ver:\n{"USD_TRY":sayı,"EUR_TRY":sayı,"GBP_TRY":sayı,"CHF_TRY":sayı,"SAR_TRY":sayı,"AED_TRY":sayı,"JPY100_TRY":sayı,"XAU_USD":sayı,"XAU_TRY_gram":sayı,"XAG_TRY_gram":sayı,"EUR_USD":sayı}`
        }]
      })
    });
    const d = await r.json();

    // Tüm içeriği logla (debug)
    const allContent = JSON.stringify(d);

    // text bloğu ara
    const textBlock = d.content?.find(b => b.type === "text");
    if (textBlock) {
      const clean = textBlock.text.replace(/```json|```/g, "").trim();
      try {
        return res.status(200).json(JSON.parse(clean));
      } catch(pe) {
        return res.status(200).json({ error: "parse_fail", raw: textBlock.text.slice(0,200) });
      }
    }

    // tool_result varsa ve içinde JSON varsa
