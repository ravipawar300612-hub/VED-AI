// ==========================================
// VED AI SERVER v8.6 (TRILINGUAL + QUOTA SAVER)
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
// CORS - Restrict to specific origins in production
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    process.env.FRONTEND_URL || ''
].filter(Boolean);

app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? allowedOrigins : true,
    credentials: true
}));

// Security Headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

app.use(express.json({ limit: "10mb" }));

// AUTO-DETECT client folder
const clientCandidates = [
    path.join(__dirname, "client"),
    path.join(__dirname, "..", "client"),
    path.join(__dirname, "..", "..", "client")
];
const CLIENT_PATH = clientCandidates.find(p => fs.existsSync(path.join(p, "index.html")));
console.log("📁 Frontend folder detected at:", CLIENT_PATH);

if (!CLIENT_PATH) {
    console.error("❌ CRITICAL: Client folder not found! Server cannot serve frontend.");
    process.exit(1);
}

app.use(express.static(CLIENT_PATH));

// Gemini AI setup
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// ===============================
// 🌐 LANGUAGE DETECTOR
// ===============================
function detectLanguage(text) {
    const t = String(text || "");
    const lower = t.toLowerCase();

    // Devanagari script
    if (/[\u0900-\u097F]/.test(t)) {
        if (/(आहे|आहात|नाही|काय|कसे|कशी|झाले|झाली|मला|तुम्ही|होय|जावो|करू|हवी)/.test(t)) return "marathi";
        return "hindi";
    }
    // Latin script Marathi (Hinglish-Marathi)
    if (/\b(kasa|kahasa|zala|zali|zale|tuza|tumhi|nako|ahes|ahet|havi|karu)\b/.test(lower)) return "marathi";
    // Latin script Hindi / Hinglish
    if (/\b(kaise|kaisa|kya|hai|ho|namaste|namaskar|shukriya|dhanyavad|theek|accha|acha|haan|nahi|yaar|bhai|didi|matlab)\b/.test(lower)) return "hindi";
    return "english";
}

