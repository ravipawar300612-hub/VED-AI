// ==========================================
// VED SURAKSHA - SCAM RADAR (Rule-Based Engine)
// Founder: Sayali P. R. Pawar
// Ye engine BINA INTERNET ke scam patterns pakadta hai.
// ==========================================

const SCAM_RULES = [
    {
        name: "DARR_URGENCY",
        patterns: ["today", "immediately", "turant", "aaj hi", "24 hour", "block ho jayega", "blocked", "suspend", "expired", "last warning", "final notice"],
        score: 2
    },
    {
        name: "SECRET_INFO_MAANGNA",
        patterns: ["otp", "pin", "cvv", "password", "aadhaar", "kyc", "verify your account"],
        score: 3
    },
    {
        name: "JHUTHA_LINK",
        patterns: ["bit.ly", "tinyurl", "click here", "click karo", "link par click", "kyc-update", "update-kyc", "sbi-kyc", "hdfc-kyc"],
        score: 2
    },
    {
        name: "LALCH_OFFER",
        patterns: ["lottery", "prize", "won", "jeet", "lakh", "crore", "cash reward", "lucky winner"],
        score: 2
    },
    {
        name: "DHAMKI",
        patterns: ["police", "arrest", "court", "legal action", "fir hogi", "warrant", "jail"],
        score: 2
    },
    {
        name: "EMERGENCY_PAISA",
        patterns: ["accident", "hospital mein", "paise bhejo", "transfer karo", "urgent money"],
        score: 2
    }
];

function scanMessage(message) {
    const text = (message || "").toLowerCase();
    const flags = [];
    let riskScore = 0;

    for (const rule of SCAM_RULES) {
        const matched = rule.patterns.find(p => text.includes(p));
        if (matched) {
            flags.push({ rule: rule.name, matchedWord: matched });
            riskScore += rule.score;
        }
    }

    let radarVerdict = "SAFE";
    if (riskScore >= 4) radarVerdict = "SCAM";
    else if (riskScore >= 2) radarVerdict = "SUSPICIOUS";

    return { radarVerdict, riskScore, flags };
}

module.exports = { scanMessage };