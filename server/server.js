// ==========================================
// VED AI — FULL ENTERPRISE BACKEND ARCHITECTURE
// Handles Route Management, Security Profiles, & Voice Streaming
// Founder: Sayali P. R. Pawar
// ==========================================

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Initialize configuration layers
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Absolute root directory targeting for robust static asset delivery
const CLIENT_DIR = path.isAbsolute(process.env.CLIENT_PATH || '') 
    ? process.env.CLIENT_PATH 
    : path.join(__dirname, 'client');

// 1. Core Global Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve all native UI styles, logic modules, and brand assets automatically
app.use(express.static(CLIENT_DIR));

// Simple global logger for backend pipeline auditing
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} requested at: ${req.url}`);
    next();
});

// ====================================================
// 2. AUTHENTICATION & CORE USER LIFECYCLE MANAGEMENT
// ====================================================

// Route payload mapping for profile generation
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Target Placeholder: Connect this to MongoDB or your secure database cluster
        if (username === "admin" && password === "vedai2026") {
            return res.status(200).json({ 
                success: true, 
                token: "session_jwt_token_stub_ved_ai",
                user: { name: "Sayali Pawar", role: "Administrator" }
            });
        }
        
        return res.status(401).json({ success: false, error: "Invalid username or security credentials." });
    } catch (error) {
        return res.status(500).json({ error: "Authentication subsystem error." });
    }
});

// ====================================================
// 3. MISSION TRACKING & SURAKSHA INTEGRATION SCENARIOS
// ====================================================

app.get('/api/missions/list', (req, res) => {
    // Preserves hooks for your native client/js/missions.js layout elements
    const activeMissions = [
        { id: 101, title: "Initial Voice Verification", difficulty: "Standard", status: "Active" },
        { id: 102, title: "Suraksha Protocol Sync", difficulty: "High", status: "Pending" }
    ];
    return res.json(activeMissions);
});

app.post('/api/suraksha/trigger', (req, res) => {
    // Connected to client/js/suraksha.js dashboard triggers
    console.warn("⚠️ [SECURITY TRIGGER]: Suraksha safety protocol initialized by client console.");
    return res.json({ status: "secured", timestamp: Date.now() });
});

// ====================================================
// 4. CHAT BOT ORCHESTRATION ENGINE ROUTE
// ====================================================
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: "Message input payload string required" });
        }

        console.log(`[Conversational Router] Processing text input context: "${message}"`);

        // Central NLU intent mapping fallback matching localized patterns
        let botReply = "मैने आपकी बात समझ ली है। कृपया मुझे बताएं कि मै आपकी और क्या सहायता कर सकता हूँ?"; 
        
        const cleanMsg = message.toLowerCase();
        if (cleanMsg.includes("hello") || cleanMsg.includes("नमस्ते") || cleanMsg.includes("हाय")) {
            botReply = "नमस्ते! मैं वेद एआई हूँ। आपकी सुरक्षा और मिशन प्रबंधन में मैं आज आपकी क्या सहायता करूँ?";
        } else if (cleanMsg.includes("status") || cleanMsg.includes("स्थिति")) {
            botReply = "सभी प्रणालियाँ सामान्य रूप से काम कर रही हैं। सुरक्षा मॉड्यूल सक्रिय है।";
        } else if (cleanMsg.includes("mission") || cleanMsg.includes("मिशन")) {
            botReply = "आपके मिशन डैशबोर्ड की वर्तमान स्थिति देखने के लिए कृपया मिशन टैब की जांच करें।";
        }

        return res.json({ reply: botReply });
    } catch (error) {
        console.error("Chat engine error:", error);
        return res.status(500).json({ error: "Internal conversational pipeline failure." });
    }
});

// ====================================================
// 5. TEXT TO SPEECH (TTS) STREAMING ROUTE (FIXED FOR PHONES)
// ====================================================
app.post('/api/tts', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: "Text token required for generation" });

        const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
        const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

        // Bypass check to handle direct localized execution fallback smoothly if keys are missing
        if (!ELEVENLABS_API_KEY) {
            console.warn("[TTS Engine Bypass] Missing API token. Redirecting frontend to native browser speech synthesis.");
            return res.status(404).json({ error: "ElevenLabs API configuration parameters missing." });
        }

        const response = await fetch(`https://elevenlabs.io{VOICE_ID}`, {
            method: 'POST',
            headers: {
                'accept': 'audio/mpeg',
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                model_id: "eleven_multilingual_v2",
                voice_settings: { stability: 0.5, similarity_boost: 0.75 }
            })
        });

        if (!response.ok) {
            throw new Error(`ElevenLabs cloud portal rejected execution parameters with status: ${response.status}`);
        }

        // Apply progressive binary chunk streaming parameters directly down to the pipeline browser
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Transfer-Encoding', 'chunked');

        response.body.pipe(res);

    } catch (error) {
        console.error("TTS Processing pipeline error:", error);
        return res.status(500).json({ error: "Vocal rendering stack breakdown." });
    }
});

// ====================================================
// 6. LAYOUT VIEWS EXPLICIT PAGE ROUTERS
// ====================================================

// Direct static file routers to guarantee page alignment without rendering engines
app.get('/login', (req, res) => {
    res.sendFile(path.join(CLIENT_DIR, 'login.html')); // Exposes login UI directly
});

app.get('/voice', (req, res) => {
    res.sendFile(path.join(CLIENT_DIR, 'voice.html')); // Fixed module voice hub
});

app.get('/loading', (req, res) => {
    res.sendFile(path.join(CLIENT_DIR, 'loading.html'));
});

// Global single-page application routing catch
app.get('*', (req, res) => {
    const defaultFile = path.join(CLIENT_DIR, 'index.html');
    if (fs.existsSync(defaultFile)) {
        res.sendFile(defaultFile);
    } else {
        res.status(404).send("<h1>Ved AI - Client Architecture Shell Not Found</h1>");
    }
});

// Ensure this specific structural binding exists in your server.js
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🛡️ VED AI LIVE DISPATCH PROXIES ACTIVE`);
    console.log(`🚀 CONTAINER RUNNING SAFELY ON ASSIGNED PORT: ${PORT}`);
    console.log(`=======================================================`);
});

