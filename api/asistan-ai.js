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
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 }
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };

    // Akıl yürütme döngüsüne girip arayüzü kilitlemeyen stabil modele istek atıyoruz
    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
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

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      return res.status(500).json({ error: 'Gemini boş yanıt döndürdü.' });
    }

    // Arayüzün (Claude/Anthropic veya özel şablon) bekleyebileceği tüm kombinasyonlar
    return res.status(200).json({ 
      content: [{ type: 'text', text: text }], 
      text: text, 
      message: text, 
      reply: text, 
      result: text
    });
  } catch (e) {
    return res.status(500).json({ error: 'Sunucu hatası: ' + e.message });
  }
}
