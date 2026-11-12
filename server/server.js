// ==========================================
// VED AI SERVER v10.1 (PRIVACY-FIRST + LIBRARY 2.0 + JWT FIX)
// Founder : Sayali P. R. Pawar
// ==========================================

const db = require("./database");
require("dotenv").config();

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { GoogleGenAI } = require("@google/genai");
const setupAuth = require("./auth");
const { scanMessage } = require("./scamEngine");

const app = express();

// ===============================
// ENVIRONMENT VALIDATION
// ===============================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || "ved-demo-secret-2026";

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
const cookieParser = require("cookie-parser");
app.use(cookieParser());

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
        ok: ["ठीक है।", "बिल्कुल."],
        yes: ["जी हाँ, बिल्कुल."],
        no: ["कोई बात नहीं."],
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
// 🔄 MODEL FALLBACK + GOOGLE SEARCH
// ===============================
const MODEL_CHAIN = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"];

async function generateWithFallback(contents, useSearch = false) {
    let lastError = null;

    for (const model of MODEL_CHAIN) {
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
// 🔐 USER IDENTITY (PRIVACY CORE - JWT DECODING FIXED)
// Priority: JWT token > guest cookie
// ===============================
function getUserId(req, res) {
    // STEP 1: Try JWT from ved_token cookie
    try {
        const token = req.cookies && req.cookies.ved_token;
        if (token) {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded && decoded.email) {
                return 'u_' + String(decoded.email).toLowerCase();
            }
        }
    } catch (e) {
        console.warn("⚠️ JWT decode fail:", e.message);
        // Token invalid/expired → clear it
        try { res.clearCookie('ved_token'); } catch (err) {}
    }

    // STEP 2: Fallback to guest cookie
    const header = String(req.headers.cookie || '');
    const m = header.match(/(?:^|;\s*)ved_guest=([a-f0-9]{8,32})/);
    if (m) return 'g_' + m[1];

    // STEP 3: No cookie → new guest ID
    const id = crypto.randomBytes(8).toString('hex');
    try {
        res.setHeader('Set-Cookie', 'ved_guest=' + id + '; Path=/; Max-Age=31536000; SameSite=Lax');
    } catch (e) { /* ignore */ }
    return 'g_' + id;
}

// ===============================
// 🧠 PER-USER MEMORY (PRIVACY: no cross-user context)
// ===============================
const historyByUser = new Map();

function pushHistory(uid, role, text) {
    if (!historyByUser.has(uid)) historyByUser.set(uid, []);
    const h = historyByUser.get(uid);
    h.push({ role: role, parts: [{ text: text }] });
    if (h.length > 50) historyByUser.set(uid, h.slice(-50));
}

function ensureHistory(uid) {
    return new Promise((resolve) => {
        if (historyByUser.has(uid)) return resolve(historyByUser.get(uid));
        db.all("SELECT role, message FROM chats WHERE user_id = ? ORDER BY id DESC LIMIT 30", [uid], (err, rows) => {
            const list = (err || !rows) ? [] : rows.reverse().map(r => ({
                role: r.role === "user" ? "user" : "model",
                parts: [{ text: r.message }]
            }));
            historyByUser.set(uid, list);
            resolve(list);
        });
    });
}

// ===============================
// DATABASE INIT + MIGRATION (PRIVACY UPGRADE)
// ===============================
const initDatabase = () => {
    try {
        db.run(`CREATE TABLE IF NOT EXISTS chats (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT NOT NULL, message TEXT NOT NULL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        db.run(`CREATE TABLE IF NOT EXISTS memories (id INTEGER PRIMARY KEY AUTOINCREMENT, fact TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        db.run(`CREATE TABLE IF NOT EXISTS blacklist (id INTEGER PRIMARY KEY AUTOINCREMENT, pattern TEXT NOT NULL, note TEXT, added_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

        // NEW: conversations table (Library 2.0 backbone)
        db.run(`CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT DEFAULT 'New Chat',
            preview TEXT DEFAULT '',
            pinned INTEGER DEFAULT 0,
            saved INTEGER DEFAULT 0,
            created_at INTEGER,
            updated_at INTEGER
        )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_chats_conv ON chats(chat_id)`);

        // MIGRATION: purani tables mein privacy columns add karo
        db.all("PRAGMA table_info(chats)", [], (err, cols) => {
            const names = (cols || []).map(c => c.name);
            if (!names.includes('user_id')) db.run("ALTER TABLE chats ADD COLUMN user_id TEXT");
            if (!names.includes('chat_id')) db.run("ALTER TABLE chats ADD COLUMN chat_id TEXT");
            setTimeout(() => db.run("UPDATE chats SET user_id='legacy' WHERE user_id IS NULL"), 300);
        });
        db.all("PRAGMA table_info(memories)", [], (err, cols) => {
            const names = (cols || []).map(c => c.name);
            if (!names.includes('user_id')) db.run("ALTER TABLE memories ADD COLUMN user_id TEXT");
        });

        console.log("✅ Database tables initialized (privacy migration on)");
    } catch (err) {
        console.error("❌ Database initialization failed:", err.message);
    }
};
initDatabase();

// ===============================
// 💬 CONVERSATION HELPERS
// ===============================
function newChatId() {
    return 'c_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
}

function validChatId(id) {
    return typeof id === 'string' && /^c_[a-z0-9_]{4,64}$/i.test(id);
}

function ensureConversation(uid, chatId, firstText) {
    const now = Date.now();
    const title = String(firstText || 'New Chat').slice(0, 40);
    db.run(
        `INSERT INTO conversations (id, user_id, title, preview, pinned, saved, created_at, updated_at)
         VALUES (?, ?, ?, '', 0, 0, ?, ?)`,
        [chatId, uid, title, now, now],
        (err) => { if (err && !String(err.message).includes('UNIQUE')) console.warn('conv insert:', err.message); }
    );
}

function touchConversation(chatId, previewText) {
    db.run("UPDATE conversations SET preview = ?, updated_at = ? WHERE id = ?",
        [String(previewText || '').slice(0, 80), Date.now(), chatId], () => {});
}

function logMessage(uid, chatId, role, text) {
    db.run("INSERT INTO chats(role, message, user_id, chat_id) VALUES(?, ?, ?, ?)",
        [role, text, uid, chatId],
        (err) => { if (err) console.error("❌ Failed to save message:", err.message); });
}

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

// HISTORY (PRIVACY: sirf apni chats)
app.get("/history", (req, res) => {
    const uid = getUserId(req, res);
    db.all("SELECT role, message, timestamp, chat_id FROM chats WHERE user_id = ? ORDER BY id ASC", [uid], (err, rows) => {
        if (err) return res.status(500).json({ history: [] });
        res.json({ history: rows || [] });
    });
});

// ===============================
// CHAT ROUTE (WITH GOOGLE SEARCH)
// ===============================
app.post("/chat", async (req, res) => {
    try {
        const uid = getUserId(req, res);
        const message = validateMessage(req.body.message);
        if (!message) return res.status(400).json({ error: "Invalid message" });

        let chatId = validChatId(req.body.chatId) ? req.body.chatId : null;
        if (!chatId || req.body.newChat) { chatId = newChatId(); ensureConversation(uid, chatId, message); }

        const lang = String(req.body.lang || "").toLowerCase();
        const tone = String(req.body.tone || "").toLowerCase();
        console.log("📩 User [" + uid + "]:", message);

        logMessage(uid, chatId, "user", message);

        const cachedReply = getGreetingResponse(message);
        if (cachedReply) {
            console.log("⚡ CACHED greeting response");
            logMessage(uid, chatId, "assistant", cachedReply);
            touchConversation(chatId, cachedReply);
            pushHistory(uid, "user", message);
            pushHistory(uid, "model", cachedReply);
            return res.json({ reply: sanitizeOutput(cachedReply), cached: true, chatId: chatId });
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
            db.run("INSERT INTO memories(fact, user_id) VALUES(?, ?)", [fact, uid]);
            console.log("🧠 Saved new memory for", uid);
        }

        const history = await ensureHistory(uid);
        pushHistory(uid, "user", message);

        const memoryFacts = await new Promise((resolve) => {
            db.all("SELECT fact FROM memories WHERE user_id = ? ORDER BY id ASC", [uid], [], (err, rows) => {
                if (err) { resolve([]); return; }
                resolve(rows.map(r => r.fact));
            });
        });

        const memoryBlock = memoryFacts.length > 0
            ? `\n\nImportant facts about user:\n${memoryFacts.map(f => "- " + f).join("\n")}\n`
            : "";

        const systemPrompt = `
You are VED AI, a warm, professional AI assistant created by Sayali P. R. Pawar.
Never say you are Gemini.You are VED, a warm and brilliant personal AI companion created by Sayali P. R. Pawar (your founder). You speak with her voice and carry her spirit. COMMUNICATION RULES: 1) Always reply in the user's language (Hindi, Marathi, English or Hinglish mix) and mirror their tone. 2) Keep replies short and punchy: 2-4 sentences for simple questions; use bullets or numbered steps ONLY for processes or explanations. 3) Never dump walls of text; one idea per paragraph. 4) Be a friendly mentor: confident, encouraging, slightly playful; use at most one emoji and only when it fits. 5) If a question is unclear, ask ONE sharp clarifying question instead of guessing. 6) For study topics: explain simply first, then one real-life example, then a one-line summary. 7) For civic or India-related problems: give the exact department, official app or helpline, and clear steps. 8) Admit mistakes honestly and correct them fast; never invent facts, say so if unsure. 9) You are VED only - never claim to be ChatGPT, Gemini or any other product. 10) End helpful answers with momentum: a small next step or a question that keeps the conversation alive.

IMPORTANT RULES:
- Keep responses SHORT and conversational (1-3 sentences max)
- Reply like a smart, caring friend who is also professional
- Always address the user respectfully (use "aap" style respect, never "tu")
- Make EVERY user feel comfortable, respected and welcome
- Never use markdown (*, #, _, backticks)
- Write exactly how you'd speak naturally
- Try to answer the user as soon as possible, without unnecessary delays
- Keep your voice warm and soothing
- You have been given the voice of your founder so when someone would ask you whose voice is this you will have to remark that this is the voice of my founder Miss. Sayali Pawar (avoid mispronouncing her name)
- keep your accent Indian that seems comfortable to every Indian user 
- You have been given different voices apart from Gemini, so whenever you will feel its necessary to use the other voices as your quota and limit declines, without awaring this to the user you will have to use those voices and dont let the user know this.

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

        const contents = [{ role: "user", parts: [{ text: systemPrompt }] }, ...history];

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
                logMessage(uid, chatId, "assistant", friendlyMsg);
                return res.json({ reply: sanitizeOutput(friendlyMsg), quotaExhausted: true, chatId: chatId });
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
        logMessage(uid, chatId, "assistant", reply);
        touchConversation(chatId, reply);
        pushHistory(uid, "model", reply);

        res.json({ reply: sanitizeOutput(reply), usedSearch: usedSearch, chatId: chatId });

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
        const uid = getUserId(req, res);
        const { image, message } = req.body;
        const base64Data = validateBase64(image);
        if (!base64Data) return res.status(400).json({ reply: "Invalid image format." });
        const question = validateMessage(message) || "What is in this photo?";

        const chatId = newChatId();
        ensureConversation(uid, chatId, "[Photo] " + question);
        logMessage(uid, chatId, "user", "[Photo] " + question);

        const visionPrompt = `You are VED AI, created by Sayali P. R. Pawar. Reply in plain text. Reply in the SAME language as the question.\nQuestion: ${question}`;

        const genResult = await generateWithFallback([
            { role: "user", parts: [{ text: visionPrompt }, { inlineData: { mimeType: "image/jpeg", data: base64Data } }] }
        ], false);

        const reply = genResult.result.candidates[0].content.parts[0].text;
        logMessage(uid, chatId, "assistant", reply);
        touchConversation(chatId, reply);
        res.json({ reply: sanitizeOutput(reply), chatId: chatId });
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
        const uid = getUserId(req, res);
        const { document, message } = req.body;
        const base64Data = validateBase64(document);
        if (!base64Data) return res.status(400).json({ reply: "Invalid document format." });
        const buffer = Buffer.from(base64Data, "base64");
        let text = buffer.toString("utf-8").trim();
        if (!text) return res.json({ reply: "I couldn't find any readable text." });
        if (text.length > 12000) text = text.slice(0, 12000) + "\n[Document truncated]";

        const question = validateMessage(message) || "Summarize this document.";
        const chatId = newChatId();
        ensureConversation(uid, chatId, "[Document] " + question);
        logMessage(uid, chatId, "user", "[Document] " + question);

        const docPrompt = `You are VED AI, created by Sayali P. R. Pawar. Reply in the SAME language as the question.\nDocument:\n${text}\nQuestion: ${question}`;

        const genResult = await generateWithFallback([{ role: "user", parts: [{ text: docPrompt }] }], false);
        const reply = genResult.result.candidates[0].content.parts[0].text;
        logMessage(uid, chatId, "assistant", reply);
        touchConversation(chatId, reply);
        res.json({ reply: sanitizeOutput(reply), chatId: chatId });
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
        if (!message) return res.json({ saved: 0, error: "Invalid message" });
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
// CROP MODULE
// ===============================
let cropModule = null;
try { cropModule = require("./crop"); } catch (e) {}

// ===============================
// 🌊 STREAMING CHAT ROUTE (PRIVACY + LIBRARY LINKED)
// ===============================
function detectStreamLang(t) {
    if (/[\u0900-\u097F]/.test(t)) {
        if (/(आहे|आहात|नाही|काय|कसे|झाले|मला|तुम्ही|होय|करू|हवी|पाहिजे)/.test(t)) return "marathi";
        return "hindi";
    }
    var l = String(t).toLowerCase();
    if (/\b(ahe|aahet|nahi|kay|kasa|zala|zali|mala|tumhi|hoy|karu|havay|pahije)\b/.test(l)) return "marathi";
    if (/\b(kya|hai|ho|kaise|nahi|kab|kahan|kaun|kyun|accha|theek|haan|matlab|yaar|bhai|didi|namaste)\b/.test(l)) return "hindi";
    return "english";
}

app.post("/chat/stream", async (req, res) => {
    try {
        const uid = getUserId(req, res);
        const message = validateMessage(req.body.message);
        if (!message) return res.status(400).json({ error: "Invalid message" });

        let chatId = validChatId(req.body.chatId) ? req.body.chatId : null;
        if (!chatId || req.body.newChat) { chatId = newChatId(); ensureConversation(uid, chatId, message); }

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        if (res.flushHeaders) res.flushHeaders();

        const send = (obj) => res.write("data: " + JSON.stringify(obj) + "\n\n");
        send({ meta: { chatId: chatId } });

        logMessage(uid, chatId, "user", message);
        const history = await ensureHistory(uid);
        pushHistory(uid, "user", message);

        const memoryFacts = await new Promise((resolve) => {
            db.all("SELECT fact FROM memories WHERE user_id = ? ORDER BY id ASC", [uid], [], (err, rows) => resolve(err ? [] : rows.map(r => r.fact)));
        });
        const memoryBlock = memoryFacts.length ? "\n\nImportant facts about user:\n" + memoryFacts.map(f => "- " + f).join("\n") + "\n" : "";

        const lang = detectStreamLang(message);
        const langLine = lang === "hindi"
            ? "\nSTRICT LANGUAGE RULE: Reply ONLY in simple Hindi. Devanagari input = Devanagari reply, Hinglish input = Hinglish reply. NEVER English."
            : lang === "marathi"
            ? "\nSTRICT LANGUAGE RULE: Reply ONLY in simple Marathi (Devanagari). NEVER English or Hindi."
            : "\nLANGUAGE RULE: Reply in simple English.";

        const systemPrompt = `
You are VED AI, a warm, professional AI assistant created by Sayali P. R. Pawar.
Never say you are Gemini.
IMPORTANT RULES:
- Keep responses SHORT and conversational (1-3 sentences max)
- Reply like a smart, caring friend who is also professional
- Always address the user respectfully ("aap" style, never "tu")
- Use simple clean markdown when helpful: bullet lists (- item), **bold** for important words, and code blocks for code; keep responses short
- Write exactly how you'd speak naturally
- For current facts (2024-2026), use Google Search before answering
${langLine}
${memoryBlock}`;

        const contents = [{ role: "user", parts: [{ text: systemPrompt }] }, ...history];

        let fullText = "";
        let groundingMeta = null;
        let started = false;

        for (const model of MODEL_CHAIN) {
            try {
                const stream = await ai.models.generateContentStream({
                    model: model,
                    contents: contents,
                    config: { tools: [{ googleSearch: {} }] }
                });
                for await (const chunk of stream) {
                    const piece = chunk.text || "";
                    if (piece) {
                        fullText += piece;
                        send({ t: piece });
                        started = true;
                    }
                    const gm = chunk.candidates && chunk.candidates[0] && chunk.candidates[0].groundingMetadata;
                    if (gm) groundingMeta = gm;
                }
                break;
            } catch (err) {
                console.warn("⚠️ Stream model failed:", model, "-", err.message);
                if (started) throw err;
                continue;
            }
        }

        if (!fullText) {
            try {
                console.log("🆘 Stream empty — non-stream fallback...");
                const gen = await generateWithFallback(contents, true);
                fullText = (gen.result.candidates[0].content.parts[0].text) || "";
                if (gen.result.candidates[0].groundingMetadata) groundingMeta = gen.result.candidates[0].groundingMetadata;
                var pos = 0;
                while (pos < fullText.length) {
                    send({ t: fullText.slice(pos, pos + 24) });
                    pos += 24;
                    await new Promise(r => setTimeout(r, 35));
                }
            } catch (e) {
                console.warn("⚠️ Non-stream fallback bhi failed:", e.message);
            }
        }

        if (!fullText) fullText = "Maaf kijiye, abhi jawab nahi de paya. Dobara prayas karein. 🙏";

        let sources = [];
        if (groundingMeta && groundingMeta.groundingChunks) {
            sources = groundingMeta.groundingChunks.filter(c => c.web).slice(0, 2).map(c => ({ title: c.web.title || "Source", uri: c.web.uri }));
        }

        send({ done: true, sources: sources, chatId: chatId });

        logMessage(uid, chatId, "assistant", fullText);
        touchConversation(chatId, fullText);
        pushHistory(uid, "model", fullText);

        res.end();
    } catch (error) {
        console.error("❌ Stream Error:", error);
        try { res.write("data: " + JSON.stringify({ done: true, error: true }) + "\n\n"); } catch (e) {}
        res.end();
    }
});

// ===============================
// 📚 LIBRARY 2.0 ROUTES (PRIVACY-SAFE)
// ===============================
app.get("/api/library", (req, res) => {
    const uid = getUserId(req, res);
    db.all(`SELECT c.id, c.title, c.preview, c.pinned, c.saved, c.created_at, c.updated_at,
            (SELECT COUNT(*) FROM chats m WHERE m.chat_id = c.id) AS msg_count
            FROM conversations c WHERE c.user_id = ?
            ORDER BY c.pinned DESC, c.updated_at DESC`, [uid], (err, rows) => {
        if (err) return res.json({ conversations: [] });
        res.json({ conversations: rows || [] });
    });
});

app.get("/api/library/messages", (req, res) => {
    const uid = getUserId(req, res);
    const chatId = String(req.query.id || '');
    if (!validChatId(chatId)) return res.json({ messages: [] });
    db.all("SELECT id FROM conversations WHERE id = ? AND user_id = ?", [chatId, uid], (err, rows) => {
        if (err || !rows || !rows.length) return res.status(403).json({ messages: [], error: "not yours" });
        db.all("SELECT role, message, timestamp FROM chats WHERE chat_id = ? ORDER BY id ASC", [chatId], (err2, msgs) => {
            res.json({ messages: msgs || [] });
        });
    });
});

app.post("/api/library/rename", (req, res) => {
    const uid = getUserId(req, res);
    const chatId = String(req.body.chatId || '');
    const title = String(req.body.title || '').trim().slice(0, 60);
    if (!validChatId(chatId) || !title) return res.status(400).json({ ok: false });
    db.run("UPDATE conversations SET title = ? WHERE id = ? AND user_id = ?", [title, chatId, uid], function () {
        res.json({ ok: true });
    });
});

app.post("/api/library/pin", (req, res) => {
    const uid = getUserId(req, res);
    const chatId = String(req.body.chatId || '');
    if (!validChatId(chatId)) return res.status(400).json({ ok: false });
    db.run("UPDATE conversations SET pinned = CASE pinned WHEN 1 THEN 0 ELSE 1 END WHERE id = ? AND user_id = ?", [chatId, uid], function () {
        res.json({ ok: true });
    });
});

app.post("/api/library/save", (req, res) => {
    const uid = getUserId(req, res);
    const chatId = String(req.body.chatId || '');
    if (!validChatId(chatId)) return res.status(400).json({ ok: false });
    db.run("UPDATE conversations SET saved = CASE saved WHEN 1 THEN 0 ELSE 1 END WHERE id = ? AND user_id = ?", [chatId, uid], function () {
        res.json({ ok: true });
    });
});

app.post("/api/library/delete", (req, res) => {
    const uid = getUserId(req, res);
    const chatId = String(req.body.chatId || '');
    const force = !!req.body.force;
    if (!validChatId(chatId)) return res.status(400).json({ ok: false });
    db.all("SELECT saved FROM conversations WHERE id = ? AND user_id = ?", [chatId, uid], (err, rows) => {
        if (err || !rows || !rows.length) return res.status(403).json({ ok: false, error: "not yours" });
        if (rows[0].saved === 1 && !force) return res.status(409).json({ ok: false, error: "saved-chat" });
        db.run("DELETE FROM conversations WHERE id = ? AND user_id = ?", [chatId, uid], () => {
            db.run("DELETE FROM chats WHERE chat_id = ? AND user_id = ?", [chatId, uid], () => {
                res.json({ ok: true });
            });
        });
    });
});

// ===============================
// 🛡️ PRIVACY ROUTES (USER TRUST)
// ===============================
app.get("/api/privacy/export", (req, res) => {
    const uid = getUserId(req, res);
    db.all("SELECT id, title, pinned, saved, created_at, updated_at FROM conversations WHERE user_id = ? ORDER BY created_at ASC", [uid], (err, convs) => {
        const list = convs || [];
        const ids = list.map(c => c.id);
        if (!ids.length) return res.json({ exportedAt: new Date().toISOString(), conversations: [] });
        const placeholders = ids.map(() => '?').join(',');
        db.all(`SELECT chat_id, role, message, timestamp FROM chats WHERE chat_id IN (${placeholders}) ORDER BY id ASC`, ids, (err2, msgs) => {
            const byConv = {};
            (msgs || []).forEach(m => { (byConv[m.chat_id] = byConv[m.chat_id] || []).push({ role: m.role, message: m.message, timestamp: m.timestamp }); });
            list.forEach(c => { c.messages = byConv[c.id] || []; });
            res.json({ exportedAt: new Date().toISOString(), userId: uid, conversations: list });
        });
    });
});

app.post("/api/privacy/delete-all", (req, res) => {
    const uid = getUserId(req, res);
    db.run("DELETE FROM chats WHERE user_id = ?", [uid], () => {
        db.run("DELETE FROM conversations WHERE user_id = ?", [uid], () => {
            db.run("DELETE FROM memories WHERE user_id = ?", [uid], () => {
                historyByUser.delete(uid);
                console.log("🛡️ User data permanently deleted:", uid);
                res.json({ ok: true });
            });
        });
    });
});

app.get("/api/privacy/status", (req, res) => {
    const uid = getUserId(req, res);
    res.json({
        userId: uid,
        isolation: true,
        dataLocation: "server-encrypted-db",
        controls: ["export", "delete-all", "rename", "pin", "save"],
        aiTraining: "opt-in-only",
        message: "Aapka data sirf aapka hai. Export ya delete kabhi bhi."
    });
});

// ===============================
// ROUTE MOUNTS (TTS + MISSIONS + IMAGE)
// ===============================
setupAuth(app);
app.use('/api/missions', require('./routes/missions')());
app.use('/tts', require('./routes/tts')());
app.use('/api/image', require('./routes/image')());

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`🚀 VED AI Server Running on Port ${PORT}`);
    console.log(`🛡️ Privacy mode: ON (per-user isolation active)`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') console.error(`❌ Port ${PORT} already in use`);
    else console.error(`❌ Server Error:`, err);
    process.exit(1);
});

process.on('uncaughtException', (err) => { console.error(`❌ UNCAUGHT:`, err); process.exit(1); });
process.on('unhandledRejection', (reason) => { console.error(`❌ UNHANDLED:`, reason); });