// ==========================================
// VED IMAGE STUDIO — Gemini + Free Fallback
// Founder: Sayali P. R. Pawar
// ==========================================
module.exports = function () {
    const express = require('express');
    const router = express.Router();

    router.post('/', async (req, res) => {
        const prompt = String((req.body && req.body.prompt) || '').trim();
        if (!prompt) return res.json({ success: false, error: 'Prompt missing' });

        const key = process.env.GEMINI_API_KEY;
        if (key) {
            const models = ['gemini-2.5-flash-image', 'gemini-2.0-flash-preview-image-generation'];
            for (const m of models) {
                try {
                    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent?key=' + key, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
                        })
                    });
                    if (!r.ok) continue;
                    const d = await r.json();
                    const parts = (d && d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || [];
                    for (const p of parts) {
                        if (p.inlineData && p.inlineData.data) {
                            return res.json({ success: true, mime: p.inlineData.mimeType || 'image/png', data: p.inlineData.data });
                        }
                    }
                } catch (e) {}
            }
        }
        // Free fallback (bina key)
        return res.json({
            success: true,
            url: 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=768&height=768&nologo=true'
        });
    });

    return router;
};