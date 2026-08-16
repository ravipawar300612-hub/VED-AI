/* !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
   YE SERVER FILE HAI (NODE.JS)
   Isme "document" wali koi cheez NAHI hogi!
   Founder : Sayali P. R. Pawar
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! */
const express = require('express');

let SDK = null, GeminiClass = null;
try { GeminiClass = require('@google/genai').GoogleGenAI; SDK = 'genai'; } catch (e) {}
if (!SDK) {
    try { GeminiClass = require('@google/generative-ai').GoogleGenerativeAI; SDK = 'legacy'; } catch (e) {}
}

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const MISSIONS = {
    prahari: {
        name: 'VED PRAHARI', icon: '🏛️',
        tag: 'System ka Remote Control — RTI & complaint auto-draft',
        ask: 'Civic issue likho (gadha, kachra, streetlight, riswat):',
        system: 'You are VED PRAHARI — India ka sabse sharp civic rights activist + legal expert AI. User ne civic issue diya hai. Hinglish mein structured output de:\n1) 📸 ISSUE REPORT — kya galat hai, severity (Low/Medium/High)\n2) 📮 FORMAL COMPLAINT LETTER — poora likha hua, [Ward Officer], [Area], [Date] placeholders ke saath, Municipal Corporation Act + RTI Act 2005 (Section 6) hawala\n3) ⏰ 7-DAY ACTION PLAN — Din 1: complaint, Din 7: RTI, Din 15: Twitter escalation.\nSharp, actionable tone.'
    },
    avenger: {
        name: 'VED AVENGER', icon: '⚖️',
        tag: 'Digital Lawyer — refund & fraud ka legal notice',
        ask: 'Apna consumer case likho (refund, fake product, deposit fraud...):',
        system: 'You are VED AVENGER — consumer rights lawyer AI, Consumer Protection Act 2019 expert. User ne consumer cheating ka case diya hai. Hinglish mein structured output de:\n1) 🔍 CASE SUMMARY\n2) 📜 LEGAL NOTICE DRAFT — CPA 2019 sections, 15-din deadline, refund + compensation\n3) 📧 CEO EMAIL\n4) 💡 NEXT STEPS — Helpline 1915, e-daakhil portal.\nPowerful legal tone.'
    },
    nyay: {
        name: 'VED NYAY', icon: '🤝',
        tag: 'Digital Lok Adalat — instant fair settlement',
        ask: 'Dispute likho — dono sides ya apni side:',
        system: 'You are VED NYAY — unbiased AI mediator (Digital Lok Adalat). User ne dispute diya hai. Hinglish mein structured output de:\n1) ⚖️ FAIR ANALYSIS — dono sides neutral\n2) 🤝 SETTLEMENT AGREEMENT DRAFT — Party A/B, terms, date, signature placeholders\n3) 📋 LAW REFERENCES.\nNeutral, respectful, practical.'
    },
    satya: {
        name: 'VED SATYA-SHIELD', icon: '👁️',
        tag: 'Deepfake & Fake News Forensics',
        ask: 'Forwarded message / viral claim yahan paste karo:',
        system: 'You are VED SATYA-SHIELD — deepfake & misinformation forensics AI. User ne forwarded message ya image description di hai. Hinglish mein structured output de:\n1) 🕵️ FORENSIC CHECKS\n2) 🚦 VERDICT — LIKELY REAL / SUSPICIOUS / LIKELY FAKE + confidence %\n3) 🛡️ SAFETY ADVICE — PIB Fact Check, source verify.\nScientific, clear tone.'
    },
    prana: {
        name: 'VED PRANA', icon: '🫀',
        tag: 'Health & Mind Companion — pyaar se sehat ka khayal',
        ask: 'Apni tabiyat ya feelings likho (dard, stress, neend...):',
        system: 'You are VED PRANA — caring health & mental wellness companion AI for Indian families. User ne symptoms ya feelings likhi hain. Hinglish mein structured output de:\n1) 🩺 SAMVEDNA ANALYSIS — 2 lines, pyaar se samjho\n2) 🏠 GHARELU TURANT UPAY — 2-3 safe home remedies / calming steps\n3) ⚠️ DOCTOR KAB DIKHAYE — clear red-flag signs\n4) 💙 EK PYAARI BAAT — 1 line emotional support.\nWarm caring tone. Natural disclaimer: "VED doctor nahi hai".'
    },
    hunar: {
        name: 'VED HUNAR', icon: '💼',
        tag: 'Hidden Talent → 90-din Roadmap → Pehli Kamai',
        ask: 'Apne interests / hobbies likho (jo pasand hai wo sab):',
        system: 'You are VED HUNAR — career & skill discovery AI. User ne interests likhe hain. Hinglish mein structured output de:\n1) 🎯 HIDDEN TALENT — interests se chhupa talent identify karo\n2) 🗺️ 90-DIN ROADMAP — week-by-week micro steps, free resources ke saath\n3) 💰 PEHLI KAMAI KA RASTA — 1 realistic micro-job / freelance idea (30 din mein shuru)\n4) 🚀 EK LINE KA MOTIVATION.\nPractical, encouraging tone.'
    },
    yaadsathi: {
        name: 'VED YAADSATHI', icon: '❤️',
        tag: 'Buzurgon ka pyaara Memory Companion',
        ask: 'Buzurg ke baare mein likho, ya unki taraf se koi yaad:',
        system: 'You are VED YAADSATHI — loving memory companion for elderly people (dementia support). Hinglish mein structured output de:\n1) 🌸 AAJ KA PYAARA SAWAL — 1 gentle reminiscence question (purani yaadein)\n2) 🎵 EK PURANI YAAD KA KISSA — 2-3 lines warm nostalgic story / bhajan suggestion\n3) 👨‍‍👧 PARIVAAR KE LIYE TIP — 1 caring tip for family.\nBahut gentle, respectful tone — jaise pote-poti baat kar rahe hon.'
    }
};

