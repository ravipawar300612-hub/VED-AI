// ==========================================
// VED KISAN — CROP RADAR (Rule-Based Engine)
// Founder: Sayali P. R. Pawar
// ==========================================

const CROP_RULES = [
    { name: "KIDE_PESTS", patterns: ["holes", "chhed", "kide", "keede", "insects", "aphids", "sundhi", "worm"] },
    { name: "FUNGUS_SPOTS", patterns: ["spots", "dhabbe", "dhariya", "brown spot", "black spot", "phaphoond", "fungus"] },
    { name: "POWDERY_MILDEW", patterns: ["white powder", "safed powder", "powdery", "safed parat"] },
    { name: "WILTING", patterns: ["wilting", "murjha", "droop", "sookh raha", "sukh"] },
    { name: "YELLOW_LEAVES", patterns: ["yellow", "peele", "pila", "yellowing"] },
    { name: "CURLING", patterns: ["curl", "mud", "sikud", "tedhi"] }
];

function scanCrop(message) {
    const text = (message || "").toLowerCase();
    const flags = [];
    for (const rule of CROP_RULES) {
        const hit = rule.patterns.find(p => text.includes(p));
        if (hit) flags.push({ name: rule.name, matchedWord: hit });
    }

    let level = "HEALTHY";
    if (flags.length >= 2) level = "SEVERE";
    else if (flags.length === 1) level = "TREATMENT";

    return { level, flags };
}

module.exports = { scanCrop };