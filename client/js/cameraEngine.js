// ==========================================
// VED AI — CAMERA ENGINE MODULE
// Wraps getUserMedia + photo capture behind
// a simple interface, same pattern as
// speechEngine.js.
// ==========================================

const CameraEngine = (function () {

    let stream = null;

    const isSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

    async function start(videoEl) {

        if (!isSupported) {
            throw new Error("Camera not supported in this browser.");
        }

        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });

        videoEl.srcObject = stream;
        await videoEl.play();

    }

    function stop() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
    }

    // Captures the current video frame as a base64 JPEG data URL.
    function capture(videoEl) {

        const canvas = document.createElement("canvas");
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;

        canvas.getContext("2d").drawImage(videoEl, 0, 0);

        return canvas.toDataURL("image/jpeg", 0.85);

    }

    return {
        isSupported,
        start,
        stop,
        capture,
        get isActive() { return !!stream; }
    };

})();