function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ===============================
// ⚡ SMART GREETING CACHE (Quota Saver #1) — TRILINGUAL
// ===============================
const CANNED_RESPONSES = {
    english: {
        greeting: [
            "Hello! I'm VED AI. How may I help you today?",
            "Hi there! Welcome. Please go ahead with your question.",
            "Greetings! I'm here to assist you. What can I do for you?"
        ],
        howAreYou: [
            "I'm doing great, thank you for asking! How can I assist you today?",
            "All good on my side! Please tell me how I can help you."
        ],
        thanks: [
            "You're most welcome! Feel free to ask if you need anything else.",
            "It's my pleasure! I'm here whenever you need help."
        ],
        bye: [
            "Goodbye! I'm here whenever you need me.",
            "Take care! It was nice assisting you."
        ],
        loveYou: [
            "Thank you so much! It's truly a pleasure to assist you.",
            "That's very kind of you! I'm always here to help."
        ],
        ok: ["Sure.", "Understood.", "Alright."],
        yes: ["Yes, absolutely.", "Of course."],
        no: ["No problem at all.", "That's perfectly fine."],
        busy: [
            "I'm fully available to help you. Please go ahead with your question.",
            "I'm ready to assist you. What would you like to ask?"
        ]
    },
    hindi: {
        greeting: [
            "नमस्ते! मैं VED AI हूँ। बताइए, आज मैं आपकी कैसे मदद कर सकता हूँ?",
            "नमस्कार! आपका स्वागत है। कृपया अपना सवाल पूछिए।",
            "हैलो! मैं आपकी सेवा में हाज़िर हूँ। बताइए क्या मदद करूँ?"
        ],
        howAreYou: [
            "मैं बिल्कुल ठीक हूँ, धन्यवाद! आप सुनाइए, मैं आपकी क्या मदद कर सकता हूँ?",
            "सब बढ़िया है! आप बताइए, आज मैं आपके लिए क्या कर सकता हूँ?"
        ],
        thanks: [
            "आपका स्वागत है! और कोई सवाल हो तो ज़रूर पूछिए।",
            "कोई बात नहीं! यह तो मेरा काम है। और कुछ चाहिए तो बताइए।"
        ],
        bye: [
            "अलविदा! जब भी ज़रूरत हो, मैं यहीं हूँ।",
            "फिर मिलेंगे! आपका दिन शुभ हो।"
        ],
        loveYou: [
            "आपका बहुत-बहुत धन्यवाद! आपकी मदद करना मेरे लिए खुशी की बात है।",
            "यह सुनकर मन खुश हो गया! मैं हमेशा आपकी सेवा में हूँ।"
        ],
        ok: ["ठीक है।", "समझ गया।", "बिल्कुल।"],
        yes: ["जी हाँ, बिल्कुल।", "हाँ, ज़रूर।"],
        no: ["कोई बात नहीं।", "ठीक है, चिंता की कोई बात नहीं।"],
        busy: [
            "मैं आपकी मदद के लिए पूरी तरह उपलब्ध हूँ। बताइए, क्या सवाल है आपका?",
            "मैं तैयार हूँ आपकी सेवा के लिए। बताइए क्या मदद चाहिए?"
        ]
    },
    marathi: {
        greeting: [
            "नमस्कार! मी VED AI आहे. सांगा, आज मी तुमची कशी मदत करू शकतो?",
            "नमस्कार! तुमचं स्वागत आहे. कृपया तुमचा प्रश्न विचारा.",
            "हॅलो! मी तुमच्या सेवेत हजर आहे. बोला, काय मदत करू?"
        ],
        howAreYou: [
            "मी एकदम ठीक आहे, धन्यवाद! तुम्ही सांगा, मी तुमची काय मदत करू शकतो?",
            "सर्व छान आहे! तुम्ही बोला, आज मी तुमच्यासाठी काय करू शकतो?"
        ],
        thanks: [
            "तुमचं स्वागत आहे! आणखी काही प्रश्न असल्यास नक्की विचारा.",
            "काही नाही! हे तर माझं काम आहे. आणखी काही हवं असल्यास सांगा."
        ],
        bye: [
            "पुन्हा भेटू! जेव्हा गरज असेल, तेव्हा मी इथेच आहे.",
            "निरोप! तुमचा दिवस शुभ जावो."
        ],
        loveYou: [
            "तुमचा खूप खूप धन्यवाद! तुमची मदत करणं माझ्यासाठी आनंदाची गोष्ट आहे.",
            "हे ऐकून खूप छान वाटलं! मी नेहमी तुमच्या सेवेत आहे."
        ],
        ok: ["ठीक आहे.", "समजलं.", "नक्की."],
        yes: ["हो, नक्की.", "हो, जरूर."],
        no: ["काही हरकत नाही.", "ठीक आहे, चिंता नको."],
        busy: [
            "मी तुमच्या मदतीसाठी पूर्णपणे उपलब्ध आहे. बोला, तुमचा प्रश्न काय आहे?",
            "मी तुमच्या सेवेसाठी तयार आहे. सांगा, काय मदत हवी आहे?"
        ]
    }
};

