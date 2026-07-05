// api/asistan-ai.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Sadece POST desteklenir' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY eksik.' });
  }

  try {
    const { messages, system } = req.body || {};
    
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof m.content === 'string' ? m.content : m.content?.[0]?.text || '' }]
    }));

    const body = {
      contents,
      generationConfig: { maxOutputTokens: 2048, temperature: 0.7 }
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };

    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body)
      }
    );

    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({ error: data?.error?.message || 'Gemini API hatası' });
    }

    let text = "";
    const candidate = data?.candidates?.[0];

    if (candidate && candidate.content && Array.isArray(candidate.content.parts)) {
      text = candidate.content.parts.map(p => p.text).filter(Boolean).join('\n');
    }

    // Boş yanıt koruması
    if (!text) {
      text = "Merhaba! Size nasıl yardımcı olabilirim?";
    }

    // Piyasadaki tüm hazır chat şablonlarının (OpenAI, Anthropic, Custom) 
    // veri okuma kalıplarını tek bir JSON içinde taklit ediyoruz.
    return res.status(200).json({
      // OpenAI Kalıbı
      choices: [{ message: { role: "assistant", content: text }, finish_reason: "stop", index: 0 }],
      // Anthropic Kalıbı
      content: [{ type: 'text', text: text }],
      // Standart Düz Metin Kalıpları
      text: text,
      message: text,
      reply: text,
      result: text,
      response: text
    });

  } catch (e) {
    return res.status(500).json({ error: 'Sunucu hatası: ' + e.message });
  }
}
