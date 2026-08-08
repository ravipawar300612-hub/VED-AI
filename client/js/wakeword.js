// =====================================
// VED AI — WAKE WORD ("Hey VED")
// Founder: Sayali P. R. Pawar
// =====================================
(function () {

    const toggleBtn = document.getElementById("wakeWordToggleBtn");
    const userInput = document.getElementById("userInput");
    const sendBtn = document.getElementById("sendBtn");
    const voiceOverlay = document.getElementById("voiceOverlay");

    const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechAPI) {
        console.warn("⚠️ Wake word: SpeechRecognition supported nahi hai");
        return;
    }

    let enabled = false;
    let listeningForCommand = false;
    let wakeRec = null;
    let commandRec = null;
    let toast = null;

    // "Hey VED" ke alag-alag sunne ke tarike (mic galat bhi sunta hai!)
    const WAKE_PATTERNS = [
        "hey ved", "hey bed", "hey red", "hey vet",
        "he ved", "ok ved", "okay ved", "are ved"
    ];

    // ---------- Chota sa toast (screen par message) ----------
    function showToast(text, borderColor) {
        if (!toast) {
            toast = document.createElement("div");
            Object.assign(toast.style, {
                position: "fixed",
                top: "16px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: "1200",
                padding: "10px 18px",
                borderRadius: "50px",
                background: "rgba(17,17,19,.95)",
                border: "1px solid rgba(108,108,240,.6)",
                color: "#fff",
                fontSize: "13px",
                boxShadow: "0 6px 24px rgba(0,0,0,.5)",
                display: "none",
                pointerEvents: "none",
                maxWidth: "90vw",
                textAlign: "center"
            });
            document.body.appendChild(toast);
        }
        toast.textContent = text;
        toast.style.borderColor = borderColor || "rgba(108,108,240,.6)";
        toast.style.display = "block";
    }

    function hideToast() {
        if (toast) toast.style.display = "none";
    }

    // ---------- WAKE WORD SUNNA (continuous) ----------
    function startWakeListening() {
        if (!enabled || listeningForCommand) return;
        // Voice mode chal raha hai toh conflict mat karo
        if (voiceOverlay && voiceOverlay.dataset.state !== "idle") return;

        wakeRec = new SpeechAPI();
        wakeRec.lang = "en-IN";
        wakeRec.continuous = true;
        wakeRec.interimResults = true;

        wakeRec.onresult = (e) => {
            let interim = "";
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const t = e.results[i][0].transcript.toLowerCase();
                if (e.results[i].isFinal) {
                    if (WAKE_PATTERNS.some(p => t.includes(p))) { onWake(); return; }
                } else {
                    interim += t;
                }
            }
            if (WAKE_PATTERNS.some(p => interim.includes(p))) onWake();
        };

        wakeRec.onerror = (e) => {
            if (e.error === "not-allowed") {
                showToast("🎙️ Mic permission chahiye! Browser settings mein allow karo.", "#E5484D");
                disable();
            }
        };

        wakeRec.onend = () => {
            // Browser khud band kar de toh dobara sunna shuru karo
            if (enabled && !listeningForCommand) {
                setTimeout(startWakeListening, 400);
            }
        };

        try { wakeRec.start(); } catch (err) {}
    }

    // ---------- WAKE WORD MILA → COMMAND SUNO ----------
    function onWake() {
        if (listeningForCommand) return;
        listeningForCommand = true;
        try { wakeRec && wakeRec.stop(); } catch (e) {}

        showToast("🎙️ VED sun raha hai... boliye!");

        commandRec = new SpeechAPI();
        commandRec.lang = "en-IN";
        commandRec.continuous = false;
        commandRec.interimResults = false;

        commandRec.onresult = (e) => {
            const text = e.results[0][0].transcript.trim();
            listeningForCommand = false;
            hideToast();

            if (text && userInput && sendBtn) {
                userInput.value = text;      // command ko chat box mein daalo
                sendBtn.click();             // aur bhej do!
                showToast("✅ VED ko bhej diya: " + text);
                setTimeout(hideToast, 2500);
            }
            if (enabled) setTimeout(startWakeListening, 3000);
        };

        commandRec.onerror = () => {
            listeningForCommand = false;
            showToast("😕 Sun nahi paya — phir se 'Hey VED' boliye", "#E5484D");
            setTimeout(hideToast, 2500);
            if (enabled) setTimeout(startWakeListening, 800);
        };

        commandRec.onend = () => {
            if (listeningForCommand) {
                listeningForCommand = false;
                hideToast();
                if (enabled) setTimeout(startWakeListening, 500);
            }
        };

        setTimeout(() => { try { commandRec.start(); } catch (e) {} }, 250);
    }

    // ---------- ON / OFF ----------
    function enable() {
        enabled = true;
        if (toggleBtn) toggleBtn.classList.add("active");
        showToast("👂 Wake word ON — ab 'Hey VED' boliye!");
        setTimeout(hideToast, 3000);
        startWakeListening();
    }

    function disable() {
        enabled = false;
        listeningForCommand = false;
        if (toggleBtn) toggleBtn.classList.remove("active");
        try { wakeRec && wakeRec.stop(); } catch (e) {}
        try { commandRec && commandRec.stop(); } catch (e) {}
        hideToast();
    }

    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
            if (enabled) disable();
            else enable();
        });
    }

})();