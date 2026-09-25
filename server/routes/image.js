const express = require('express');

module.exports = function() {
    const router = express.Router();

    router.post('/', async (req, res) => {
        const prompt = String((req.body && req.body.prompt) || '').trim();
        if (!prompt) return res.json({ success: false, error: 'Prompt missing' });

        try {
            // Try Pollinations via Server Fetch (Bypass browser blocks)
            const imgUrl = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=768&height=768&nologo=true&seed=' + Date.now();
            
            const response = await fetch(imgUrl);
            if (!response.ok) throw new Error('Fetch failed');
            
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = buffer.toString('base64');
            
            return res.json({ 
                success: true, 
                mime: 'image/jpeg', 
                data: base64 
            });

        } catch (e) {
            console.error("Image generation error:", e);
            // Agar ye bhi fail ho, toh ek dummy image bhej do taaki app crash na ho
            return res.json({ 
                success: true, 
                url: 'https://via.placeholder.com/512x512/1a1a1a/ffffff?text=Image+Generation+Failed' 
            });
        }
    });

    return router;
};