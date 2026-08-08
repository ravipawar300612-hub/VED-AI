// =====================================
// VED AI — SWASTHYA MODE (Health Aid UI)
// Founder: Sayali P. R. Pawar
// =====================================
(function () {

    const style = document.createElement("style");
    style.textContent = `
        #healthBtn {
            position: fixed; right: 18px; bottom: 180px; z-index: 900;
            width: 56px; height: 56px; border-radius: 50%;
            border: 1px solid rgba(255,255,255,.25);
            background: linear-gradient(135deg, #E5484D, #b02a30);
            color: white; font-size: 24px; cursor: pointer;
            box-shadow: 0 6px 20px rgba(229,72,77,.45);
            display: flex; align-items: center; justify-content: center;
            transition: transform .2s ease;
        }
        #healthBtn:hover { transform: scale(1.08); }
        #healthPanel {
            position: fixed; right: 18px; bottom: 250px; z-index: 900;
            width: 340px; max-width: calc(100vw - 36px); max-height: 55vh; overflow-y: auto;
            background: rgba(17,17,19,.96); backdrop-filter: blur(14px);
            border: 1px solid rgba(255,255,255,.12); border-radius: 18px;
            padding: 18px; display: none; box-shadow: 0 12px 40px rgba(0,0,0,.6);
        }
        #healthPanel.open { display: block; animation: surakshaPop .25s ease; }
    `;
    document.head.appendChild(style);

    const btn = document.createElement("button");
    btn.id = "healthBtn";
    btn.title = "VED Swasthya — Health Check";
    btn.innerHTML = "❤️";
    document.body.appendChild(btn);

    const panel = document.createElement("div");
    panel.id = "healthPanel";
    panel.innerHTML = `
        <div class="suraksha-title">❤️ VED Swasthya</div>
        <div class="suraksha-sub">Symptoms likho — VED turant guide karega.</div>
        <textarea id="healthInput" style="width:100%;min-height:80px;resize:vertical;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#fff;font-size:13.5px;outline:none;" placeholder="Jaise: Dada ji ko chest pain hai / Mujhe bukhar aur khansi hai"></textarea>
        <button id="healthCheckBtn" style="width:100%;margin-top:10px;padding:11px;border:none;border-radius:12px;background:linear-gradient(135deg,#E5484D,#b02a30);color:#fff;font-size:14px;font-weight:600;cursor:pointer;">Check Karo 🩺</button>
        <div id="healthResult"></div>
    `;
    document.body.appendChild(panel);

    const input = panel.querySelector("#healthInput");
    const checkBtn = panel.querySelector("#healthCheckBtn");
    const resultBox = panel.querySelector("#healthResult");

    btn.addEventListener("click", () => panel.classList.toggle("open"));

    checkBtn.addEventListener("click", async () => {
        const message = input.value.trim();
        if (!message) { input.focus(); return; }

        checkBtn.disabled = true;
        checkBtn.textContent = "Check ho raha hai...";
        resultBox.style.display = "none";

        try {
            const res = await fetch("/check-health", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message })
            });
            const data = await res.json();

            const radar = data.radar || {};
            const reply = data.reply || "";

            const level = (reply.match(/LEVEL:\s*([A-Z_]+)/i) || [])[1] || radar.level || "DOCTOR";
            const hindi = (reply.match(/HINDI:\s*([^\n]+)/i) || [])[1] || "";
            const action = (reply.match(/ACTION:\s*([^\n]+)/i) || [])[1] || "";
            const disclaimer = (reply.match(/DISCLAIMER:\s*([^\n]+)/i) || [])[1] || "";

            const cls = level === "EMERGENCY" ? "scam" : level === "HOME_CARE" ? "safe" : "suspicious";
            const head = level === "EMERGENCY" ? "🚨 EMERGENCY!" : level === "HOME_CARE" ? "🏠 GHARELU UPCHAR" : "🩺 DOCTOR SE MILEIN";

            resultBox.innerHTML = `
                <div class="verdict-card ${cls}">
                    <div class="verdict-head">${head}</div>
                    <div class="verdict-hindi">${hindi}</div>
                    <div class="verdict-action">👉 ${action}</div>
                    ${disclaimer ? `<div class="verdict-score">⚠️ ${disclaimer}</div>` : ""}
                </div>
            `;
            resultBox.style.display = "block";

            if (window.SpeechEngine) {
                SpeechEngine.speak(head + "! " + hindi + " " + action);
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
        checkBtn.textContent = "Check Karo 🩺";
    });

})();