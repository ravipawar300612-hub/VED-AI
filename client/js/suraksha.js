// =====================================
// VED AI — SURAKSHA MODE (Scam Shield UI)
// Founder: Sayali P. R. Pawar
// =====================================
(function () {

    // Button + panel JS se hi bante hain (index.html clean rahe)
    const btn = document.createElement("button");
    btn.id = "surakshaBtn";
    btn.title = "VED Suraksha — Scam Check";
    btn.innerHTML = "🛡️";
    document.body.appendChild(btn);

    const panel = document.createElement("div");
    panel.id = "surakshaPanel";
    panel.innerHTML = `
        <div class="suraksha-title">🛡️ VED Suraksha</div>
        <div class="suraksha-sub">Suspicious SMS / WhatsApp message yahan paste karo — VED turant check karega.</div>
        <textarea id="surakshaInput" placeholder="Example: Dear customer, your account will be blocked today. Update KYC: http://sbi-kyc.in"></textarea>
        <button id="surakshaCheckBtn">Check Karo 🔍</button>
        <div id="surakshaResult"></div>
    `;
    document.body.appendChild(panel);

    const input = panel.querySelector("#surakshaInput");
    const checkBtn = panel.querySelector("#surakshaCheckBtn");
    const resultBox = panel.querySelector("#surakshaResult");

    btn.addEventListener("click", () => panel.classList.toggle("open"));

    checkBtn.addEventListener("click", async () => {
        const message = input.value.trim();
        if (!message) { input.focus(); return; }

        checkBtn.disabled = true;
        checkBtn.textContent = "Check ho raha hai...";
        resultBox.style.display = "none";

        try {
            const res = await fetch("/check-scam", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message })
            });
            const data = await res.json();

            const radar = data.radar || {};
            const reply = data.reply || "";

            const verdict = (reply.match(/VERDICT:\s*([A-Z]+)/i) || [])[1] || radar.radarVerdict || "SUSPICIOUS";
            const hindi = (reply.match(/HINDI:\s*([^\n]+)/i) || [])[1] || "";
            const action = (reply.match(/ACTION:\s*([^\n]+)/i) || [])[1] || "";

            const cls = verdict === "SCAM" ? "scam" : verdict === "SAFE" ? "safe" : "suspicious";
            const head = verdict === "SCAM" ? "❌ SCAM HAI!" : verdict === "SAFE" ? "✅ YE SAFE HAI" : "⚠️ SAVDHAN RAHEIN";

            resultBox.innerHTML = `
                <div class="verdict-card ${cls}">
                    <div class="verdict-head">${head}</div>
                    <div class="verdict-hindi">${hindi}</div>
                    <div class="verdict-action">👉 ${action}</div>
                    <div class="verdict-score">Radar Risk Score: ${radar.riskScore ?? "-"} • ${radar.radarVerdict ?? ""}</div>
                </div>
            `;
            resultBox.style.display = "block";

            // VED bol ke bhi samjhayega
            if (window.SpeechEngine) {
                SpeechEngine.speak(head + " " + hindi + " " + action);
            }

        } catch (err) {
            resultBox.innerHTML = `
                <div class="verdict-card suspicious">
                    <div class="verdict-head">⚠️ ERROR</div>
                    <div class="verdict-hindi">Check karne mein dikkat aayi. Dobara try karein.</div>
                </div>`;
            resultBox.style.display = "block";
        }

        checkBtn.disabled = false;
        checkBtn.textContent = "Check Karo 🔍";
    });

})();// =====================================
// VED AI — SURAKSHA MODE v2 (BLACKLIST EDITION)
// Founder: Sayali P. R. Pawar
// =====================================
(function () {

    const btn = document.createElement("button");
    btn.id = "surakshaBtn";
    btn.title = "VED Suraksha — Scam Check";
    btn.innerHTML = "🛡️";
    document.body.appendChild(btn);

    const panel = document.createElement("div");
    panel.id = "surakshaPanel";
    panel.innerHTML = `
        <div class="suraksha-title">🛡️ VED Suraksha</div>
        <div class="suraksha-sub" id="surakshaSub">Suspicious SMS / WhatsApp message yahan paste karo — VED turant check karega.</div>
        <textarea id="surakshaInput" placeholder="Example: Dear customer, your account will be blocked today. Update KYC: http://sbi-kyc.in"></textarea>
        <button id="surakshaCheckBtn">Check Karo 🔍</button>
        <div id="surakshaResult"></div>
    `;
    document.body.appendChild(panel);

    const input = panel.querySelector("#surakshaInput");
    const checkBtn = panel.querySelector("#surakshaCheckBtn");
    const resultBox = panel.querySelector("#surakshaResult");
    const sub = panel.querySelector("#surakshaSub");

    let lastMessage = "";

    function loadBlacklistCount() {
        fetch("/blacklist").then(r => r.json()).then(d => {
            const n = (d.blacklist || []).length;
            sub.textContent = n > 0
                ? `🚫 Blacklist mein ${n} scam patterns saved hain. Naya message paste karo.`
                : "Suspicious SMS / WhatsApp message yahan paste karo — VED turant check karega.";
        }).catch(() => {});
    }

    btn.addEventListener("click", () => {
        panel.classList.toggle("open");
        if (panel.classList.contains("open")) loadBlacklistCount();
    });

    checkBtn.addEventListener("click", async () => {
        const message = input.value.trim();
        if (!message) { input.focus(); return; }
        lastMessage = message;

        checkBtn.disabled = true;
        checkBtn.textContent = "Check ho raha hai...";
        resultBox.style.display = "none";

        try {
            const res = await fetch("/check-scam", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message })
            });
            const data = await res.json();

            const radar = data.radar || {};
            const reply = data.reply || "";

            const verdict = (reply.match(/VERDICT:\s*([A-Z]+)/i) || [])[1] || radar.radarVerdict || "SUSPICIOUS";
            const hindi = (reply.match(/HINDI:\s*([^\n]+)/i) || [])[1] || "";
            const action = (reply.match(/ACTION:\s*([^\n]+)/i) || [])[1] || "";

            const cls = verdict === "SCAM" ? "scam" : verdict === "SAFE" ? "safe" : "suspicious";
            const head = verdict === "SCAM" ? "❌ SCAM HAI!" : verdict === "SAFE" ? "✅ YE SAFE HAI" : "⚠️ SAVDHAN RAHEIN";

            const blacklistNote = (radar.flags || []).some(f => f.rule === "BLACKLIST")
                ? `<div class="verdict-action">🚫 BLACKLIST HIT: Ye number/link pehle se blacklist mein tha!</div>`
                : "";

            const blacklistBtn = (cls !== "safe")
                ? `<button id="blacklistBtn" style="width:100%;margin-top:10px;padding:10px;border-radius:10px;background:rgba(0,0,0,.35);color:#fff;font-size:13px;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,.3);">🚫 Is scammer ko Blacklist karo</button>`
                : "";

            resultBox.innerHTML = `
                <div class="verdict-card ${cls}">
                    <div class="verdict-head">${head}</div>
                    ${blacklistNote}
                    <div class="verdict-hindi">${hindi}</div>
                    <div class="verdict-action">👉 ${action}</div>
                    <div class="verdict-score">Radar Risk Score: ${radar.riskScore ?? "-"} • ${radar.radarVerdict ?? ""}</div>
                    ${blacklistBtn}
                </div>
            `;
            resultBox.style.display = "block";

            const blBtn = resultBox.querySelector("#blacklistBtn");
            if (blBtn) {
                blBtn.addEventListener("click", async () => {
                    blBtn.disabled = true;
                    blBtn.textContent = "Blacklist ho raha hai...";
                    try {
                        await fetch("/blacklist", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ message: lastMessage })
                        });
                        blBtn.textContent = "✅ Blacklisted! VED ab ye number/link hamesha yaad rakhega";
                        if (window.SpeechEngine) {
                            SpeechEngine.speak("Scammer blacklist mein add ho gaya. Ab ye number dobara aaya toh main turant pakad lunga.");
                        }
                    } catch (e) {
                        blBtn.textContent = "❌ Error, dobara try karo";
                        blBtn.disabled = false;
                    }
                });
            }

            if (window.SpeechEngine) {
                SpeechEngine.speak(head + " " + hindi + " " + action);
            }

        } catch (err) {
            resultBox.innerHTML = `
                <div class="verdict-card suspicious">
                    <div class="verdict-head">⚠️ ERROR</div>
                    <div class="verdict-hindi">Check karne mein dikkat aayi. Dobara try karein.</div>
                </div>`;
            resultBox.style.display = "block";
        }

        checkBtn.disabled = false;
        checkBtn.textContent = "Check Karo 🔍";
    });

})();