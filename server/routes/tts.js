// ==========================================
// VED AI — TTS ENGINE v4 (VED + VANI LOCKED)
// Founder: Sayali P. R. Pawar
// ==========================================
const express = require('express');

module.exports = function() {
    const router = express.Router();

    // DO REAL VOICES (Free plan allowed, real human actors)
    const VOICES = [
        { id: 'pNInz6obpgDQGcFmaJgB', name: 'VED (Male - Beta)' },
        { id: '21m00Tcm4TlvDq8ikWAM', name: 'VANI (Female - Behen)' }
    ];

    router.get('/voices', async (req, res) => {
        res.json({ voices: VOICES });
    });

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

    router.post('/', async (req, res) => {
        const body = await getBody(req);
        const text = String(body.text || '').trim();
        let voiceId = String(body.voice || '');

        if (!text) return res.status(400).send('No text');
        if (text.length > 2500) return res.status(400).send('Text too long');

        const key = process.env.ELEVENLABS_API_KEY;
        if (!key) return res.status(500).send('API key missing');

        // Safety: galat voice aaye toh VED (male) pe lock
        const valid = VOICES.some(function (v) { return v.id === voiceId; });
        if (!valid) voiceId = VOICES[0].id;

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