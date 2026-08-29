// ==========================================
// VED AI SERVER v8.9 (GOOGLE SEARCH GROUNDING — FIXED)
// Founder : Sayali P. R. Pawar
// ==========================================

const db = require("./database");
require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");
const setupAuth = require("./auth");
const { scanMessage } = require("./scamEngine");

const app = express();

// ===============================
// ENVIRONMENT VALIDATION
// ===============================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.warn("⚠️  WARNING: GEMINI_API_KEY not set. AI features will be limited.");
}

// ===============================
// MIDDLEWARE
// ===============================
app.use(cors({ origin: true, credentials: true }));

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

app.use(express.json({ limit: "10mb" }));

const clientCandidates = [
    path.join(__dirname, "client"),
    path.join(__dirname, "..", "client"),
    path.join(__dirname, "..", "..", "client")
];
const CLIENT_PATH = clientCandidates.find(p => fs.existsSync(path.join(p, "index.html")));
console.log("📁 Frontend folder detected at:", CLIENT_PATH);

if (!CLIENT_PATH) {
    console.error("❌ CRITICAL: Client folder not found!");
    process.exit(1);
}

app.use(express.static(CLIENT_PATH));

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// ===============================
// 🌐 LANGUAGE DETECTOR
// ===============================
function detectLanguage(text) {
    const t = String(text || "");
    const lower = t.toLowerCase();
    if (/[\u0900-\u097F]/.test(t)) {
        if (/(आहे|आहात|नाही|काय|कसे|कशी|झाले|झाली|मला|तुम्ही|होय|जावो|करू|हवी)/.test(t)) return "marathi";
        return "hindi";
    }
    if (/\b(kasa|kahasa|zala|zali|zale|tuza|tumhi|nako|ahes|ahet|havi|karu)\b/.test(lower)) return "marathi";
    if (/\b(kaise|kaisa|kya|hai|ho|namaste|namaskar|shukriya|dhanyavad|theek|accha|acha|haan|nahi|yaar|bhai|didi|matlab)\b/.test(lower)) return "hindi";
    return "english";
}

function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ===============================
// ⚡ SMART GREETING CACHE
// ===============================
const CANNED_RESPONSES = {
    english: {
        greeting: ["Hello! I'm VED AI. How may I help you today?", "Hi there! Welcome. Please go ahead."],
        howAreYou: ["I'm doing great, thank you! How can I assist you today?"],
        thanks: ["You're most welcome!", "It's my pleasure!"],
        bye: ["Goodbye! I'm here whenever you need me."],
        loveYou: ["Thank you so much! It's truly a pleasure to assist you."],
        ok: ["Sure.", "Understood."],
        yes: ["Yes, absolutely."],
        no: ["No problem at all."],
        busy: ["I'm fully available to help you."]
    },
    hindi: {
        greeting: ["नमस्ते! मैं VED AI हूँ। बताइए, आज मैं आपकी कैसे मदद कर सकता हूँ?", "नमस्कार! आपका स्वागत है।"],
        howAreYou: ["मैं बिल्कुल ठीक हूँ, धन्यवाद! आप सुनाइए?"],
        thanks: ["आपका स्वागत है!", "कोई बात नहीं!"],
        bye: ["अलविदा! जब भी ज़रूरत हो, मैं यहीं हूँ।"],
        loveYou: ["आपका बहुत-बहुत धन्यवाद!"],
        ok: ["ठीक है।", "बिल्कुल।"],
        yes: ["जी हाँ, बिल्कुल।"],
        no: ["कोई बात नहीं।"],
        busy: ["मैं आपकी मदद के लिए पूरी तरह उपलब्ध हूँ।"]
    },
    marathi: {
        greeting: ["नमस्कार! मी VED AI आहे. सांगा, आज मी तुमची कशी मदत करू शकतो?"],
        howAreYou: ["मी एकदम ठीक आहे, धन्यवाद! तुम्ही सांगा?"],
        thanks: ["तुमचं स्वागत आहे!"],
        bye: ["पुन्हा भेटू!"],
        loveYou: ["तुमचा खूप खूप धन्यवाद!"],
        ok: ["ठीक आहे."],
        yes: ["हो, नक्की."],
        no: ["काही हरकत नाही."],
        busy: ["मी तुमच्या मदतीसाठी पूर्णपणे उपलब्ध आहे."]
    }
};

