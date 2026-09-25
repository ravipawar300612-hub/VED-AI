// ==========================================
// VED IMAGE STUDIO — AI Painting Engine
// Founder: Sayali P. R. Pawar
// ==========================================
const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
    const prompt = String((req.body && req.body.prompt) || '').trim();
    if (!prompt) return res.json({ success: false, error: 'Prompt missing' });

    const key = process.env.GEMINI_API_KEY;
    if (key) {
        try {
            // Gemini Image Generation attempt
            const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=' + key, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    contents: [{ parts: [{ text: prompt }] }], 
                    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } 
                })
            });
            if (r.ok) {
                const d = await r.json();
                const parts = (d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || [];
                for (const p of parts) {
                    if (p.inlineData && p.inlineData.data) {
                        return res.json({ success: true, mime: p.inlineData.mimeType, data: p.inlineData.data });
                    }
                }
            }
        } catch (e) { console.log("Gemini image fallback triggered"); }
    }
    
    // Free Fallback (Pollinations - Always works!)
    res.json({ 
        success: true, 
        url: 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=768&height=768&nologo=true&seed=' + Date.now() 
    });
});

module.exports = router;