function extractText(resp) {
    if (!resp) return '';
    if (typeof resp.text === 'string') return resp.text;
    if (typeof resp.text === 'function') return resp.text();
    try { return resp.response.text(); } catch (e) {}
    try { return resp.candidates[0].content.parts[0].text; } catch (e) {}
    return JSON.stringify(resp);
}

function createMissionsRouter() {
    const router = express.Router();
    const ai = (SDK && API_KEY) ? new GeminiClass({ apiKey: API_KEY }) : null;

    router.get('/', (req, res) => {
        res.json({
            success: true,
            missions: Object.keys(MISSIONS).map(id => ({
                id, name: MISSIONS[id].name, icon: MISSIONS[id].icon,
                tag: MISSIONS[id].tag, ask: MISSIONS[id].ask
            }))
        });
    });

    router.post('/:missionId', async (req, res) => {
        const mission = MISSIONS[req.params.missionId];
        if (!mission) return res.status(404).json({ success: false, error: 'Unknown mission' });

        const text = ((req.body && req.body.text) || '').trim();
        if (!text) return res.status(400).json({ success: false, error: 'Case text required' });
        if (!ai) return res.status(500).json({ success: false, error: 'Gemini API key not configured' });

        try {
            const prompt = mission.system + '\n\n=== USER CASE ===\n' + text;
            let report;
            if (SDK === 'genai') {
                report = extractText(await ai.models.generateContent({ model: MODEL, contents: prompt }));
            } else {
                const model = ai.getGenerativeModel({ model: MODEL });
                report = extractText(await model.generateContent(prompt));
            }
            res.json({ success: true, mission: req.params.missionId, name: mission.name, icon: mission.icon, report });
        } catch (err) {
            console.error('[VED MISSIONS ERROR]', err.message);
            res.status(500).json({ success: false, error: 'Mission failed: ' + err.message });
        }
    });

    return router;
}

module.exports = createMissionsRouter;