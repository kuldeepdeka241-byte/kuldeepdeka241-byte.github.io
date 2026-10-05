module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(503).json({ error: "Transcription key is not set up." });
  const { audio, duration } = req.body || {};
  if (typeof audio !== "string" || !audio || !(duration > 0 && duration <= 30))
    return res.status(400).json({ error: "Invalid audio segment." });
  try {
    const form = new FormData();
    form.append("file", new Blob([Buffer.from(audio, "base64")], { type: "audio/wav" }), "audio.wav");
    form.append("model", "whisper-large-v3-turbo");
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (r.status === 429)
      return res.status(429).json({ error: "You’re transcribing too quickly. Wait a minute and try again." });
    if (!r.ok) throw new Error(await r.text());
    const out = await r.json();
    const words = (out.words || [])
      .map((w) => {
        const start = Math.max(0, Number(w.start) || 0);
        let end = Math.min(duration + 0.1, Number(w.end) || 0);
        if (end <= start) end = start + 0.2;
        return { text: String(w.word || "").trim(), start, end };
      })
      .filter((w) => w.text);
    return res.status(200).json({ words });
  } catch (e) {
    return res.status(502).json({ error: "Debug: " + String(e.message).slice(0, 250) });
  }
};
