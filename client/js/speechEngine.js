// ==========================================
// VED AI — SPEECH ENGINE v3 (STABLE + STREAMING QUEUE)
// Founder: Sayali P. R. Pawar
// ==========================================
const SpeechEngine = (function () {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let restartCount = 0;
    const MAX_RESTARTS = 15;
    let currentAudio = null;
    let isExplicitlyStopped = false;
    let lastFinalTime = 0;
    let audioQueue = [];
    let isPlaying = false;
    let streamOpen = false;
    let endedFired = false;
    let simulatedLoopId = null;
    let speakCb = {};

    if (SpeechRecognitionAPI) {
        recognition = new SpeechRecognitionAPI();
        recognition.lang = "en-IN";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
    }
    const isSupported = !!SpeechRecognitionAPI;
    let currentCallbacks = null;

    function cleanTextForSpeech(text) {
        return String(text)
            .replace(/#{1,6}\s*/g, "")
            .replace(/\*\*([^*]+)\*\*/g, "$1")
            .replace(/\*([^*]+)\*/g, "$1")
            .replace(/```[\s\S]*?```/g, " code block ")
            .replace(/`([^`]+)`/g, "$1")
            .replace(/^[-*]\s+/gm, "")
            .replace(/^\d+\.\s+/gm, "")
            .replace(/https?:\/\/\S+/g, " link ")
            .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2764}]/gu, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function splitIntoSentences(text) {
        return cleanTextForSpeech(text)
            .split(/(?<=[.!?।])\s+/)
            .map(function (s) { return s.trim(); })
            .filter(function (s) { return s.length > 0; });
    }

    // ---------- LISTENING ----------
    function startListening(callbacks) {
        callbacks = callbacks || {};
        if (!recognition) { if (callbacks.onError) callbacks.onError(new Error("not supported")); return; }
        currentCallbacks = callbacks;
        restartCount = 0;
        isExplicitlyStopped = false;
        lastFinalTime = Date.now();
        attachHandlers();
        try { recognition.start(); }
        catch (e) {
            recognition.abort();
            setTimeout(function () { try { if (!isExplicitlyStopped) recognition.start(); } catch (err) {} }, 400);
        }
    }

    function attachHandlers() {
        if (!recognition || !currentCallbacks) return;
        const onInterim = currentCallbacks.onInterim, onFinal = currentCallbacks.onFinal,
              onEnd = currentCallbacks.onEnd, onError = currentCallbacks.onError;
        recognition.onresult = function (event) {
            let finalText = "", interimText = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i][0].confidence === 0 && event.results[i].isFinal) continue;
                const tr = event.results[i][0].transcript;
                if (event.results[i].isFinal) { finalText += tr; lastFinalTime = Date.now(); restartCount = 0; }
                else interimText += tr;
            }
            if (interimText && onInterim) onInterim(interimText);
            if (finalText && onFinal) onFinal(finalText);
        };
        recognition.onend = function () {
            if (isExplicitlyStopped) { if (onEnd) onEnd(); return; }
            const since = Date.now() - lastFinalTime;
            if (restartCount < MAX_RESTARTS && currentCallbacks && since < 30000) {
                restartCount++;
                setTimeout(function () {
                    try { if (currentCallbacks && !isExplicitlyStopped) recognition.start(); }
                    catch (e) {
                        recognition.abort();
                        setTimeout(function () { try { recognition.start(); } catch (err) {} }, 500);
                    }
                }, 300);
            } else if (onEnd) onEnd();
        };
        recognition.onerror = function (e) {
            if (e.error === 'not-allowed') isExplicitlyStopped = true;
            if (e.error === 'no-speech' || e.error === 'aborted') return;
            if (onError) onError(e);
        };
    }

    function stopListening() {
        isExplicitlyStopped = true;
        restartCount = MAX_RESTARTS;
        if (recognition) { try { recognition.abort(); } catch (e) {} }
        currentCallbacks = null;
    }

    // ---------- WAVE (sirf visuals, koi interrupt logic nahi) ----------
    function startSimulatedWave(onAmplitude) {
        if (!onAmplitude) return;
        stopSimulatedWave();
        simulatedLoopId = setInterval(function () { onAmplitude(0.25 + Math.random() * 0.75); }, 90);
    }
    function stopSimulatedWave() { if (simulatedLoopId) clearInterval(simulatedLoopId); simulatedLoopId = null; }
    function stopCurrentAudio() { if (currentAudio) { currentAudio.pause(); currentAudio = null; } stopSimulatedWave(); }

    // ---------- AUDIO QUEUE ----------
    function playText(text, cb) {
        fetch("/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text }) })
            .then(function (r) { if (!r.ok) throw new Error("TTS " + r.status); return r.blob(); })
            .then(function (blob) {
                const url = URL.createObjectURL(blob);
                currentAudio = new Audio(url);
                currentAudio.onplay = function () { startSimulatedWave(cb.onAmplitude); if (cb.onStart) cb.onStart(); };
                currentAudio.onended = function () { stopSimulatedWave(); URL.revokeObjectURL(url); currentAudio = null; next(); };
                currentAudio.onerror = function () { stopSimulatedWave(); URL.revokeObjectURL(url); currentAudio = null; browserSpeak(text, cb); };
                return currentAudio.play();
            })
            .catch(function () { browserSpeak(text, cb); });
    }

    function browserSpeak(text, cb) {
        if (!window.speechSynthesis) { next(); return; }
        const u = new SpeechSynthesisUtterance(text);
        const v = pickBestVoice();
        if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-IN";
        u.onstart = function () { startSimulatedWave(cb.onAmplitude); if (cb.onStart) cb.onStart(); };
        u.onend = function () { stopSimulatedWave(); next(); };
        u.onerror = function () { stopSimulatedWave(); next(); };
        window.speechSynthesis.speak(u);
    }

    function next() {
        isPlaying = false;
        if (audioQueue.length > 0) setTimeout(processQueue, 80);
        else maybeFinish();
    }

    function maybeFinish() {
        if (!streamOpen && !isPlaying && audioQueue.length === 0 && !endedFired) {
            endedFired = true;
            stopSimulatedWave();
            if (speakCb.onEnd) speakCb.onEnd();
        }
    }

    function processQueue() {
        if (isPlaying || audioQueue.length === 0) return;
        isPlaying = true;
        playText(audioQueue.shift(), speakCb);
    }

    // ---------- STREAM API (sentence-by-sentence) ----------
    function speakStreamBegin(cb) {
        cancelSpeaking();
        speakCb = cb || {};
        streamOpen = true;
        endedFired = false;
        audioQueue = [];
        isPlaying = false;
    }
    function speakStreamPush(sentence) {
        const s = cleanTextForSpeech(sentence);
        if (!s) return;
        audioQueue.push(s);
        processQueue();
    }
    function speakStreamEnd() {
        streamOpen = false;
        maybeFinish();
    }

    function speak(text, cb) {
        speakStreamBegin(cb);
        const parts = splitIntoSentences(text);
        if (parts.length === 0) { speakStreamEnd(); return; }
        parts.forEach(function (s) { audioQueue.push(s); });
        processQueue();
    }

    function cancelSpeaking() {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        audioQueue = [];
        stopCurrentAudio();
        isPlaying = false;
        streamOpen = false;
    }

    // ---------- VOICE PICK ----------
    function pickBestVoice() {
        const voices = window.speechSynthesis.getVoices();
        if (!voices.length) return null;
        const saved = localStorage.getItem("vedPreferredVoice");
        let voice = voices.find(function (v) { return v.voiceURI === saved; });
        if (!voice) {
            voice = voices.find(function (v) { return v.name === "Google US English"; }) ||
                    voices.find(function (v) { return v.lang === "en-IN"; }) ||
                    voices.find(function (v) { return v.lang === "en-US"; }) ||
                    voices.find(function (v) { return v.lang.startsWith("en"); }) ||
                    voices[0];
            if (voice) localStorage.setItem("vedPreferredVoice", voice.voiceURI);
        }
        return voice;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.addEventListener("voiceschanged", pickBestVoice);

    return { isSupported, startListening, stopListening, speak, speakStreamBegin, speakStreamPush, speakStreamEnd, cancelSpeaking };
})();