// ==========================================
// VED AI SERVER v8.2 (DEMO MODE - NO DATABASE)
// Founder : Sayali P. R. Pawar
// ==========================================

console.log('🎯 DEMO MODE: Running without database for judges demo');

// MOCK DATABASE (Demo ke liye - kuch save nahi hoga, bas chalega)
const db = {
    run: (query, params, callback) => { if (callback) callback(null); },
    all: (query, params, callback) => { if (callback) callback(null, []); },
    get: (query, params, callback) => { if (callback) callback(null, {}); }
};

require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");
const { PDFParse } = require("pdf-parse");
const setupAuth = require("./auth");
const { scanMessage } = require("./scamEngine");

const app = express();

// ===============================
// MIDDLEWARE
// ===============================
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json({ limit: "10mb" }));

// AUTO-DETECT client folder
const clientCandidates = [
    path.join(__dirname, "client"),
    path.join(__dirname, "..", "client"),
    path.join(__dirname, "..", "..", "client")
];
const CLIENT_PATH = clientCandidates.find(p => fs.existsSync(path.join(p, "index.html")));
console.log("📁 Frontend folder detected at:", CLIENT_PATH);

app.use(express.static(CLIENT_PATH));

// Gemini AI setup
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

// ===============================
// MEMORY (Empty - Demo Mode)
// ===============================
let conversationHistory = [];
console.log("🧠 Demo Mode: Starting with empty conversation history");

// ===============================
// BLACKLIST TABLE (Mock - Demo Mode)
// ===============================
db.run("CREATE TABLE IF NOT EXISTS blacklist (id INTEGER PRIMARY KEY AUTOINCREMENT, pattern TEXT NOT NULL, note TEXT)");

// Message se phone numbers + links nikalne ka helper
function extractPatterns(text) {
    const patterns = new Set();
    const phones = text.match(/\+?\d[\d\s\-]{8,}\d/g) || [];
    phones.forEach(p => patterns.add(p.replace(/[\s\-]/g, "")));
    const urls = text.match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9\-]+\.[a-z]{2,}(?:\.[a-z]{2,})?)/gi) || [];
    urls.forEach(u => patterns.add(String(u).replace(/^(https?:\/\/)?(www\.)?/i, "").toLowerCase()));
    return [...patterns].filter(p => p && p.length >= 5);
}

// ===============================
// HOME ROUTE
// ===============================
app.get("/", (req, res) => {
    res.sendFile(path.join(CLIENT_PATH, "index.html"));
});

// ===============================
// HISTORY ROUTE
// ===============================
app.get("/history", (req, res) => {
    db.all(
        "SELECT role, message FROM chats ORDER BY id ASC",
        [],
        (err, rows) => {
            if (err) {
                console.error("❌ Failed to fetch history:", err.message);
                return res.status(500).json({ history: [] });
            }
            res.json({ history: rows });
        }
    );
});

// ===============================
// CHAT ROUTE
// ===============================
app.post("/chat", async (req, res) => {
    try {
        const message = req.body.message;
        console.log("📩 User:", message);

        db.run("INSERT INTO chats(role, message) VALUES(?, ?)", ["user", message]);

        const rememberMatch = message.match(/^remember (that )?(.+)/i);
        if (rememberMatch) {
            const fact = rememberMatch[2].trim();
            db.run("INSERT INTO memories(fact) VALUES(?)", [fact]);
            console.log("🧠 Saved new long-term memory:", fact);
        }

        conversationHistory.push({ role: "user", parts: [{ text: message }] });
        if (conversationHistory.length > 30) conversationHistory = conversationHistory.slice(-30);

        const memoryFacts = await new Promise((resolve) => {
            db.all("SELECT fact FROM memories ORDER BY id ASC", [], (err, rows) => {
                if (err) { console.error("❌ Failed to load memories:", err.message); resolve([]); return; }
                resolve(rows.map(r => r.fact));
            });
        });

        const memoryBlock = memoryFacts.length > 0
            ? `\n\nHere are important facts the user has asked you to remember about them. Use these naturally when relevant:\n${memoryFacts.map(f => "- " + f).join("\n")}\n`
            : "";

        const systemPrompt = `
You are VED AI, created by Sayali P. R. Pawar.
Never say you are Gemini.

IMPORTANT RULES:
- Keep responses SHORT and conversational (1-3 sentences max)
- Reply like a smart friend texting, not writing an essay
- Only explain in detail if user specifically asks "explain" or "tell me more"
- Never use markdown (*, #, _, backticks)
- Write exactly how you'd speak naturally

${memoryBlock}`;

        const contents = [ { role: "user", parts: [{ text: systemPrompt }] }, ...conversationHistory ];

        const result = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: contents });
        const reply = result.candidates[0].content.parts[0].text;

        console.log("🤖 VED:", reply);
        db.run("INSERT INTO chats(role, message) VALUES(?, ?)", ["assistant", reply]);
        conversationHistory.push({ role: "model", parts: [{ text: reply }] });

        res.json({ reply: reply });

    } catch (error) {
        console.error("❌ Server Error:", error);
        res.status(500).json({ reply: "Something went wrong 😥" });
    }
});

