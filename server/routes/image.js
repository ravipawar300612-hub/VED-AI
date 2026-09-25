const express = require('express');

module.exports = function() {
    const router = express.Router();

    router.post('/', async (req, res) => {
        const prompt = String((req.body && req.body.prompt) || '').trim();
        if (!prompt) return res.json({ success: false, error: 'Prompt missing' });

        // Direct Free Fallback (Guaranteed to work for demo)
        // Hum Gemini try karenge, par agar 1 second mein jawab na aaye toh seedha free wala use karenge
        const fallbackUrl = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=768&height=768&nologo=true&seed=' + Date.now();

        const key = process.env.GEMINI_API_KEY;
        if (key) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 4000); // 4 second timeout

                const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=' + key, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        contents: [{ parts: [{ text: prompt }] }], 
                        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } 
                    }),
                    signal: controller.signal
                });
                clearTimeout(timeout);

                if (r.ok) {
                    const d = await r.json();
                    const parts = (d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || [];
                    for (const p of parts) {
                        if (p.inlineData && p.inlineData.data) {
                            return res.json({ success: true, mime: p.inlineData.mimeType, data: p.inlineData.data });
                        }
                    }
                }
            } catch (e) { 
                console.log("Gemini failed/timeout, using fallback"); 
            }
        }
        
        // Agar Gemini fail hua ya time out hua, toh ye chalega
        return res.json({ success: true, url: fallbackUrl });
    });

    return router;
};