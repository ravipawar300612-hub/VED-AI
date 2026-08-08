// ==========================================
// VED SWASTHYA — HEALTH RADAR (Rule-Based Engine)
// Founder: Sayali P. R. Pawar
// Ye engine bina internet ke emergency symptoms pakadta hai.
// ==========================================

const EMERGENCY_PATTERNS = [
    "chest pain", "seene mein dard", "saans nahi", "breathing problem",
    "difficulty breathing", "unconscious", "behosh", "severe bleeding",
    "khoon bahut", "snake bite", "saanp ne kaata", "heart attack",
    "stroke", "seizure", "daura", "zehar", "poison", "jal gaya", "burn"
];

const COMMON_PATTERNS = [
    { name: "FEVER", patterns: ["fever", "bukhar", "temperature"] },
    { name: "COLD_COUGH", patterns: ["cough", "khansi", "cold", "zukam", "sore throat", "gala"] },
    { name: "HEADACHE", patterns: ["headache", "sar dard", "sir dard", "migraine"] },
    { name: "STOMACH", patterns: ["stomach", "pet dard", "vomit", "ulti", "diarrhea", "dast", "acidity"] },
    { name: "WEAKNESS", patterns: ["weakness", "kamzori", "thakan", "chakkar", "dizzy"] }
];

function scanHealth(message) {
    const text = (message || "").toLowerCase();

    const emergency = EMERGENCY_PATTERNS.find(p => text.includes(p));
    if (emergency) {
        return { level: "EMERGENCY", flags: [{ name: "RED_FLAG", matchedWord: emergency }] };
    }

    const flags = [];
    for (const rule of COMMON_PATTERNS) {
        const hit = rule.patterns.find(p => text.includes(p));
        if (hit) flags.push({ name: rule.name, matchedWord: hit });
    }

    if (flags.length > 0) return { level: "HOME_CARE", flags };
    return { level: "DOCTOR", flags: [] };
}

module.exports = { scanHealth };