// ===============================
// VISION ROUTE
// ===============================
app.post("/vision", async (req, res) => {
    try {
        const { image, message } = req.body;
        if (!image) return res.status(400).json({ reply: "No photo received." });

        const base64Data = image.includes(",") ? image.split(",")[1] : image;
        const question = (message && message.trim()) ? message.trim() : "What is in this photo? Describe it naturally.";

        console.log("📷 Photo question:", question);
        db.run("INSERT INTO chats(role, message) VALUES(?, ?)", ["user", "[Photo] " + question]);

        const visionPrompt = `You are VED AI, created by Sayali P. R. Pawar. Never say you are Gemini. Reply in plain, natural text only. Answer the user's question about the attached photo naturally.\nQuestion: ${question}`;

        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: visionPrompt }, { inlineData: { mimeType: "image/jpeg", data: base64Data } }] }]
        });

        const reply = result.candidates[0].content.parts[0].text;
        console.log("🤖 VED (vision):", reply);
        db.run("INSERT INTO chats(role, message) VALUES(?, ?)", ["assistant", reply]);
        res.json({ reply });

    } catch (error) {
        console.error("❌ Vision Error:", error);
        res.status(500).json({ reply: "Something went wrong while looking at that photo 😥" });
    }
});

// ===============================
// DOCUMENT ROUTE
// ===============================
app.post("/document", async (req, res) => {
    try {
        const { document, message } = req.body;
        if (!document) return res.status(400).json({ reply: "No document received." });
        
        const base64Data = document.includes(",") ? document.split(",")[1] : document;
        const buffer = Buffer.from(base64Data, "base64");

        const parser = new PDFParse({ data: buffer });
        const parsed = await parser.getText();
        await parser.destroy();

        let text = parsed.text.trim();
        if (!text) return res.json({ reply: "I couldn't find any readable text in that PDF." });
        if (text.length > 12000) text = text.slice(0, 12000) + "\n\n[Document truncated]";

        const question = (message && message.trim()) ? message.trim() : "Summarize this document.";
        console.log("📄 Document question:", question);
        db.run("INSERT INTO chats(role, message) VALUES(?, ?)", ["user", "[Document] " + question]);

        const docPrompt = `You are VED AI, created by Sayali P. R. Pawar. Never say you are Gemini. Reply in plain, natural text only. Use the document content below to answer.\nDocument content:\n${text}\nQuestion: ${question}`;

        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: docPrompt }] }]
        });

        const reply = result.candidates[0].content.parts[0].text;
        console.log("🤖 VED (document):", reply);
        db.run("INSERT INTO chats(role, message) VALUES(?, ?)", ["assistant", reply]);
        res.json({ reply });

    } catch (error) {
        console.error("❌ Document Error:", error);
        res.status(500).json({ reply: "Something went wrong while reading that document 😥" });
    }
});

// ===============================
// BLACKLIST ROUTES
// ===============================
app.post("/blacklist", (req, res) => {
    try {
        const message = req.body.message || "";
        const patterns = extractPatterns(message);
        const toSave = patterns.length ? patterns : [message.trim().slice(0, 120)];

        toSave.forEach(p => {
            db.run("INSERT INTO blacklist(pattern, note) VALUES(?, ?)", [p, message.slice(0, 120)]);
        });

        console.log("🚫 Blacklisted patterns:", toSave);
        res.json({ saved: toSave.length, patterns: toSave });
    } catch (error) {
        console.error("❌ Blacklist Error:", error);
        res.status(500).json({ saved: 0 });
    }
});

app.get("/blacklist", (req, res) => {
    db.all("SELECT id, pattern FROM blacklist ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.json({ blacklist: [] });
        res.json({ blacklist: rows });
    });
});

