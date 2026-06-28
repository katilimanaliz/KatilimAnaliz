export default async function handler(req, res) {
  try {
    const API_KEY = process.env.FONOLOJI_KEY;
    if (!API_KEY) {
      return res.status(500).json({ success: false, error: "FONOLOJI_KEY tanımlı değil" });
    }

    const response = await fetch(
      "https://fonoloji.com/v1/funds?limit=5",
      { headers: { "X-API-Key": API_KEY } }
    );

    if (!response.ok) {
      throw new Error(`Fonoloji API hatası: ${response.status}`);
    }

    const data = await response.json();

    // Ham veriyi döndür — alan isimlerini görmek için
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json(data);

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
