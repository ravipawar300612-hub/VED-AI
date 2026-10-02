// ==========================================
// VED AI — IMAGE ENGINE v7 (UA HEADERS + 6 FALLBACKS)
// Founder: Sayali P. R. Pawar
// ==========================================
const express = require('express');

module.exports = function() {
    const router = express.Router();

    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

    async function hfRouter(prompt) {
        const key = process.env.HF_API_KEY;
        if (!key) throw new Error('no hf key');
        const r = await fetch('https://router.huggingface.co/v1/images/generations', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'User-Agent': UA },
            body: JSON.stringify({ model: 'black-forest-labs/FLUX.1-schnell', prompt: prompt })
        });
        if (!r.ok) throw new Error('router ' + r.status);
        const d = await r.json();
        const item = d && d.data && d.data[0];
        if (!item) throw new Error('no data');
        if (item.b64_json) return Buffer.from(item.b64_json, 'base64');
        if (item.url) {
            const r2 = await fetch(item.url, { headers: { 'User-Agent': UA } });
            if (!r2.ok) throw new Error('img url fail');
            return Buffer.from(await r2.arrayBuffer());
        }
        throw new Error('empty');
    }

    async function hfLegacy(prompt, model) {
        const key = process.env.HF_API_KEY;
        if (!key) throw new Error('no hf key');
        const r = await fetch('https://api-inference.huggingface.co/models/' + model, {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'User-Agent': UA },
            body: JSON.stringify({ inputs: prompt })
        });
        if (!r.ok) throw new Error('legacy ' + r.status);
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 1000) throw new Error('legacy empty');
        return buf;
    }

    async function pollinations(prompt, model) {
        let url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=768&height=768&nologo=true&seed=' + Date.now();
        if (model) url += '&model=' + model;
        const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'image/*,*/*;q=0.8' } });
        if (!r.ok) throw new Error('pollinations(' + (model || 'default') + ') ' + r.status);
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 1000) throw new Error('pollinations empty');
        return buf;
    }

    function errorSVG() {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#14171c"/><text x="256" y="246" fill="#ff6b6b" font-size="22" text-anchor="middle" font-family="sans-serif">Image generation failed</text><text x="256" y="278" fill="#9aa4b2" font-size="15" text-anchor="middle" font-family="sans-serif">Dobara try karo Boss!</text></svg>';
        return Buffer.from(svg, 'utf8');
    }

    function contentType(buf) {
        if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
        return 'image/jpeg';
    }

    router.get('/render', async (req, res) => {
        const prompt = String(req.query.prompt || '').trim();
        if (!prompt) return res.status(400).send('No prompt');
        let buf = null;
        const attempts = [
            ['hf-router', function(){ return hfRouter(prompt); }],
            ['hf-flux', function(){ return hfLegacy(prompt, 'black-forest-labs/FLUX.1-schnell'); }],
            ['hf-sdxl', function(){ return hfLegacy(prompt, 'stabilityai/stable-diffusion-xl-base-1.0'); }],
            ['pol-flux', function(){ return pollinations(prompt, 'flux'); }],
            ['pol-turbo', function(){ return pollinations(prompt, 'turbo'); }],
            ['pol-default', function(){ return pollinations(prompt, null); }]
        ];
        for (const a of attempts) {
            try {
                buf = await a[1]();
                if (buf && buf.length > 1000) { console.log('IMG OK via', a[0]); break; }
                buf = null;
            } catch (e) { console.log('IMG fallback:', a[0], '-', e.message); }
        }
        if (!buf) {
            res.setHeader('Content-Type', 'image/svg+xml');
            return res.send(errorSVG());
        }
        res.setHeader('Content-Type', contentType(buf));
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send(buf);
    });

    router.post('/', async (req, res) => {
        const prompt = String((req.body && req.body.prompt) || '').trim();
        if (!prompt) return res.json({ success: false, error: 'Prompt missing' });
        res.json({ success: true, url: '/api/image/render?prompt=' + encodeURIComponent(prompt) + '&t=' + Date.now() });
    });

    return router;
};