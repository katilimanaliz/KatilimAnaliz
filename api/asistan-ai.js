// api/asistan.js — Google Gemini sürümü (Claude yerine)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Sadece POST desteklenir' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY eksik — Vercel ortam değişkenlerine ekleyin.'
    });
  }

  try {
    const { messages, system } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages dizisi gerekli' });
    }

    // Anthropic mesaj formatını Gemini formatına çevir
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [
        {
          text:
            typeof m.content === 'string'
              ? m.content
              : m.content?.[0]?.text || ''
        }
      ]
    }));

    const body = {
      contents,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 }
    };
    if (system) {
      body.systemInstruction = { parts: [{ text: system }] };
    }

    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(body)
      }
    );

    const data = await r.json();

    if (!r.ok) {
      const msg = data?.error?.message || 'Gemini API hatası';
      // Kota aşımı için anlaşılır mesaj
      if (r.status === 429) {
        return res.status(429).json({ error: 'Gemini kota limiti aşıldı, biraz sonra tekrar deneyin.' });
      }
      return res.status(r.status).json({ error: msg });
    }

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .filter(Boolean)
        .join('\n') || '';

    if (!text) {
      return res.status(500).json({ error: 'Gemini boş yanıt döndürdü' });
    }

    // Anthropic ile aynı yanıt şekli: frontend data.content[0].text okuyorsa değişiklik gerekmez
    return res.status(200).json({ content: [{ type: 'text', text }], text });
  } catch (e) {
    return res.status(500).json({ error: 'Sunucu hatası: ' + e.message });
  }
}
