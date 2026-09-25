const express = require('express');

module.exports = function() {
    const router = express.Router();

    router.post('/', async (req, res) => {
        const prompt = String((req.body && req.body.prompt) || '').trim();
        if (!prompt) return res.json({ success: false, error: 'Prompt missing' });

        const key = process.env.GEMINI_API_KEY;
        if (!key) return res.json({ success: false, error: 'API Key Missing' });

        try {
            const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=' + key, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    contents: [{ parts: [{ text: prompt }] }], 
                    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } 
                })
            });

            if (!r.ok) {
                const errText = await r.text();
                console.error("Gemini Error:", errText);
                return res.json({ success: false, error: 'Gemini API Error: ' + r.status });
            }

            const d = await r.json();
            const parts = (d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || [];
            
            for (const p of parts) {
                if (p.inlineData && p.inlineData.data) {
                    return res.json({ success: true, mime: p.inlineData.mimeType, data: p.inlineData.data });
                }
            }
            
            return res.json({ success: false, error: 'No image in response' });

        } catch (e) {
            console.error("Server Error:", e);
            return res.json({ success: false, error: e.message });
        }
    });

    return router;
};