// ===============================
// SCAM CHECK ROUTE (HYBRID + BLACKLIST)
// ===============================
app.post("/check-scam", async (req, res) => {
    try {
        const suspiciousMessage = req.body.message;

        if (!suspiciousMessage) {
            return res.status(400).json({ reply: "Koi message nahi mila." });
        }

        console.log("🛡️ Checking:", suspiciousMessage);

        // STEP 1: TERA RADAR (offline + instant)
        const radar = scanMessage(suspiciousMessage);

        // STEP 1.5: BLACKLIST CHECK (VED ki yaaddasht)
        const blacklistRows = await new Promise((resolve) => {
            db.all("SELECT pattern FROM blacklist", [], (err, rows) => resolve(err ? [] : (rows || [])));
        });

        const normalized = suspiciousMessage.toLowerCase().replace(/[\s\-]/g, "");
        const hits = blacklistRows
            .map(r => r.pattern)
            .filter(p => p && p.length >= 5 && normalized.includes(p.toLowerCase().replace(/[\s\-]/g, "")));

        if (hits.length > 0) {
            radar.riskScore += 5;
            radar.radarVerdict = "SCAM";
            radar.flags.push({ rule: "BLACKLIST", matchedWord: hits[0] });
            console.log("🚫 BLACKLIST HIT:", hits);
        }

        console.log("📡 Radar Verdict:", radar.radarVerdict, "| Score:", radar.riskScore);

        // STEP 2: GEMINI KA DIMAAG (internet ho toh)
        let reply;
        try {
            const blacklistNote = hits.length > 0
                ? `\nCRITICAL: The user has PREVIOUSLY blacklisted this pattern: ${hits[0]}. Tell them prominently: "Ye number/link aapki blacklist mein pehle se hai!"`
                : "";

            const scamPrompt = `
You are "VED Suraksha", an AI bodyguard protecting elderly Indian people from scams.
Our internal Scam Radar already analyzed this message:
- Radar Verdict: ${radar.radarVerdict}
- Risk Score: ${radar.riskScore}
- Patterns found: ${radar.flags.map(f => f.matchedWord).join(", ") || "none"}
${blacklistNote}
Confirm with your intelligence and reply STRICTLY in this format:
VERDICT: [SCAM or SAFE or SUSPICIOUS]
HINDI: [Max 2 sentences, simple respectful Hindi/Hinglish, like a caring grandson.]
ACTION: [One clear action, e.g. "Link par click mat karo" ya "Ye safe hai, chinta na karein"]

Message: "${suspiciousMessage}"`;

            const result = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [{ role: "user", parts: [{ text: scamPrompt }] }]
            });
            reply = result.candidates[0].content.parts[0].text;
        } catch (e) {
            reply = "VERDICT: " + radar.radarVerdict +
                    "\nHINDI: Internet nahi hai, isliye VED Radar ne akela check kiya. Risk score " + radar.riskScore + " mila hai. Savdhani rakhein." +
                    "\nACTION: Koi link na kholein, koi OTP na dein.";
        }

        res.json({ radar: radar, reply: reply });

    } catch (error) {
        console.error("❌ Scam Check Error:", error);
        res.status(500).json({ reply: "Check karne mein dikkat aayi. Dobara try karein." });
    }
});

// ===============================
// ELEVENLABS TTS ROUTE (GOOSEBUMPS EDITION)
// ===============================
app.post("/tts", async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: "No text provided" });

        const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
        const models = ["eleven_v3", "eleven_multilingual_v2"];

        let audioBuffer = null;
        for (const model of models) {
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                method: "POST",
                headers: {
                    "xi-api-key": process.env.ELEVENLABS_API_KEY,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    text: text,
                    model_id: model,
                    voice_settings: {
                        stability: 0.35,
                        similarity_boost: 0.8,
                        style: 0.25,
                        use_speaker_boost: true
                    }
                })
            });

            if (response.ok) {
                audioBuffer = Buffer.from(await response.arrayBuffer());
                console.log("🎙️ TTS via:", model);
                break;
            }
            console.warn("⚠️ Model failed:", model, response.status);
        }

        if (!audioBuffer) return res.status(500).json({ error: "All TTS models failed" });

        res.set("Content-Type", "audio/mpeg");
        res.send(audioBuffer);

    } catch (error) {
        console.error("❌ TTS Error:", error);
        res.status(500).json({ error: "TTS failed" });
    }
});

// ===============================
// SHIELD #2: VED SWASTHYA (Health Module)
// ===============================
require("./health")(app, ai, db);
require("./crop")(app, ai, db);

// ===============================
// AUTH + START SERVER
// ===============================
setupAuth(app);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 VED AI Server Running on Port ${PORT}`);
});