// ==========================================
// VED AI — SPEECH ENGINE (FIXED FOR PHONES)
// Real natural voice + browser fallback
// Founder: Sayali P. R. Pawar
// ==========================================

const SpeechEngine = (function () {

    const SpeechRecognitionAPI =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    let recognition = null;
    let audioContext = null;
    let analyser = null;
    let micStream = null;
    let amplitudeLoopId = null;
    let currentAudio = null;
    let simulatedLoopId = null;
    let restartCount = 0;
    const MAX_RESTARTS = 5;

    if (SpeechRecognitionAPI) {
        recognition = new SpeechRecognitionAPI();
        // FIX 1: Hindi/Hinglish support — Indian phones ke liye best
        recognition.lang = "hi-IN";
        // FIX 2: continuous = true — taaki 5 sec chup rehne par band na ho
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;
    }

    const isSupported = !!SpeechRecognitionAPI;

    // Current callbacks (so restart karne par yaad rahein)
    let currentCallbacks = null;

    // ---------- LISTENING ----------
    function startListening(callbacks = {}) {
        if (!recognition) {
            if (callbacks.onError) callbacks.onError(new Error("SpeechRecognition not supported"));
            return;
        }

        currentCallbacks = callbacks;
        restartCount = 0;
        attachHandlers();

        try {
            recognition.start();
            if (callbacks.onAmplitude) startAmplitudeMeter(callbacks.onAmplitude);
        } catch (e) {
            console.warn("Recognition already running, restarting...");
            try { recognition.stop(); } catch (e2) {}
            setTimeout(() => {
                try { recognition.start(); } catch (e3) {}
            }, 100);
        }
    }

    function attachHandlers() {
        if (!recognition || !currentCallbacks) return;

        const { onInterim, onFinal, onAmplitude, onEnd, onError } = currentCallbacks;

        recognition.onresult = (event) => {
            let finalText = "";
            let interimText = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) finalText += transcript;
                else interimText += transcript;
            }
            if (interimText && onInterim) onInterim(interimText);
            if (finalText) {
                restartCount = 0; // reset restart counter on success
                if (onFinal) onFinal(finalText);
            }
        };

        recognition.onend = () => {
            stopAmplitudeMeter();
            // FIX 3: Agar koi final text nahi mila aur restart limit nahi hui, toh dobara suno
            if (restartCount < MAX_RESTARTS && currentCallbacks) {
                restartCount++;
                setTimeout(() => {
                    try {
                        if (currentCallbacks) {
                            recognition.start();
                            if (currentCallbacks.onAmplitude) startAmplitudeMeter(currentCallbacks.onAmplitude);
                        }
                    } catch (e) {}
                }, 200);
            } else {
                if (onEnd) onEnd();
            }
        };

        recognition.onerror = (e) => {
            stopAmplitudeMeter();
            // network/audio-capture errors pe retry
            if (e && e.error && (e.error === 'network' || e.error === 'audio-capture')) {
                if (restartCount < MAX_RESTARTS) {
                    restartCount++;
                    setTimeout(() => {
                        try { recognition.start(); } catch (e2) {}
                    }, 500);
                    return;
                }
            }
            if (onError) onError(e);
        };
    }

    function stopListening() {
        restartCount = MAX_RESTARTS; // force stop, no more restarts
        if (recognition) {
            try { recognition.stop(); } catch (e) {}
        }
        stopAmplitudeMeter();
        currentCallbacks = null;
    }

    // ---------- MIC AMPLITUDE ----------
    async function startAmplitudeMeter(onAmplitude) {
        try {
            if (micStream) return; // already running
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            const source = audioContext.createMediaStreamSource(micStream);
            source.connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);
            const loop = () => {
                analyser.getByteFrequencyData(data);
                const avg = data.reduce((a, b) => a + b, 0) / data.length;
                onAmplitude(avg / 255);
                amplitudeLoopId = requestAnimationFrame(loop);
            };
            loop();
        } catch (err) {
            console.warn("⚠️ Mic amplitude meter unavailable:", err.message);
        }
    }

    function stopAmplitudeMeter() {
        if (amplitudeLoopId) cancelAnimationFrame(amplitudeLoopId);
        amplitudeLoopId = null;
        if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
        if (audioContext) { try { audioContext.close(); } catch(e){} audioContext = null; }
    }

    // ---------- SIMULATED WAVEFORM ----------
    function startSimulatedWave(onAmplitude) {
        if (!onAmplitude) return;
        stopSimulatedWave();
        simulatedLoopId = setInterval(() => onAmplitude(0.25 + Math.random() * 0.75), 90);
    }
    function stopSimulatedWave() {
        if (simulatedLoopId) clearInterval(simulatedLoopId);
        simulatedLoopId = null;
    }

    function stopCurrentAudio() {
        if (currentAudio) { currentAudio.pause(); currentAudio = null; }
        stopSimulatedWave();
    }

    // ---------- SPEAKING (ElevenLabs first, fallback browser) ----------
    function speak(text, { onStart, onAmplitude, onEnd } = {}) {
        window.speechSynthesis.cancel();
        stopCurrentAudio();

       
        const cleanText = String(text)
            .replace(/[#*_`~]/g, "")
            .replace(/https?:\/\/\S+/g, " link ")
            .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2764}]/gu, "")
            .trim();

        if (!cleanText) { if (onEnd) onEnd(); return; }

        fetch("/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: cleanText })
        })
        .then(res => {
            if (!res.ok) throw new Error("TTS server error " + res.status);
            return res.blob();
        })
        .then(blob => {
            const url = URL.createObjectURL(blob);
            currentAudio = new Audio(url);
            currentAudio.onplay = () => { startSimulatedWave(onAmplitude); if (onStart) onStart(); };
            currentAudio.onended = () => { stopSimulatedWave(); URL.revokeObjectURL(url); currentAudio = null; if (onEnd) onEnd(); };
            currentAudio.onerror = () => { stopSimulatedWave(); URL.revokeObjectURL(url); currentAudio = null; if (onEnd) onEnd(); };
            return currentAudio.play();
        })
        .catch(err => {
            console.warn("⚠️ ElevenLabs unavailable, browser voice:", err.message);
            browserSpeak(cleanText, { onStart, onAmplitude, onEnd });
        });
    }

   app.post("/tts", async (req, res) => {
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    // Send the request to ElevenLabs here.
});
    // ---------- FALLBACK: BROWSER VOICE ----------
    function browserSpeak(text, { onStart, onAmplitude, onEnd } = {}) {
        const utterance = new SpeechSynthesisUtterance(text);
        const voice = pickBestVoice();
        if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
        else utterance.lang = "en-US";
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;
        utterance.onstart = () => { startSimulatedWave(onAmplitude); if (onStart) onStart(); };
        utterance.onend = () => { stopSimulatedWave(); if (onEnd) onEnd(); };
        utterance.onerror = () => { stopSimulatedWave(); if (onEnd) onEnd(); };
        window.speechSynthesis.speak(utterance);
    }

    // function pickBestVoice() {
    //     const voices = window.speechSynthesis.getVoices();
    //     if (!voices.length) return null;
    //     return (
    //         voices.find(v => v.lang === "en-IN") ||
    //         voices.find(v => v.lang === "en-US") ||
    //         voices.find(v => v.name.includes("Google US English")) ||
    //         voices.find(v => v.lang.startsWith("en")) ||
    //         voices[0]
    //     );
    // }

    function pickBestVoice() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    const savedVoiceURI = localStorage.getItem("vedPreferredVoice");

    let voice = voices.find(v => v.voiceURI === savedVoiceURI);

    if (!voice) {
        voice =
            voices.find(v => v.name === "Google US English") ||
            voices.find(v => v.lang === "en-IN") ||
            voices.find(v => v.lang === "en-US") ||
            voices.find(v => v.lang.startsWith("en")) ||
            voices[0];

        if (voice) {
            localStorage.setItem("vedPreferredVoice", voice.voiceURI);
        }
    }

    return voice;
}

if ("speechSynthesis" in window) {
    window.speechSynthesis.addEventListener("voiceschanged", pickBestVoice);
}

    function cancelSpeaking() {
        window.speechSynthesis.cancel();
        stopCurrentAudio();
    }

    return { isSupported, startListening, stopListening, speak, cancelSpeaking };
})();