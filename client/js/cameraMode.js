// ==========================================
// VED AI — CAMERA MODE CONTROLLER
// Flow: open camera → capture photo →
// type a question → get VED's answer →
// answer also lands in normal chat history.
// ==========================================

const CameraMode = (function () {

    let overlay, videoEl, canvasPreview, captureBtn, retakeBtn,
        askBtn, exitBtn, questionInput, statusEl, photoDataUrl;

    function init() {

        overlay = document.getElementById("cameraOverlay");
        videoEl = document.getElementById("cameraVideo");
        canvasPreview = document.getElementById("cameraPreviewImg");
        captureBtn = document.getElementById("cameraCaptureBtn");
        retakeBtn = document.getElementById("cameraRetakeBtn");
        askBtn = document.getElementById("cameraAskBtn");
        exitBtn = document.getElementById("cameraExitBtn");
        questionInput = document.getElementById("cameraQuestionInput");
        statusEl = document.getElementById("cameraStatus");

        captureBtn.addEventListener("click", handleCapture);
        retakeBtn.addEventListener("click", handleRetake);
        askBtn.addEventListener("click", handleAsk);
        exitBtn.addEventListener("click", close);

    }

    async function open() {

        if (!CameraEngine.isSupported) {
            alert("Camera isn't supported in this browser.");
            return;
        }

        overlay.classList.add("active");
        overlay.dataset.stage = "live";
        statusEl.textContent = "";
        questionInput.value = "";

        try {
            await CameraEngine.start(videoEl);
        } catch (err) {
            console.error(err);
            alert("Couldn't access the camera. Check permissions and try again.");
            close();
        }

    }

    function close() {

        CameraEngine.stop();
        overlay.classList.remove("active");
        overlay.dataset.stage = "live";
        photoDataUrl = null;

    }

    function handleCapture() {

        photoDataUrl = CameraEngine.capture(videoEl);
        canvasPreview.src = photoDataUrl;

        CameraEngine.stop();
        overlay.dataset.stage = "review"; // show captured photo + question input

    }

    function handleRetake() {
        overlay.dataset.stage = "live";
        CameraEngine.start(videoEl).catch(console.error);
    }

    async function handleAsk() {

        const question = questionInput.value.trim() || "What is this?";

        overlay.dataset.stage = "loading";
        statusEl.textContent = "VED is looking...";

        try {

            const response = await fetch("/vision", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: photoDataUrl, message: question })
            });

            const data = await response.json();

            // Reuses the same rendering + history pattern as chat/voice,
            // so photo Q&A shows up in the regular chat log too.
            renderInChat(question, data.reply, photoDataUrl);

            close();

            if (typeof speak === "function") speak(data.reply);

        } catch (err) {

            console.error(err);
            statusEl.textContent = "❌ Something went wrong. Try again.";
            overlay.dataset.stage = "review";

        }

    }

    function renderInChat(question, reply, thumbnailUrl) {

        if (!currentChatId || !chats[currentChatId]) {
            createNewChat();
        }

        if (chats[currentChatId].length === 0) {
            saveHistory("📷 " + question);
        }

        const userDiv = document.createElement("div");
        userDiv.className = "user-message";

        const thumb = document.createElement("img");
        thumb.src = thumbnailUrl;
        thumb.className = "chat-photo-thumb";
        userDiv.appendChild(thumb);

        const questionText = document.createElement("div");
        questionText.textContent = question;
        userDiv.appendChild(questionText);

        chatBox.appendChild(userDiv);

        const cleanReply = typeof stripMarkdown === "function" ? stripMarkdown(reply) : reply;

        const botDiv = document.createElement("div");
        botDiv.className = "bot-message";
        botDiv.textContent = "🤖 " + cleanReply;
        chatBox.appendChild(botDiv);

        chats[currentChatId].push({ sender: "user", text: "[Photo] " + question });
        chats[currentChatId].push({ sender: "bot", text: cleanReply });

        chatBox.scrollTop = chatBox.scrollHeight;

    }

    return { init, open, close };

})();

document.addEventListener("DOMContentLoaded", CameraMode.init);