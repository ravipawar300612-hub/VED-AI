// ==========================================
// VED AI — SPEECH ENGINE (ELEVENLABS EDITION)
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

    if (SpeechRecognitionAPI) {
        recognition = new SpeechRecognitionAPI();
        recognition.lang = "en-IN";
        recognition.continuous = false;
        recognition.interimResults = true;
    }

    const isSupported = !!SpeechRecognitionAPI;

    // ---------- LISTENING ----------
    function startListening({ onInterim, onFinal, onAmplitude, onEnd, onError } = {}) {
        if (!recognition) {
            if (onError) onError(new Error("SpeechRecognition not supported in this browser."));
            return;
        }
        recognition.onresult = (event) => {
            let finalText = "";
            let interimText = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) finalText += transcript;
                else interimText += transcript;
            }
            if (interimText && onInterim) onInterim(interimText);
            if (finalText && onFinal) onFinal(finalText);
        };
        recognition.onend = () => { stopAmplitudeMeter(); if (onEnd) onEnd(); };
        recognition.onerror = (e) => { stopAmplitudeMeter(); if (onError) onError(e); };
        recognition.start();
        if (onAmplitude) startAmplitudeMeter(onAmplitude);
    }

    function stopListening() {
        if (recognition) recognition.stop();
        stopAmplitudeMeter();
    }

    // ---------- MIC AMPLITUDE ----------
    async function startAmplitudeMeter(onAmplitude) {
        try {
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
        if (audioContext) { audioContext.close(); audioContext = null; }
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

    // ---------- FALLBACK: BROWSER VOICE ----------
    function browserSpeak(text, { onStart, onAmplitude, onEnd } = {}) {
        const utterance = new SpeechSynthesisUtterance(text);
        const voice = pickBestVoice();
        if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
        else utterance.lang = "en-IN";
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;
        utterance.onstart = () => { startSimulatedWave(onAmplitude); if (onStart) onStart(); };
        utterance.onend = () => { stopSimulatedWave(); if (onEnd) onEnd(); };
        utterance.onerror = () => { stopSimulatedWave(); if (onEnd) onEnd(); };
        window.speechSynthesis.speak(utterance);
    }

    function pickBestVoice() {
        const voices = window.speechSynthesis.getVoices();
        if (!voices.length) return null;
        return (
            voices.find(v => v.name.includes("Google US English")) ||
            voices.find(v => v.lang === "hi-IN") ||
            voices.find(v => v.lang === "en-IN") ||
            voices.find(v => v.lang.startsWith("en")) ||
            voices[0]
        );
    }

    function cancelSpeaking() {
        window.speechSynthesis.cancel();
        stopCurrentAudio();
    }

    return { isSupported, startListening, stopListening, speak, cancelSpeaking };
})();