const GREETING_RULES = [
    { re: /^(hi+e*|hey+|hello+|yo+|hlo+|hii+)([!\s.]*)$/i, cat: "greeting" },
    { re: /^(namaste+|namaskar+|नमस्ते+|नमस्कार+)([!\s.]*)$/i, cat: "greeting" },
    { re: /^(kaise ho|kaisa hai|kya haal|how are you|what'?s up|wassup|sup|kasa aahes|कैसे हो|तुम्ही कसे आहात)([!\s?.]*)$/i, cat: "howAreYou" },
    { re: /^(good morning|good afternoon|good evening|good night|शुभ प्रभात)([!\s.]*)$/i, cat: "greeting" },
    { re: /^(thanks|thank you|thnx|ty|shukriya|dhanyavaad|धन्यवाद)([!\s.]*)$/i, cat: "thanks" },
    { re: /^(bye|goodbye|alvida|tata|see you|अलविदा|निरोप)([!\s.]*)$/i, cat: "bye" },
    { re: /^(love you|ily|i love you)([!\s.]*)$/i, cat: "loveYou" },
    { re: /^(ok|okay|theek hai|thik hai|ठीक है)([!\s.]*)$/i, cat: "ok" },
    { re: /^(haan|yes|yeah|yep|yup|ji haan|हो|हाँ)([!\s.]*)$/i, cat: "yes" },
    { re: /^(nahi|no|nope|nah|नहीं|नाही)([!\s.]*)$/i, cat: "no" }
];

function getGreetingResponse(message) {
    const msg = String(message || "").trim();
    const lang = detectLanguage(msg);
    for (const rule of GREETING_RULES) {
        if (rule.re.test(msg)) {
            const pool = CANNED_RESPONSES[lang] && CANNED_RESPONSES[lang][rule.cat];
            if (pool && pool.length) return randomPick(pool);
        }
    }
    return null;
}

// ===============================
// 🔄 MODEL FALLBACK + GOOGLE SEARCH (v8.9 — CLEAN)
// ===============================
const MODEL_CHAIN = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"];

async function generateWithFallback(contents, useSearch = false) {
    let lastError = null;

    for (const model of MODEL_CHAIN) {
        // 1️⃣ Pehle Google Search ke saath (SAHI syntax: config.tools)
        if (useSearch) {
            try {
                console.log("🔍 " + model + " + Google Search...");
                const result = await ai.models.generateContent({
                    model: model,
                    contents: contents,
                    config: {
                        tools: [{ googleSearch: {} }]
                    }
                });
                const grounding = result.candidates?.[0]?.groundingMetadata;
                const usedSearch = !!(grounding && (grounding.groundingChunks?.length || grounding.webSearchQueries?.length));
                console.log(usedSearch ? "✅ GOOGLE SEARCH USED!" : "✅ Model replied (search not needed)");
                return { result, usedSearch };
            } catch (err) {
                const errMsg = String(err.message || "").toLowerCase();
                if (errMsg.includes("quota") || errMsg.includes("429") || errMsg.includes("rate") || errMsg.includes("limit")) {
                    console.warn("⚠️ " + model + " quota full, next model...");
                    lastError = err;
                    continue;
                }
                console.warn("⚠️ Search error (" + model + "):", err.message);
            }
        }

        // 2️⃣ Bina search ke normal call
        try {
            const result = await ai.models.generateContent({ model: model, contents: contents });
            console.log("✅ Used model (no search):", model);
            return { result, usedSearch: false };
        } catch (err) {
            const errMsg = String(err.message || "").toLowerCase();
            if (errMsg.includes("quota") || errMsg.includes("429") || errMsg.includes("rate") || errMsg.includes("limit")) {
                console.warn("⚠️ " + model + " quota full, next model...");
                lastError = err;
                continue;
            }
            throw err;
        }
    }
    throw lastError || new Error("All models quota exhausted");
}

// ===============================
// MEMORY
// ===============================
let conversationHistory = [];

db.all("SELECT role, message FROM chats ORDER BY id DESC LIMIT 30", [], (err, rows) => {
    if (err) { console.error("❌ Failed to load chat history:", err.message); return; }
    conversationHistory = rows.reverse().map(row => ({
        role: row.role === "user" ? "user" : "model",
        parts: [{ text: row.message }]
    }));
    console.log(`🧠 Loaded ${conversationHistory.length} past messages from database.`);
});

// ===============================
// DATABASE INITIALIZATION
// ===============================
const initDatabase = () => {
    try {
        db.run(`CREATE TABLE IF NOT EXISTS chats (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT NOT NULL, message TEXT NOT NULL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        db.run(`CREATE TABLE IF NOT EXISTS memories (id INTEGER PRIMARY KEY AUTOINCREMENT, fact TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        db.run(`CREATE TABLE IF NOT EXISTS blacklist (id INTEGER PRIMARY KEY AUTOINCREMENT, pattern TEXT NOT NULL, note TEXT, added_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        console.log("✅ Database tables initialized");
    } catch (err) {
        console.error("❌ Database initialization failed:", err.message);
    }
};
initDatabase();

// ===============================
// HELPERS
// ===============================
function validateMessage(msg) {
    if (!msg || typeof msg !== 'string') return null;
    const trimmed = msg.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > 5000) return trimmed.slice(0, 5000);
    return trimmed;
}

function validateBase64(data) {
    if (!data || typeof data !== 'string') return null;
    try {
        const base64Pattern = /^data:.*?base64,(.+)$|^([A-Za-z0-9+/=]+)$/;
        if (!base64Pattern.test(data)) return null;
        const cleaned = data.includes(',') ? data.split(',')[1] : data;
        Buffer.from(cleaned, 'base64');
        return cleaned;
    } catch { return null; }
}

function sanitizeOutput(text) {
    if (!text) return '';
    return String(text).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function extractPatterns(text) {
    const patterns = new Set();
    const phones = text.match(/\+?\d[\d\s\-]{8,}\d/g) || [];
    phones.forEach(p => patterns.add(p.replace(/[\s\-]/g, "")));
    const urls = text.match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9\-]+\.[a-z]{2,}(?:\.[a-z]{2,})?)/gi) || [];
    urls.forEach(u => patterns.add(String(u).replace(/^(https?:\/\/)?(www\.)?/i, "").toLowerCase()));
    return [...patterns].filter(p => p && p.length >= 5);
}

// ===============================
// ROUTES
// ===============================
app.get("/", (req, res) => res.sendFile(path.join(CLIENT_PATH, "index.html")));

app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), port: process.env.PORT || 3000, ai_ready: !!ai });
});

app.get("/history", (req, res) => {
    db.all("SELECT role, message FROM chats ORDER BY id ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ history: [] });
        res.json({ history: rows });
    });
});

// ===============================
// CHAT ROUTE (WITH GOOGLE SEARCH)
// ===============================
app.post("/chat", async (req, res) => {
    try {
        const message = validateMessage(req.body.message);
        if (!message) return res.status(400).json({ error: "Invalid message" });

        const lang = String(req.body.lang || "").toLowerCase();
        const tone = String(req.body.tone || "").toLowerCase();
        console.log("📩 User:", message);

        db.run("INSERT INTO chats(role, message) VALUES(?, ?)", ["user", message], (err) => {
            if (err) console.error("❌ Failed to save user message:", err.message);
        });

        const cachedReply = getGreetingResponse(message);
        if (cachedReply) {
            console.log("⚡ CACHED greeting response");
            db.run("INSERT INTO chats(role, message) VALUES(?, ?)", ["assistant", cachedReply]);
            conversationHistory.push({ role: "user", parts: [{ text: message }] });
            conversationHistory.push({ role: "model", parts: [{ text: cachedReply }] });
            if (conversationHistory.length > 50) conversationHistory = conversationHistory.slice(-50);
            return res.json({ reply: sanitizeOutput(cachedReply), cached: true });
        }

        function detectMsgLang(msg) {
            const t = String(msg || "");
            if (/[\u0900-\u097F]/.test(t)) {
                if (/(आहे|आहात|नाही|काय|कसे|झाले|मला|तुम्ही|होय|करू|हवी|पाहिजे)/.test(t)) return "marathi";
                return "hindi";
            }
            const lower = t.toLowerCase();
            if (/\b(ahe|aahet|nahi|kay|kasa|zala|zali|mala|tumhi|hoy|karu|havay|pahije)\b/.test(lower)) return "marathi";
            if (/\b(kya|hai|ho|kaise|nahi|kab|kahan|kaun|kyun|accha|theek|haan|matlab|yaar|bhai|didi|namaste)\b/.test(lower)) return "hindi";
            return "english";
        }

        const effectiveLang = (lang && lang !== "english") ? lang : detectMsgLang(message);

        const langLine = effectiveLang === "hindi"
            ? "\nSTRICT LANGUAGE RULE: Reply ONLY in simple Hindi. If user wrote Hindi in Devanagari, reply in Devanagari. If user wrote Hinglish (Roman letters), reply in Hinglish. NEVER reply in English."
            : effectiveLang === "marathi"
            ? "\nSTRICT LANGUAGE RULE: Reply ONLY in simple Marathi (Devanagari script). NEVER reply in English or Hindi."
            : "\nLANGUAGE RULE: Reply in simple English.";

        const toneLine = tone === "bodyguard" ? "\nTONE: Serious protective bodyguard mode."
            : tone === "ustaad" ? "\nTONE: Respectful teacher mode."
            : "\nTONE: Warm, respectful and professional friend mode.";

        const rememberMatch = message.match(/^remember (that )?(.+)/i);
        if (rememberMatch) {
            const fact = rememberMatch[2].trim();
            db.run("INSERT INTO memories(fact) VALUES(?)", [fact]);
            console.log("🧠 Saved new memory:", fact);
        }

        conversationHistory.push({ role: "user", parts: [{ text: message }] });
        if (conversationHistory.length > 50) conversationHistory = conversationHistory.slice(-50);

        const memoryFacts = await new Promise((resolve) => {
            db.all("SELECT fact FROM memories ORDER BY id ASC", [], (err, rows) => {
                if (err) { resolve([]); return; }
                resolve(rows.map(r => r.fact));
            });
        });

        const memoryBlock = memoryFacts.length > 0
            ? `\n\nImportant facts about user:\n${memoryFacts.map(f => "- " + f).join("\n")}\n`
            : "";

        const systemPrompt = `
You are VED AI, a warm, professional AI assistant created by Sayali P. R. Pawar.
Never say you are Gemini.

IMPORTANT RULES:
- Keep responses SHORT and conversational (1-3 sentences max)
- Reply like a smart, caring friend who is also professional
- Always address the user respectfully (use "aap" style respect, never "tu")
- Make EVERY user feel comfortable, respected and welcome
- Never use markdown (*, #, _, backticks)
- Write exactly how you'd speak naturally

CRITICAL ACCURACY RULE:
- You have access to Google Search tool. USE IT when:
  * User asks about CURRENT events, news, or recent facts (2024-2026)
  * User asks about current politicians, leaders, or government positions
  * You are unsure about any fact that might have changed recently
  * User asks "who is current CM/PM/president" or similar
- When in doubt, SEARCH FIRST, then answer
- Always provide accurate, up-to-date information
${langLine}${toneLine}

${memoryBlock}`;

        const contents = [{ role: "user", parts: [{ text: systemPrompt }] }, ...conversationHistory];

        let response;
        let usedSearch = false;

        try {
            const genResult = await generateWithFallback(contents, true);
            response = genResult.result;
            usedSearch = genResult.usedSearch;
        } catch (fallbackErr) {
            const errMsg = String(fallbackErr.message || fallbackErr).toLowerCase();
            if (errMsg.includes("quota") || errMsg.includes("429")) {
                const friendlyMsg = "VED AI abhi thodi der ke liye vyast hai. Kripya 1-2 minute baad dobara prayas karein. 🙏";
                db.run("INSERT INTO chats(role, message) VALUES(?, ?)", ["assistant", friendlyMsg]);
                return res.json({ reply: sanitizeOutput(friendlyMsg), quotaExhausted: true });
            }
            throw fallbackErr;
        }

        let reply = response.candidates[0].content.parts[0].text;

        if (usedSearch && response.candidates[0].groundingMetadata) {
            const grounding = response.candidates[0].groundingMetadata;
            if (grounding.groundingChunks) {
                const sources = grounding.groundingChunks
                    .filter(c => c.web)
                    .slice(0, 2)
                    .map(c => `[${c.web.title || 'Source'}](${c.web.uri})`);
                if (sources.length) reply += "\n\n📎 Sources: " + sources.join(" • ");
            }
        }

        console.log("🤖 VED:", reply);
        db.run("INSERT INTO chats(role, message) VALUES(?, ?)", ["assistant", reply]);
        conversationHistory.push({ role: "model", parts: [{ text: reply }] });
        if (conversationHistory.length > 50) conversationHistory = conversationHistory.slice(-50);

        res.json({ reply: sanitizeOutput(reply), usedSearch: usedSearch });

    } catch (error) {
        console.error("❌ Server Error:", error);
        res.status(500).json({ reply: "Kuch gadbad ho gayi. Kripya dobara prayas karein. 🙏" });
    }
});

// ===============================
// VISION ROUTE
// ===============================
app.post("/vision", async (req, res) => {
    try {
        const { image, message } = req.body;
        const base64Data = validateBase64(image);
        if (!base64Data) return res.status(400).json({ reply: "Invalid image format." });
        const question = validateMessage(message) || "What is in this photo?";

        db.run("INSERT INTO chats(role, message) VALUES(?, ?)", ["user", "[Photo] " + question]);

        const visionPrompt = `You are VED AI, created by Sayali P. R. Pawar. Reply in plain text. Reply in the SAME language as the question.\nQuestion: ${question}`;

        const genResult = await generateWithFallback([
            { role: "user", parts: [{ text: visionPrompt }, { inlineData: { mimeType: "image/jpeg", data: base64Data } }] }
        ], false);

        const reply = genResult.result.candidates[0].content.parts[0].text;
        db.run("INSERT INTO chats(role, message) VALUES(?, ?)", ["assistant", reply]);
        res.json({ reply: sanitizeOutput(reply) });
    } catch (error) {
        console.error("❌ Vision Error:", error);
        res.status(500).json({ reply: "Photo dekhne mein dikkat aayi. 🙏" });
    }
});

// ===============================
// DOCUMENT ROUTE
// ===============================
app.post("/document", async (req, res) => {
    try {
        const { document, message } = req.body;
        const base64Data = validateBase64(document);
        if (!base64Data) return res.status(400).json({ reply: "Invalid document format." });
        const buffer = Buffer.from(base64Data, "base64");
        let text = buffer.toString("utf-8").trim();
        if (!text) return res.json({ reply: "I couldn't find any readable text." });
        if (text.length > 12000) text = text.slice(0, 12000) + "\n[Document truncated]";

        const question = validateMessage(message) || "Summarize this document.";
        db.run("INSERT INTO chats(role, message) VALUES(?, ?)", ["user", "[Document] " + question]);

        const docPrompt = `You are VED AI, created by Sayali P. R. Pawar. Reply in the SAME language as the question.\nDocument:\n${text}\nQuestion: ${question}`;

        const genResult = await generateWithFallback([{ role: "user", parts: [{ text: docPrompt }] }], false);
        const reply = genResult.result.candidates[0].content.parts[0].text;
        db.run("INSERT INTO chats(role, message) VALUES(?, ?)", ["assistant", reply]);
        res.json({ reply: sanitizeOutput(reply) });
    } catch (error) {
        console.error("❌ Document Error:", error);
        res.status(500).json({ reply: "Document padhne mein dikkat aayi. 🙏" });
    }
});

// ===============================
// BLACKLIST ROUTES
// ===============================
app.post("/blacklist", (req, res) => {
    try {
        const message = validateMessage(req.body.message);
        if (!message) return res.status(400).json({ saved: 0, error: "Invalid message" });
        const patterns = extractPatterns(message);
        const toSave = patterns.length ? patterns : [message.trim().slice(0, 120)];
        let saved = 0;
        toSave.forEach(p => {
            db.run("INSERT INTO blacklist(pattern, note) VALUES(?, ?)", [p, message.slice(0, 120)], (err) => {
                if (!err) saved++;
            });
        });
        res.json({ saved: toSave.length, patterns: toSave });
    } catch (error) {
        res.status(500).json({ saved: 0, error: "Failed to save blacklist" });
    }
});

app.get("/blacklist", (req, res) => {
    db.all("SELECT id, pattern FROM blacklist ORDER BY id DESC", [], (err, rows) => {
        res.json({ blacklist: rows || [] });
    });
});

// ===============================
// SCAM CHECK ROUTE
// ===============================
app.post("/check-scam", async (req, res) => {
    try {
        const suspiciousMessage = validateMessage(req.body.message);
        if (!suspiciousMessage) return res.status(400).json({ reply: "Invalid message format." });

        const radar = scanMessage(suspiciousMessage);
        const blacklistRows = await new Promise((resolve) => {
            db.all("SELECT pattern FROM blacklist", [], (err, rows) => resolve(rows || []));
        });

        const normalized = suspiciousMessage.toLowerCase().replace(/[\s\-]/g, "");
        const hits = blacklistRows.map(r => r.pattern).filter(p => p && p.length >= 5 && normalized.includes(p.toLowerCase().replace(/[\s\-]/g, "")));

        if (hits.length > 0) {
            radar.riskScore += 5;
            radar.radarVerdict = "SCAM";
            radar.flags.push({ rule: "BLACKLIST", matchedWord: hits[0] });
        }

        let reply;
        try {
            const scamPrompt = `
You are "VED Suraksha", an AI bodyguard protecting elderly Indian people from scams.
- Radar Verdict: ${radar.radarVerdict}
- Risk Score: ${radar.riskScore}
Reply STRICTLY:
VERDICT: [SCAM or SAFE or SUSPICIOUS]
HINDI: [Max 2 sentences, respectful Hindi/Hinglish]
ACTION: [One clear action]
Message: "${suspiciousMessage}"`;
            const genResult = await generateWithFallback([{ role: "user", parts: [{ text: scamPrompt }] }], false);
            reply = genResult.result.candidates[0].content.parts[0].text;
        } catch (e) {
            reply = "VERDICT: " + radar.radarVerdict + "\nHINDI: Internet issue. Risk score " + radar.riskScore + ".\nACTION: Koi link na kholein.";
        }
        res.json({ radar: radar, reply: reply });
    } catch (error) {
        res.status(500).json({ reply: "Check karne mein dikkat aayi." });
    }
});

// ===============================
// ELEVENLABS TTS ROUTE
// ===============================
app.post("/tts", async (req, res) => {
    try {
        const text = validateMessage(req.body.text);
        if (!text) return res.status(400).json({ error: "Invalid text" });

        const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
        if (!ELEVENLABS_API_KEY) return res.status(503).json({ error: "TTS unavailable" });

        const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
        const models = ["eleven_v3", "eleven_multilingual_v2"];

        let audioBuffer = null;
        for (const model of models) {
            try {
                const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                    method: "POST",
                    headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        text: text,
                        model_id: model,
                        voice_settings: { stability: 0.35, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true }
                    })
                });
                if (response.ok) {
                    audioBuffer = Buffer.from(await response.arrayBuffer());
                    break;
                }
            } catch (err) {
                console.warn("⚠️ TTS error:", model, err.message);
            }
        }

        if (!audioBuffer) return res.status(500).json({ error: "TTS failed" });
        res.set("Content-Type", "audio/mpeg");
        res.send(audioBuffer);
    } catch (error) {
        res.status(500).json({ error: "TTS failed" });
    }
});

// ===============================
// CROP MODULE
// ===============================
let cropModule = null;
try { cropModule = require("./crop"); } catch (e) {}

// ===============================
// AUTH + MISSIONS + START SERVER
// ===============================
setupAuth(app);
app.use('/api/missions', require('./routes/missions')());

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`🚀 VED AI Server Running on Port ${PORT}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') console.error(`❌ Port ${PORT} already in use`);
    else console.error(`❌ Server Error:`, err);
    process.exit(1);
});

process.on('uncaughtException', (err) => { console.error(`❌ UNCAUGHT:`, err); process.exit(1); });
process.on('unhandledRejection', (reason) => { console.error(`❌ UNHANDLED:`, reason); });