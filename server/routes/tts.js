// ==========================================
// VED AI — TTS ENGINE v5 (FOUNDER VOICE = DEFAULT)
// Founder: Sayali P. R. Pawar
// ==========================================
const express = require('express');

module.exports = function() {
    const router = express.Router();

    const PREMADE = [
        { id: 'pNInz6obpgDQGcFmaJgB', name: 'VED (Male - Backup)' },
        { id: '21m00Tcm4TlvDq8ikWAM', name: 'VANI (Female - Backup)' }
    ];
    let clonedCache = [];

    async function refreshCloned() {
        const key = process.env.ELEVENLABS_API_KEY;
        if (!key) return;
        try {
            const r = await fetch('https://api.elevenlabs.io/v1/voices', {
                headers: { 'xi-api-key': key }
            });
            if (!r.ok) return;
            const d = await r.json();
            clonedCache = (d.voices || [])
                .filter(function (v) { return v.category === 'cloned'; })
                .map(function (v) { return { id: v.voice_id, name: v.name + ' (Founder Voice)' }; });
        } catch (e) { /* silent */ }
    }

    function defaultVoice() {
        return (clonedCache[0] && clonedCache[0].id) || PREMADE[0].id;
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
        res.json({ voices: clonedCache.concat(PREMADE) });
    });

    router.post('/', async (req, res) => {
        const body = await getBody(req);
        const text = String(body.text || '').trim();
        let voiceId = String(body.voice || '');

        if (!text) return res.status(400).send('No text');
        if (text.length > 2500) return res.status(400).send('Text too long');

        const key = process.env.ELEVENLABS_API_KEY;
        if (!key) return res.status(500).send('API key missing');

        await refreshCloned();
        const known = clonedCache.concat(PREMADE).some(function (v) { return v.id === voiceId; });
        if (!known) voiceId = defaultVoice();

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
                        stability: 0.5,
                        similarity_boost: 0.85,
                        style: 0.2,
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