const GREETING_RULES = [
    { re: /^(hi+e*|hey+|hello+|yo+|hlo+|hii+)([!\s.]*)$/i, cat: "greeting" },
    { re: /^(namaste+|namaskar+|नमस्ते+|नमस्कार+)([!\s.]*)$/i, cat: "greeting" },
    { re: /^(kaise ho|kaisa hai|kya haal|how are you|what'?s up|wassup|sup|kasa aahes|kasa ahes|कैसे हो|कैसा है|तुम्ही कसे आहात)([!\s?.]*)$/i, cat: "howAreYou" },
    { re: /^(good morning|good afternoon|good evening|good night|shubh prabhat|शुभ प्रभात)([!\s.]*)$/i, cat: "greeting" },
    { re: /^(thanks|thank you|thnx|ty|shukriya|dhanyavaad|dhanyavad|धन्यवाद|शुक्रिया)([!\s.]*)$/i, cat: "thanks" },
    { re: /^(bye|goodbye|alvida|tata|see you|अलविदा|निरोप)([!\s.]*)$/i, cat: "bye" },
    { re: /^(love you|ily|i love you)([!\s.]*)$/i, cat: "loveYou" },
    { re: /^(ok|okay|theek hai|thik hai|sahi hai|ठीक है)([!\s.]*)$/i, cat: "ok" },
    { re: /^(haan|yes|yeah|yep|yup|ji haan|हो|हाँ|जी हां)([!\s.]*)$/i, cat: "yes" },
    { re: /^(nahi|no|nope|nah|नहीं|नाही)([!\s.]*)$/i, cat: "no" },
    { re: /^(kya kar rahe ho|what are you doing|busy ho|kay karat aahes|क्या कर रहे हो)([!\s?.]*)$/i, cat: "busy" }
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
// 🔄 MODEL FALLBACK (Quota Saver #2)
// ===============================
const MODEL_CHAIN = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"];

async function generateWithFallback(contents) {
    let lastError = null;
    for (const model of MODEL_CHAIN) {
        try {
            const result = await ai.models.generateContent({ model, contents });
            console.log("✅ Used model:", model);
            return result;
        } catch (err) {
            const errMsg = String(err.message || err).toLowerCase();
            if (errMsg.includes("quota") || errMsg.includes("429") || errMsg.includes("rate") || errMsg.includes("limit")) {
                console.warn("⚠️ " + model + " quota full, trying next...");
                lastError = err;
                continue;
            }
            throw err;
        }
    }
    throw lastError || new Error("All models quota exhausted");
}

// ===============================
// MEMORY (Startup se 30 messages load)
// ===============================
let conversationHistory = [];

db.all(
    "SELECT role, message FROM chats ORDER BY id DESC LIMIT 30",
    [],
    (err, rows) => {
        if (err) { console.error("❌ Failed to load chat history:", err.message); return; }
        conversationHistory = rows.reverse().map(row => ({
            role: row.role === "user" ? "user" : "model",
            parts: [{ text: row.message }]
        }));
        console.log(`🧠 Loaded ${conversationHistory.length} past messages from database.`);
    }
);

// ===============================
// DATABASE INITIALIZATION
// ===============================
// Initialize all required tables
const initDatabase = () => {
    try {
        // Chats table for conversation history
        db.run(`CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Memories table for long-term memory
        db.run(`CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fact TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Blacklist table for scam patterns
        db.run(`CREATE TABLE IF NOT EXISTS blacklist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pattern TEXT NOT NULL,
            note TEXT,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        console.log("✅ Database tables initialized");
    } catch (err) {
        console.error("❌ Database initialization failed:", err.message);
    }
};

initDatabase();

// ===============================
// INPUT VALIDATION HELPERS
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
    } catch {
        return null;
    }
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
// HOME ROUTE
// ===============================
app.get("/", (req, res) => {
    res.sendFile(path.join(CLIENT_PATH, "index.html"));
});

// ===============================
// HEALTH CHECK ENDPOINT (Railway monitoring)
// ===============================
app.get("/health", (req, res) => {
    res.json({ 
        status: "ok", 
        timestamp: new Date().toISOString(),
        port: process.env.PORT || 3000,
        ai_ready: !!ai
    });
});

// ===============================
// HISTORY ROUTE
// ===============================
app.get("/history", (req, res) => {
    db.all("SELECT role, message FROM chats ORDER BY id ASC", [], (err, rows) => {
        if (err) { console.error("❌ Failed to fetch history:", err.message); return res.status(500).json({ history: [] }); }
        res.json({ history: rows });
    });
});

// ===============================
// CHAT ROUTE (TRILINGUAL + WARM PROFESSIONAL + QUOTA SAVER)
// ===============================
app.post("/chat", async (req, res) => {
    try {
        // Validate input
        const message = validateMessage(req.body.message);
        if (!message) {
            return res.status(400).json({ error: "Invalid message" });
        }
        
        const lang = String(req.body.lang || "").toLowerCase();
        const tone = String(req.body.tone || "").toLowerCase();
        console.log("📩 User:", message);

        db.run("INSERT INTO chats(role, message) VALUES(?, ?)", ["user", message], (err) => {
            if (err) console.error("❌ Failed to save user message:", err.message);
        });

        // ⚡ SMART CACHE — greetings ke liye 0 API call (trilingual)
        const cachedReply = getGreetingResponse(message);
        if (cachedReply) {
            console.log("⚡ CACHED greeting response (quota saved!)");
            db.run("INSERT INTO chats(role, message) VALUES(?, ?)", ["assistant", cachedReply], (err) => {
                if (err) console.error("❌ Failed to save cached reply:", err.message);
            });
            // Only keep last 50 messages in memory
            conversationHistory.push({ role: "user", parts: [{ text: message }] });
            conversationHistory.push({ role: "model", parts: [{ text: cachedReply }] });
            if (conversationHistory.length > 50) conversationHistory = conversationHistory.slice(-50);
            return res.json({ reply: sanitizeOutput(cachedReply), cached: true });
        }

        // Client ne explicit language bheji toh wo priority
        const langLine = lang === "hindi" ? "\nLANGUAGE RULE: Reply ONLY in simple Hindi (Devanagari script)."
            : lang === "marathi" ? "\nLANGUAGE RULE: Reply ONLY in simple Marathi (Devanagari script)."
            : lang === "english" ? "\nLANGUAGE RULE: Reply ONLY in simple English."
            : "\nLANGUAGE RULE (AUTO-DETECT): Detect the language AND script of the user's message and reply in the SAME language and SAME script. English message → English reply. Hindi in Devanagari → Hindi in Devanagari. Hindi/Hinglish in Latin letters → Hinglish in Latin letters. Marathi → Marathi. Mixed message → reply in the dominant language.";

        const toneLine = tone === "bodyguard" ? "\nTONE: Serious protective bodyguard mode — short, firm, safety-first."
            : tone === "ustaad" ? "\nTONE: Respectful teacher mode — clear, encouraging."
            : "\nTONE: Warm, respectful and professional friend mode — caring but polite.";

        const rememberMatch = message.match(/^remember (that )?(.+)/i);
        if (rememberMatch) {
            const fact = rememberMatch[2].trim();
            db.run("INSERT INTO memories(fact) VALUES(?)", [fact]);
            console.log("🧠 Saved new long-term memory:", fact);
        }

        conversationHistory.push({ role: "user", parts: [{ text: message }] });
        if (conversationHistory.length > 50) conversationHistory = conversationHistory.slice(-50);

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
You are VED AI, a warm, professional AI assistant created by Sayali P. R. Pawar.
Never say you are Gemini.

IMPORTANT RULES:
- Keep responses SHORT and conversational (1-3 sentences max)
- Reply like a smart, caring friend who is also professional
- Always address the user respectfully (use "aap" style respect, never "tu")
- Make EVERY user feel comfortable, respected and welcome
- Never use markdown (*, #, _, backticks)
- Write exactly how you'd speak naturally
${langLine}${toneLine}

${memoryBlock}`;

        const contents = [{ role: "user", parts: [{ text: systemPrompt }] }, ...conversationHistory];

        let result;
        try {
            result = await generateWithFallback(contents);
        } catch (fallbackErr) {
            const errMsg = String(fallbackErr.message || fallbackErr).toLowerCase();
            if (errMsg.includes("quota") || errMsg.includes("429") || errMsg.includes("rate") || errMsg.includes("limit")) {
                console.warn("⚠️ All models quota exhausted — sending friendly message");
                const friendlyMsg = "VED AI abhi thodi der ke liye vyast hai. Kripya 1-2 minute baad dobara prayas karein. Dhanyavaad! 🙏";
                db.run("INSERT INTO chats(role, message) VALUES(?, ?)", ["assistant", friendlyMsg], (err) => {
                    if (err) console.error("❌ Failed to save quota message:", err.message);
                });
                return res.json({ reply: sanitizeOutput(friendlyMsg), quotaExhausted: true });
            }
            throw fallbackErr;
        }

        const reply = result.candidates[0].content.parts[0].text;

        console.log("🤖 VED:", reply);
        db.run("INSERT INTO chats(role, message) VALUES(?, ?)", ["assistant", reply], (err) => {
            if (err) console.error("❌ Failed to save AI reply:", err.message);
        });
        conversationHistory.push({ role: "model", parts: [{ text: reply }] });
        if (conversationHistory.length > 50) conversationHistory = conversationHistory.slice(-50);

        res.json({ reply: sanitizeOutput(reply) });

    } catch (error) {
        console.error("❌ Server Error:", error);
        res.status(500).json({ reply: "Kuch gadbad ho gayi. Kripya dobara prayas karein. 🙏" });
    }
});

// ===============================
// VISION ROUTE (trilingual + fallback)
// ===============================
app.post("/vision", async (req, res) => {
    try {
        const { image, message } = req.body;
        
        // Validate base64 image
        const base64Data = validateBase64(image);
        if (!base64Data) {
            return res.status(400).json({ reply: "Invalid image format." });
        }
        const question = validateMessage(message) || "What is in this photo? Describe it naturally.";

        console.log("📷 Photo question:", question);
        db.run("INSERT INTO chats(role, message) VALUES(?, ?)", ["user", "[Photo] " + question], (err) => {
            if (err) console.error("❌ Failed to save vision request:", err.message);
        });

        const visionPrompt = `You are VED AI, created by Sayali P. R. Pawar. Never say you are Gemini. Reply in plain, natural text only. Reply in the SAME language and script as the question. Address the user respectfully. Answer the user's question about the attached photo naturally.\nQuestion: ${question}`;

        const result = await generateWithFallback([
            { role: "user", parts: [{ text: visionPrompt }, { inlineData: { mimeType: "image/jpeg", data: base64Data } }] }
        ]);

        const reply = result.candidates[0].content.parts[0].text;
        console.log("🤖 VED (vision):", reply);
        db.run("INSERT INTO chats(role, message) VALUES(?, ?)", ["assistant", reply], (err) => {
            if (err) console.error("❌ Failed to save vision reply:", err.message);
        });
        res.json({ reply: sanitizeOutput(reply) });

    } catch (error) {
        console.error("❌ Vision Error:", error);
        res.status(500).json({ reply: "Photo dekhne mein dikkat aayi. Kripya dobara prayas karein. 🙏" });
    }
});

// ===============================
// DOCUMENT ROUTE (trilingual + fallback)
// ===============================
app.post("/document", async (req, res) => {
    try {
        const { document, message } = req.body;
        
        // Validate base64 document
        const base64Data = validateBase64(document);
        if (!base64Data) {
            return res.status(400).json({ reply: "Invalid document format." });
        }
        const buffer = Buffer.from(base64Data, "base64");

        let text = buffer.toString("utf-8").trim();
        if (!text) return res.json({ reply: "I couldn't find any readable text in that PDF." });
        if (text.length > 12000) text = text.slice(0, 12000) + "\n\n[Document truncated]";

        const question = validateMessage(message) || "Summarize this document.";
        console.log("📄 Document question:", question);
        db.run("INSERT INTO chats(role, message) VALUES(?, ?)", ["user", "[Document] " + question], (err) => {
            if (err) console.error("❌ Failed to save document request:", err.message);
        });

        const docPrompt = `You are VED AI, created by Sayali P. R. Pawar. Never say you are Gemini. Reply in plain, natural text only. Reply in the SAME language and script as the question. Address the user respectfully. Use the document content below to answer.\nDocument content:\n${text}\nQuestion: ${question}`;

        const result = await generateWithFallback([
            { role: "user", parts: [{ text: docPrompt }] }
        ]);

        const reply = result.candidates[0].content.parts[0].text;
        console.log("🤖 VED (document):", reply);
        db.run("INSERT INTO chats(role, message) VALUES(?, ?)", ["assistant", reply], (err) => {
            if (err) console.error("❌ Failed to save document reply:", err.message);
        });
        res.json({ reply: sanitizeOutput(reply) });

    } catch (error) {
        console.error("❌ Document Error:", error);
        res.status(500).json({ reply: "Document padhne mein dikkat aayi. Kripya dobara prayas karein. 🙏" });
    }
});

// ===============================
// BLACKLIST ROUTES
// ===============================
app.post("/blacklist", (req, res) => {
    try {
        const message = validateMessage(req.body.message);
        if (!message) {
            return res.status(400).json({ saved: 0, error: "Invalid message" });
        }
        
        const patterns = extractPatterns(message);
        const toSave = patterns.length ? patterns : [message.trim().slice(0, 120)];

        let saved = 0;
        toSave.forEach(p => {
            db.run("INSERT INTO blacklist(pattern, note) VALUES(?, ?)", [p, message.slice(0, 120)], (err) => {
                if (err) console.error("❌ Failed to save blacklist pattern:", err.message);
                else saved++;
            });
        });

        console.log("🚫 Blacklisted patterns:", toSave);
        res.json({ saved: toSave.length, patterns: toSave });
    } catch (error) {
        console.error("❌ Blacklist Error:", error);
        res.status(500).json({ saved: 0, error: "Failed to save blacklist" });
    }
});

app.get("/blacklist", (req, res) => {
    db.all("SELECT id, pattern FROM blacklist ORDER BY id DESC", [], (err, rows) => {
        if (err) {
            console.error("❌ Failed to fetch blacklist:", err.message);
            return res.json({ blacklist: [] });
        }
        res.json({ blacklist: rows || [] });
    });
});

// ===============================
// SCAM CHECK ROUTE (HYBRID + BLACKLIST + fallback)
// ===============================
app.post("/check-scam", async (req, res) => {
    try {
        const suspiciousMessage = validateMessage(req.body.message);
        if (!suspiciousMessage) {
            return res.status(400).json({ reply: "Invalid message format." });
        }

        console.log("🛡️ Checking:", suspiciousMessage);
        const radar = scanMessage(suspiciousMessage);

        const blacklistRows = await new Promise((resolve) => {
            db.all("SELECT pattern FROM blacklist", [], (err, rows) => {
                if (err) {
                    console.error("❌ Failed to fetch blacklist:", err.message);
                    resolve([]);
                } else {
                    resolve(rows || []);
                }
            });
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

            const result = await generateWithFallback([
                { role: "user", parts: [{ text: scamPrompt }] }
            ]);
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
// ELEVENLABS TTS ROUTE
// ===============================
app.post("/tts", async (req, res) => {
    try {
        const text = validateMessage(req.body.text);
        if (!text) return res.status(400).json({ error: "Invalid text provided" });

        const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
        if (!ELEVENLABS_API_KEY) {
            console.warn("⚠️ ELEVENLABS_API_KEY not set. TTS disabled.");
            return res.status(503).json({ error: "TTS service unavailable" });
        }

        const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
        const models = ["eleven_v3", "eleven_multilingual_v2"];

        let audioBuffer = null;
        for (const model of models) {
            try {
                const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                    method: "POST",
                    headers: {
                        "xi-api-key": ELEVENLABS_API_KEY,
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
                    console.log("🔊 TTS via:", model);
                    break;
                }
                console.warn("⚠️ Model failed:", model, response.status);
            } catch (err) {
                console.warn("⚠️ TTS model error:", model, err.message);
            }
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
// CROP MODULE (optional image processing)
// ===============================
let cropModule = null;
try {
    cropModule = require("./crop");
    console.log("✂️ Crop module loaded");
} catch (e) {
    console.log("⚠️ Crop module skip:", e.message);
}

// ===============================
// AUTH + MISSIONS + START SERVER
// ===============================
setupAuth(app);
app.use('/api/missions', require('./routes/missions')());

const PORT = process.env.PORT || 3000;

// Start server with error handling
const server = app.listen(PORT, () => {
    console.log(`🚀 VED AI Server Running on Port ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
});

// Handle server errors
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ ERROR: Port ${PORT} is already in use`);
    } else {
        console.error(`❌ Server Error:`, err);
    }
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error(`❌ UNCAUGHT EXCEPTION:`, err);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error(`❌ UNHANDLED REJECTION at ${promise}:`, reason);
});