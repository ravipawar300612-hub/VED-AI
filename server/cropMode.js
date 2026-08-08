// =====================================
// VED AI — KISAN MODE (Crop Doctor UI)
// Founder: Sayali P. R. Pawar
// =====================================
(function () {

    const style = document.createElement("style");
    style.textContent = `
        #cropBtn {
            position: fixed; right: 18px; bottom: 250px; z-index: 900;
            width: 56px; height: 56px; border-radius: 50%;
            border: 1px solid rgba(255,255,255,.25);
            background: linear-gradient(135deg, #2ea44f, #1a7f37);
            color: white; font-size: 24px; cursor: pointer;
            box-shadow: 0 6px 20px rgba(46,164,79,.45);
            display: flex; align-items: center; justify-content: center;
            transition: transform .2s ease;
        }
        #cropBtn:hover { transform: scale(1.08); }
        #cropPanel {
            position: fixed; right: 18px; bottom: 320px; z-index: 900;
            width: 340px; max-width: calc(100vw - 36px); max-height: 50vh; overflow-y: auto;
            background: rgba(17,17,19,.96); backdrop-filter: blur(14px);
            border: 1px solid rgba(255,255,255,.12); border-radius: 18px;
            padding: 18px; display: none; box-shadow: 0 12px 40px rgba(0,0,0,.6);
        }
        #cropPanel.open { display: block; animation: surakshaPop .25s ease; }
        #cropPhotoPreview { width: 100%; border-radius: 10px; margin-top: 8px; display: none; }
    `;
    document.head.appendChild(style);

    const btn = document.createElement("button");
    btn.id = "cropBtn";
    btn.title = "VED Kisan — Crop Doctor";
    btn.innerHTML = "🌾";
    document.body.appendChild(btn);

    const panel = document.createElement("div");
    panel.id = "cropPanel";
    panel.innerHTML = `
        <div class="suraksha-title">🌾 VED Kisan</div>
        <div class="suraksha-sub">Patti ki photo lo ya symptoms likho — VED crop doctor turant batayega.</div>
        <textarea id="cropInput" style="width:100%;min-height:70px;resize:vertical;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#fff;font-size:13.5px;outline:none;" placeholder="Jaise: Tomato ki patti par peele dhabbe aa gaye hain"></textarea>
        <img id="cropPhotoPreview" alt="Crop photo">
        <div style="display:flex;gap:8px;margin-top:10px;">
            <button id="cropPhotoBtn" style="flex:1;padding:11px;border-radius:12px;background:rgba(255,255,255,.12);color:#fff;font-size:13px;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,.2);">📷 Photo Lo</button>
            <button id="cropCheckBtn" style="flex:1;padding:11px;border:none;border-radius:12px;background:linear-gradient(135deg,#2ea44f,#1a7f37);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Check Karo 🌾</button>
        </div>
        <input type="file" id="cropFileInput" accept="image/*" hidden>
        <div id="cropResult"></div>
    `;
    document.body.appendChild(panel);

    const input = panel.querySelector("#cropInput");
    const checkBtn = panel.querySelector("#cropCheckBtn");
    const photoBtn = panel.querySelector("#cropPhotoBtn");
    const fileInput = panel.querySelector("#cropFileInput");
    const preview = panel.querySelector("#cropPhotoPreview");
    const resultBox = panel.querySelector("#cropResult");

    let photoData = null;

    btn.addEventListener("click", () => panel.classList.toggle("open"));
    photoBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", () => {
        const file = fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            photoData = reader.result;
            preview.src = photoData;
            preview.style.display = "block";
        };
        reader.readAsDataURL(file);
    });

    checkBtn.addEventListener("click", async () => {
        const message = input.value.trim();
        if (!message && !photoData) { input.focus(); return; }

        checkBtn.disabled = true;
        checkBtn.textContent = "Check ho raha hai...";
        resultBox.style.display = "none";

        try {
            const res = await fetch("/check-crop", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: message, image: photoData })
            });
            const data = await res.json();

            const radar = data.radar || {};
            const reply = data.reply || "";

            const level = (reply.match(/LEVEL:\s*([A-Z]+)/i) || [])[1] || radar.level || "TREATMENT";
            const hindi = (reply.match(/HINDI:\s*([^\n]+)/i) || [])[1] || "";
            const action = (reply.match(/ACTION:\s*([^\n]+)/i) || [])[1] || "";

            const cls = level === "SEVERE" ? "scam" : level === "HEALTHY" ? "safe" : "suspicious";
            const head = level === "SEVERE" ? "🚨 GAMBHEER SAMASYA" : level === "HEALTHY" ? "✅ PAUDHA SWASTH HAI" : "🌿 ILAAJ ZAROORI";

            resultBox.innerHTML = `
                <div class="verdict-card ${cls}">
                    <div class="verdict-head">${head}</div>
                    <div class="verdict-hindi">${hindi}</div>
                    <div class="verdict-action">👉 ${action}</div>
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
        checkBtn.textContent = "Check Karo 🌾";
    });

})();