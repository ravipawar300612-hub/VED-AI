// ==========================================
// VED AI — TTS ENGINE v3 (SELF-PARSING, PRIORITY ROUTE)
// Founder: Sayali P. R. Pawar
// ==========================================
const express = require('express');

module.exports = function() {
    const router = express.Router();

    // Body khud padhta hai (middleware pe depend nahi karta)
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
        const key = process.env.ELEVENLABS_API_KEY;
        if (!key) return res.json({ voices: [] });
        try {
            const r = await fetch('https://api.elevenlabs.io/v1/voices', {
                headers: { 'xi-api-key': key }
            });
            if (!r.ok) return res.json({ voices: [] });
            const d = await r.json();
            const list = (d.voices || []).map(function (v) {
                return { id: v.voice_id, name: v.name };
            });
            res.json({ voices: list });
        } catch (e) {
            res.json({ voices: [] });
        }
    });

    router.post('/', async (req, res) => {
        const body = await getBody(req);
        const text = String(body.text || '').trim();
        const voiceId = String(body.voice || '');

        if (!text) return res.status(400).send('No text');
        if (text.length > 2500) return res.status(400).send('Text too long');

        const key = process.env.ELEVENLABS_API_KEY;
        if (!key) return res.status(500).send('API key missing');
        if (!voiceId) return res.status(400).send('Voice missing');

        try {
            const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId, {
                method: 'POST',
                headers: {
                    'xi-api-key': key,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg'
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: {
                        stability: 0.45,
                        similarity_boost: 0.8,
                        style: 0.25,
                        use_speaker_boost: true
                    }
                })
            });

            if (!response.ok) {
                const err = await response.text();
                console.error("ElevenLabs Error:", err);
                return res.status(500).send('TTS failed');
            }

            const audioBuffer = await response.arrayBuffer();
            res.setHeader('Content-Type', 'audio/mpeg');
            res.send(Buffer.from(audioBuffer));

        } catch (e) {
            console.error("TTS Error:", e);
            res.status(500).send('Server error');
        }
    });

    return router;
};