// ==========================================
// VED AI — VOICE CORE v19 (EMOTION ENGINE)
// Founder: Sayali P. R. Pawar
// ==========================================
const express = require('express');

const CONFIG = {
    geminiVoices: [
        { id: 'gemini:Sulafat', name: '♀ Warm (Sulafat)' },
        { id: 'gemini:Leda', name: '♀ Youthful (Leda)' },
        { id: 'gemini:Aoede', name: '♀ Breezy (Aoede)' },
        { id: 'gemini:Achird', name: '♂ Friendly (Achird)' },
        { id: 'gemini:Algieba', name: '♂ Smooth (Algieba)' },
        { id: 'gemini:Zephyr', name: '♀ Bright (Zephyr)' }
    ],
    elevenDefault: 'TxGEqnHWrfWFTfGW9XjX',
    models: ['eleven_turbo_v2_5', 'eleven_multilingual_v2', 'eleven_flash_v2_5'],
    settings: { stability: 0.45, similarity_boost: 0.82, style: 0.25, use_speaker_boost: true },
    maxText: 2500,
    // MOOD-TO-STYLE MAP: har mood ka alag andaaz
    moodStyles: {
        happy: 'Say in a cheerful, excited and warm tone, with a smile in the voice, like sharing great news with a friend: ',
        sad: 'Say in a soft, gentle, sympathetic and caring tone, showing genuine empathy: ',
        playful: 'Say in a fun, playful, teasing and energetic tone, like telling a joke to a best friend: ',
        serious: 'Say in a calm, confident, thoughtful and professional tone: ',
        neutral: 'Say in a warm, friendly and natural tone, like a caring young friend: '
    }
};

const utterLock = new Map();
setInterval(function () {
    const now = Date.now();
    utterLock.forEach(function (v, k) { if (now - v.ts > 180000) utterLock.delete(k); });
}, 60000);

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

module.exports = function() {
    const router = express.Router();
    let lastGoodModel = null;
    let genai = null;

    function getAI() {
        if (genai) return genai;
        const key = process.env.GEMINI_API_KEY;
        if (!key) return null;
        try {
            const { GoogleGenAI } = require('@google/genai');
            genai = new GoogleGenAI({ apiKey: key });
        } catch (e) { genai = null; }
        return genai;
    }

    function wavWrap(pcm, rate) {
        const h = Buffer.alloc(44);
        h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
        h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
        h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
        h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
        return Buffer.concat([h, pcm]);
    }

    async function geminiTTS(text, voiceName, mood) {
        const ai = getAI();
        if (!ai) throw new Error('no gemini key');
        const stylePrefix = CONFIG.moodStyles[mood] || CONFIG.moodStyles.neutral;
        const res = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: stylePrefix + text,
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } }
            }
        });
        const parts = (res.candidates && res.candidates[0] && res.candidates[0].content && res.candidates[0].content.parts) || [];
        for (const p of parts) {
            if (p.inlineData && p.inlineData.data) {
                const m = String(p.inlineData.mimeType || '').match(/rate=(\d+)/);
                const rate = m ? parseInt(m[1], 10) : 24000;
                return wavWrap(Buffer.from(p.inlineData.data, 'base64'), rate);
            }
        }
        throw new Error('no audio part');
    }

    function modelOrder() {
        const list = CONFIG.models.slice();
        if (lastGoodModel && list.indexOf(lastGoodModel) > 0) {
            list.splice(list.indexOf(lastGoodModel), 1);
            list.unshift(lastGoodModel);
        }
        return list;
    }

    function getBody(req) {
        return new Promise(function (resolve) {
            if (req.body && Object.keys(req.body).length) return resolve(req.body);
            let data = '';
            req.on('data', function (c) { data += c; });
            req.on('end', function () {
                try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); }
            });
        });
    }

    router.get('/voices', (req, res) => {
        res.json({ voices: CONFIG.geminiVoices });
    });

    router.post('/', async (req, res) => {
        const body = await getBody(req);
        const text = String(body.text || '').trim();
        let voiceId = String(body.voice || '');
        const u = String(body.u || '');
        const mood = String(body.mood || 'neutral');

        if (!text) return res.status(400).send('No text');
        if (text.length > CONFIG.maxText) return res.status(400).send('Text too long');

        const known = CONFIG.geminiVoices.some(function (v) { return v.id === voiceId; });
        if (!known) voiceId = CONFIG.geminiVoices[0].id;

        const lock = u ? utterLock.get(u) : null;
        let engine = lock ? lock.engine : 'gemini';
        let buf = null;

        if (engine === 'gemini') {
            for (let attempt = 0; attempt < 2 && !buf; attempt++) {
                try { buf = await geminiTTS(text, voiceId.slice(7), mood); }
                catch (e) { console.warn('VOICE CORE: gemini attempt fail:', e.message); await sleep(700); }
                                try { 
                    buf = await geminiTTS(text, voiceId.slice(7), mood); 
                } catch (e) { 
                    console.warn('VOICE CORE: gemini attempt fail:', e.message); 
                    // Agar quota khatam hai (429 error), toh turant frontend ko bata do
                    if (e.message && (e.message.includes('429') || e.message.includes('quota') || e.message.includes('rate'))) {
                        return res.status(429).send('Gemini quota exceeded');
                    }
                    await sleep(700); 
                }
            }
            if (buf) {
                if (u) utterLock.set(u, { engine: 'gemini', ts: Date.now() });
            } else if (u && lock) {
                return res.status(500).send('Gemini locked, no mixing');
            } else if (u && !lock) {
                engine = 'eleven';
                utterLock.set(u, { engine: 'eleven', ts: Date.now() });
            } else {
                engine = 'eleven';
            }
        }

        if (!buf && engine === 'eleven') {
            const key = process.env.ELEVENLABS_API_KEY;
            if (key) {
                for (const model of modelOrder()) {
                    try {
                        const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + CONFIG.elevenDefault, {
                            method: 'POST',
                            headers: { 'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
                            body: JSON.stringify({ text: text, model_id: model, voice_settings: CONFIG.settings })
                        });
                        if (response.ok) {
                            buf = Buffer.from(await response.arrayBuffer());
                            lastGoodModel = model;
                            if (u) utterLock.set(u, { engine: 'eleven', ts: Date.now() });
                            break;
                        }
                    } catch (e) { /* next */ }
                }
            }
        }

        if (!buf) return res.status(500).send('TTS failed');
        res.setHeader('Content-Type', engine === 'gemini' ? 'audio/wav' : 'audio/mpeg');
        res.setHeader('X-VED-Engine', engine);
        res.setHeader('X-VED-Mood', mood);
        res.send(buf);
    });

    return router;
};