// ==========================================
// VED AI — SPEECH ENGINE v22 (CRASH-PROOF + SINGLE-POST + EMOTION)
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

    let activeVoice = null;
    let utteranceId = null;
    let chunkBuf = '';
    let chunkSent = 0;
    let apiFailed = false;

    const audioCache = new Map();
    const pendingFetch = new Map();
    const CACHE_MAX_SIZE = 50;

    const EMOTION_RULES = {
        happy: /(great|amazing|wonderful|fantastic|awesome|excellent|brilliant|perfect|congrats|congratulations|yay|hooray|hurray|wow|shandar|badhiya|zabardast|mast|kamaal|wah|khushi|mubarak|good news|🎉|✨|❤️|💯)/i,
        sad: /(sorry|sad|unfortunately|regret|loss|miss you|pain|heartbreak|dukhi|afsos|mazrat|chinta|takleef|dukh|😢|😭|🥺)/i,
        playful: /(haha|lol|funny|joke|mazak|masti|mazedaar|hasi|mazze|chill|cool|😂|🤣|😉)/i,
        serious: /(important|serious|urgent|danger|warning|careful|dhyan|zaroori|gambheer|sawdhan|alert|critical|crucial|samjho)/i
    };

    function detectMood(text) {
        const t = String(text);
        for (const mood in EMOTION_RULES) {
            if (EMOTION_RULES[mood].test(t)) return mood;
        }
        return 'neutral';
    }

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
            .replace(/```[\s\S]*?```/g, " ")
            .replace(/`([^`]+)`/g, "$1")
            .replace(/^[-*]\s+/gm, "")
            .replace(/^\d+\.\s+/gm, "")
            .replace(/https?:\/\/\S+/g, " ")
            .replace(/📎\s?Sources?:[^\n]*/g, " ")
            .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
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

    // ---------- WAVE ----------
    function startSimulatedWave(onAmplitude) {
        if (!onAmplitude) return;
        stopSimulatedWave();
        simulatedLoopId = setInterval(function () { onAmplitude(0.25 + Math.random() * 0.75); }, 90);
    }
    function stopSimulatedWave() { if (simulatedLoopId) clearInterval(simulatedLoopId); simulatedLoopId = null; }
    function stopCurrentAudio() { if (currentAudio) { currentAudio.pause(); currentAudio = null; } stopSimulatedWave(); }

    // ---------- TTS FETCH (SINGLE POST PER CHUNK — quota 2x bachega) ----------
    function fetchTTS(text, mood) {
        if (apiFailed) return Promise.reject(new Error("API blocked, using browser"));
        const voice = activeVoice || localStorage.getItem('vedVoice') || 'gemini:Sulafat';
        const cacheKey = voice + '|' + mood + '|' + text;
        if (audioCache.has(cacheKey)) return Promise.resolve(audioCache.get(cacheKey));
        if (pendingFetch.has(cacheKey)) return pendingFetch.get(cacheKey);

        const p = fetch("/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text, voice: voice, mood: mood, u: utteranceId || '' })
        })
        .then(function (r) {
            if (r.status === 429 || r.status === 500) {
                apiFailed = true;
                throw new Error("Quota exceeded or Server Error");
            }
            if (!r.ok) throw new Error("TTS " + r.status);
            return r.blob();
        })
        .then(function (blob) {
            pendingFetch.delete(cacheKey);
            if (text.length < 60) {
                if (audioCache.size >= CACHE_MAX_SIZE) {
                    const firstKey = audioCache.keys().next().value;
                    audioCache.delete(firstKey);
                }
                audioCache.set(cacheKey, blob);
            }
            return blob;
        })
        .catch(function (e) {
            pendingFetch.delete(cacheKey);
            throw e;
        });

        pendingFetch.set(cacheKey, p);
        return p;
    }

    function playText(text, mood, cb) {
        fetchTTS(text, mood)
            .then(function (blob) {
                const url = URL.createObjectURL(blob);
                currentAudio = new Audio(url);
                currentAudio.onplay = function () { startSimulatedWave(cb.onAmplitude); if (cb.onStart) cb.onStart(); };
                currentAudio.onended = function () { stopSimulatedWave(); URL.revokeObjectURL(url); currentAudio = null; next(); };
                currentAudio.onerror = function () { stopSimulatedWave(); URL.revokeObjectURL(url); currentAudio = null; browserSpeak(text, mood, cb); };
                return currentAudio.play();
            })
            .catch(function (err) {
                console.warn("⚠️ API TTS fail, browser voice:", err.message);
                browserSpeak(text, mood, cb);
            });
    }

    // ---------- BROWSER FALLBACK (mood FIXED + crash-proof) ----------
    function browserSpeak(text, mood, cb) {
        cb = cb || {};
        mood = mood || 'neutral';
        try {
            if (!window.speechSynthesis) { next(); return; }
            const u = new SpeechSynthesisUtterance(text);
            const v = pickBestVoice();
            if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = "hi-IN"; }

            if (mood === 'happy' || mood === 'playful') { u.pitch = 1.1; u.rate = 1.05; }
            else if (mood === 'sad' || mood === 'serious') { u.pitch = 0.9; u.rate = 0.95; }
            else { u.pitch = 1.0; u.rate = 1.0; }

            u.onstart = function () { startSimulatedWave(cb.onAmplitude); if (cb.onStart) cb.onStart(); };
            u.onend = function () { stopSimulatedWave(); next(); };
            u.onerror = function () { stopSimulatedWave(); next(); };
            window.speechSynthesis.speak(u);
        } catch (e) {
            console.warn("⚠️ browserSpeak error:", e.message);
            stopSimulatedWave();
            next();
        }
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
        const item = audioQueue.shift();
        try {
            playText(item.text, item.mood, speakCb);
        } catch (e) {
            console.warn("⚠️ processQueue error:", e.message);
            next();
        }
    }

    function enqueueChunk(t) {
        const mood = detectMood(t);
        audioQueue.push({ text: t, mood: mood });
        if (!apiFailed) fetchTTS(t, mood).catch(function () {});
        processQueue();
    }

    // ---------- STREAM API ----------
    function speakStreamBegin(cb) {
        cancelSpeaking();
        speakCb = cb || {};
        streamOpen = true;
        endedFired = false;
        audioQueue = [];
        chunkBuf = '';
        chunkSent = 0;
        apiFailed = false;
        activeVoice = localStorage.getItem('vedVoice') || 'gemini:Sulafat';
        utteranceId = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function speakStreamPush(sentence) {
        const s = cleanTextForSpeech(sentence);
        if (!s) return;
        if (chunkSent === 0) {
            chunkSent = 1;
            enqueueChunk(s);
        } else {
            chunkBuf = chunkBuf ? chunkBuf + ' ' + s : s;
            if (chunkBuf.length >= 150) {
                enqueueChunk(chunkBuf);
                chunkBuf = '';
            }
        }
    }

    function speakStreamEnd() {
        if (chunkBuf) { enqueueChunk(chunkBuf); chunkBuf = ''; }
        streamOpen = false;
        maybeFinish();
    }

    function speak(text, cb) {
        speakStreamBegin(cb);
        const parts = splitIntoSentences(text);
        if (parts.length === 0) { speakStreamEnd(); return; }
        parts.forEach(function (s) { speakStreamPush(s); });
        speakStreamEnd();
    }

    function cancelSpeaking() {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        audioQueue = [];
        chunkBuf = '';
        stopCurrentAudio();
        isPlaying = false;
        streamOpen = false;
    }

    // ---------- SMART VOICE PICKER ----------
    function pickBestVoice() {
        const voices = window.speechSynthesis.getVoices();
        if (!voices.length) return null;
        let voice = voices.find(function (v) { return v.name.includes('Swara') || v.name.includes('Microsoft Hindi'); });
        if (!voice) voice = voices.find(function (v) { return v.name.includes('Google हिन्दी') || v.name.includes('Google Hindi'); });
        if (!voice) voice = voices.find(function (v) { return v.lang === 'en-IN' && (v.name.includes('Google') || v.name.includes('Microsoft')); });
        if (!voice) voice = voices.find(function (v) { return v.name === "Google US English"; }) ||
                            voices.find(function (v) { return v.lang === "en-US"; });
        if (!voice) voice = voices.find(function (v) { return v.lang.startsWith('hi'); }) ||
                            voices.find(function (v) { return v.lang.startsWith('en'); }) ||
                            voices[0];
        return voice;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.addEventListener("voiceschanged", pickBestVoice);

    return { isSupported, startListening, stopListening, speak, speakStreamBegin, speakStreamPush, speakStreamEnd, cancelSpeaking };
})();