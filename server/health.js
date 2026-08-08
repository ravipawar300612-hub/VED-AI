// ==========================================
// VED SWASTHYA — ROUTE MODULE
// Founder: Sayali P. R. Pawar
// ==========================================
const { scanHealth } = require("./healthEngine");

module.exports = function setupHealth(app, ai, db) {

    app.post("/check-health", async (req, res) => {
        try {
            const message = req.body.message;
            if (!message) return res.status(400).json({ reply: "Koi symptom nahi mila." });

            console.log("❤️ Health check:", message);
            const radar = scanHealth(message);
            console.log("🩺 Health Radar:", radar.level);

            let reply;
            try {
                const prompt = `
You are "VED Swasthya", a caring AI health guide for Indian families. You are NOT a doctor.
Internal Health Radar says: Level = ${radar.level}, matched symptoms: ${radar.flags.map(f => f.matchedWord).join(", ") || "none"}.

Reply STRICTLY in this format:
LEVEL: [EMERGENCY or HOME_CARE or DOCTOR]
HINDI: [Max 2-3 sentences, warm, simple Hindi/Hinglish guidance.]
ACTION: [One clear action, e.g. "Turant 108 par call karo" ya "Ghar par aaram karo, paani piyo"]
DISCLAIMER: [Only if NOT emergency: "Ye AI guidance hai, doctor ki salah nahi."]

Symptoms described: "${message}"`;

                const result = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: [{ role: "user", parts: [{ text: prompt }] }]
                });
                reply = result.candidates[0].content.parts[0].text;
            } catch (e) {
                // Internet nahi? Radar akela jawab dega
                reply = "LEVEL: " + radar.level +
                        "\nHINDI: " + (radar.level === "EMERGENCY"
                            ? "Ye serious lag raha hai! Turant hospital pahuncho ya 108 par call karo."
                            : "Aaram karo, paani piyo. Theek na lage toh doctor se milo.") +
                        "\nACTION: " + (radar.level === "EMERGENCY" ? "108 par call karo" : "Aaram karo") +
                        "\nDISCLAIMER: Ye AI guidance hai, doctor ki salah nahi.";
            }

            res.json({ radar: radar, reply: reply });

        } catch (error) {
            console.error("❌ Health Error:", error);
            res.status(500).json({ reply: "Check karne mein dikkat aayi. Dobara try karein." });
        }
    });

};