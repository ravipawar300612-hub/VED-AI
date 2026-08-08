// ==========================================
// VED KISAN — ROUTE MODULE
// Founder: Sayali P. R. Pawar
// ==========================================
const { scanCrop } = require("./cropEngine");

module.exports = function setupCrop(app, ai, db) {

    app.post("/check-crop", async (req, res) => {
        try {
            const { message, image } = req.body;
            if (!message && !image) return res.status(400).json({ reply: "Kuch nahi mila." });

            console.log("🌾 Crop check:", message || "[photo]");
            const radar = scanCrop(message || "");
            console.log("🌾 Crop Radar:", radar.level);

            let reply;
            try {
                const prompt = `
You are "VED Kisan", an AI crop doctor for Indian farmers. Speak simple Hindi/Hinglish.
Internal Crop Radar says: Level = ${radar.level}, signs: ${radar.flags.map(f => f.matchedWord).join(", ") || "none"}.
${image ? "A photo of the crop/leaf is attached. Analyze it visually." : ""}
Give practical, low-cost treatment advice (neem oil, proper watering, etc.) when relevant.
Reply STRICTLY in this format:
LEVEL: [SEVERE or TREATMENT or HEALTHY]
HINDI: [Max 2-3 sentences, simple Hindi/Hinglish.]
ACTION: [One clear action, e.g. "Neem oil ka chhidkaav karo"]

${message ? `Farmer says: "${message}"` : ""}`;

                const parts = [{ text: prompt }];
                if (image) {
                    const base64Data = image.includes(",") ? image.split(",")[1] : image;
                    parts.push({ inlineData: { mimeType: "image/jpeg", data: base64Data } });
                }

                const result = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: [{ role: "user", parts: parts }]
                });
                reply = result.candidates[0].content.parts[0].text;
            } catch (e) {
                reply = "LEVEL: " + radar.level +
                    "\nHINDI: " + (radar.level === "HEALTHY"
                        ? "Paudha theek lag raha hai. Paani aur dhoop ka dhyan rakho."
                        : "Patti mein problem ke lakshan dikhe hain.") +
                    "\nACTION: " + (radar.level === "SEVERE"
                        ? "Kisan adhikari ya krishi kendra se turant salah lein"
                        : "Neem oil ka chhidkaav karke dekhein");
            }

            res.json({ radar: radar, reply: reply });

        } catch (error) {
            console.error("❌ Crop Error:", error);
            res.status(500).json({ reply: "Check karne mein dikkat aayi." });
        }
    });

};