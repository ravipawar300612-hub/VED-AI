// ==========================================
// VED AI — VOICE CORE v16 (GEMINI FREE + ELEVEN FALLBACK)
// Founder: Sayali P. R. Pawar
// ==========================================
const express = require('express');

const CONFIG = {
    geminiVoices: [
        { id: 'gemini:Sulafat', name: 'VED ♀ Warm (Gemini FREE)' },
        { id: 'gemini:Leda', name: 'VED ♀ Youthful (Gemini FREE)' },
        { id: 'gemini:Aoede', name: 'VED ♀ Breezy (Gemini FREE)' },
        { id: 'gemini:Achird', name: 'VED ♂ Friendly (Gemini FREE)' },
        { id: 'gemini:Algieba', name: 'VED ♂ Smooth (Gemini FREE)' },
        { id: 'gemini:Zephyr', name: 'VED ♀ Bright (Gemini FREE)' }
    ],
    voices: [
        { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh (Eleven)' },
        { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (Eleven)' }
    ],
    models: ['eleven_turbo_v2_5', 'eleven_multilingual_v2', 'eleven_flash_v2_5'],
    settings: { stability: 0.45, similarity_boost: 0.82, style: 0.25, use_speaker_boost: true },
    stylePrefix: 'Say in a warm, friendly and natural tone, like a caring young friend: ',
    maxText: 2500
};

module.exports = function() {
    const router = express.Router();
    let extraVoices = [];
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

    async function geminiTTS(text, voiceName) {
        const ai = getAI();
        if (!ai) throw new Error('no gemini key');
        const res = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: CONFIG.stylePrefix + text,
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

    async function refreshExtras() {
        const key = process.env.ELEVENLABS_API_KEY;
        if (!key) return;
        try {
            const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } });
            if (!r.ok) return;
            const d = await r.json();
            extraVoices = (d.voices || [])
                .filter(function (v) { return !CONFIG.voices.some(function (c) { return c.id === v.voice_id; }); })
                .map(function (v) { return { id: v.voice_id, name: v.name + ' (Eleven)' }; });
        } catch (e) { /* silent */ }
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

    router.get('/voices', async (req, res) => {
        await refreshExtras();
        res.json({ voices: CONFIG.geminiVoices.concat(CONFIG.voices).concat(extraVoices) });
    });

    router.post('/', async (req, res) => {
        const body = await getBody(req);
        const text = String(body.text || '').trim();
        let voiceId = String(body.voice || '');

        if (!text) return res.status(400).send('No text');
        if (text.length > CONFIG.maxText) return res.status(400).send('Text too long');

        const allVoices = CONFIG.geminiVoices.concat(CONFIG.voices).concat(extraVoices);
        const known = allVoices.some(function (v) { return v.id === voiceId; });
        if (!known) voiceId = CONFIG.geminiVoices[0].id;

        // ENGINE 1: GEMINI (FREE)
        if (voiceId.indexOf('gemini:') === 0) {
            try {
                const buf = await geminiTTS(text, voiceId.slice(7));
                res.setHeader('Content-Type', 'audio/wav');
                return res.send(buf);
            } catch (e) {
                console.warn('VOICE CORE: gemini fail -> eleven fallback:', e.message);
                voiceId = CONFIG.voices[0].id;
            }
        }

        // ENGINE 2: ELEVENLABS (fallback)
        const key = process.env.ELEVENLABS_API_KEY;
        if (!key) return res.status(500).send('No TTS engine available');

        let audioBuffer = null;
        for (const model of modelOrder()) {
            try {
                const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId, {
                    method: 'POST',
                    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
                    body: JSON.stringify({ text: text, model_id: model, voice_settings: CONFIG.settings })
                });
                if (response.ok) {
                    audioBuffer = Buffer.from(await response.arrayBuffer());
                    lastGoodModel = model;
                    break;
                }
            } catch (e) { /* next model */ }
        }

        if (!audioBuffer) return res.status(500).send('TTS failed');
        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(audioBuffer);
    });

    return router;
};