// ==========================================
// VED AI — VOICE CORE v10 (PERMANENT / SELF-HEALING)
// Founder: Sayali P. R. Pawar
// ------------------------------------------
// CONFIG: future mein kuch badalna ho to SIRF
// yahan badlo. Poori voice system isi se chalti hai.
// ==========================================
const express = require('express');

const CONFIG = {
    voices: [
        { id: 'pNInz6obpgDQGcFmaJgB', name: 'VED (Male - Default)' },
        { id: '21m00Tcm4TlvDq8ikWAM', name: 'VANI (Female)' }
    ],
    models: ['eleven_turbo_v2_5', 'eleven_multilingual_v2', 'eleven_flash_v2_5'],
    settings: { stability: 0.5, similarity_boost: 0.85, style: 0.2, use_speaker_boost: true },
    maxText: 2500
};

module.exports = function() {
    const router = express.Router();
    let clonedCache = [];
    let lastGoodModel = null;

    function modelOrder() {
        const list = CONFIG.models.slice();
        if (lastGoodModel && list.indexOf(lastGoodModel) > 0) {
            list.splice(list.indexOf(lastGoodModel), 1);
            list.unshift(lastGoodModel);
        }
        return list;
    }

    async function refreshCloned() {
        const key = process.env.ELEVENLABS_API_KEY;
        if (!key) return;
        try {
            const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } });
            if (!r.ok) return;
            const d = await r.json();
            clonedCache = (d.voices || [])
                .filter(function (v) { return v.category === 'cloned'; })
                .map(function (v) { return { id: v.voice_id, name: v.name + ' (Creator Mode)' }; });
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
        await refreshCloned();
        res.json({ voices: CONFIG.voices.concat(clonedCache) });
    });

    router.get('/health', (req, res) => {
        res.json({ ok: true, model: lastGoodModel || CONFIG.models[0], voices: CONFIG.voices.length + clonedCache.length });
    });

    router.post('/', async (req, res) => {
        const body = await getBody(req);
        const text = String(body.text || '').trim();
        let voiceId = String(body.voice || '');

        if (!text) return res.status(400).send('No text');
        if (text.length > CONFIG.maxText) return res.status(400).send('Text too long');

        const key = process.env.ELEVENLABS_API_KEY;
        if (!key) return res.status(500).send('API key missing');

        await refreshCloned();
        const known = CONFIG.voices.concat(clonedCache).some(function (v) { return v.id === voiceId; });
        if (!known) voiceId = CONFIG.voices[0].id;

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
                console.warn('VOICE CORE: model fail', model, response.status);
            } catch (e) {
                console.warn('VOICE CORE: model error', model, e.message);
            }
        }

        if (!audioBuffer) return res.status(500).send('TTS failed');
        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(audioBuffer);
    });

    return router;
};