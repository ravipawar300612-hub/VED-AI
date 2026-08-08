// ==========================================
// VED AI SCRIPT v9.0
// Founder : Sayali P. R. Pawar
// ==========================================

// ===============================
// ELEMENTS
// ===============================

const input = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const chatBox = document.getElementById("chatMessages");
const newChatBtn = document.getElementById("newChatBtn");
const micBtn = document.getElementById("micBtn");
const cameraBtn = document.getElementById("cameraBtn");

const attachBtn = document.getElementById("attachBtn");
const fileInput = document.getElementById("fileInput");
const attachmentPreview = document.getElementById("attachmentPreview");

// ===============================
// CHAT DATA
// ===============================

let chats = {};
let currentChatId = null;

// Files the user has picked but not sent yet.
// Each entry: { name, type, isImage, dataUrl }
let attachedFiles = [];

// ===============================
// SPEECH RECOGNITION
// ===============================

// Note: raw SpeechRecognition setup lives in js/speechEngine.js,
// which both this file and voiceMode.js share. See that module for
// browser-support guarding.

// ===============================
// TEXT TO SPEECH
// ===============================

function speak(text) {

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);

    speech.lang = "en-GB";
    speech.rate = 0.9;
    speech.pitch = 1;
    speech.volume = 1;

    window.speechSynthesis.speak(speech);

}

// Strip common markdown symbols so they don't show up as literal
// characters in the chat or get read out loud by the voice.
function stripMarkdown(text) {

    return text
        .replace(/\*\*(.*?)\*\*/g, "$1")   // **bold**
        .replace(/\*(.*?)\*/g, "$1")       // *italic*
        .replace(/__(.*?)__/g, "$1")       // __bold__
        .replace(/_(.*?)_/g, "$1")         // _italic_
        .replace(/`{1,3}(.*?)`{1,3}/g, "$1") // `code` / ```code```
        .replace(/^#{1,6}\s*/gm, "")       // # headers
        .replace(/^[-*]\s+/gm, "")         // - bullet points
        .trim();

}

// ===============================
// CREATE NEW CHAT
// ===============================

function createNewChat() {

    currentChatId = Date.now().toString();

    chats[currentChatId] = [];

    chatBox.innerHTML = `
        <div class="bot-message">
            <b>Welcome to VED AI</b>
            <br><br>
            Your Intelligent AI Companion.
            <br>
            Ask me anything.
        </div>
    `;

    input.value = "";

    attachedFiles = [];
    renderAttachments();

}

// ===============================
// SAVE HISTORY
// Delegates to the Sidebar module (js/sidebar.js),
// which owns rendering, search, grouping, and the
// rename/delete context menu.
// ===============================

function saveHistory(title) {
    Sidebar.addChat(currentChatId, title);
}

// ===============================
// ATTACHMENTS
// ===============================

function fileToDataUrl(file) {

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

}

async function handleFileSelect(e) {

    const files = Array.from(e.target.files);

    for (const file of files) {

        const dataUrl = await fileToDataUrl(file);

        attachedFiles.push({
            name: file.name,
            type: file.type,
            isImage: file.type.startsWith("image/"),
            dataUrl
        });

    }

    fileInput.value = ""; // allow picking the same file again later
    renderAttachments();

}

function fileIconSvg() {
    return `
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/>
            <path d="M14 3v5h5"/>
        </svg>
    `;
}

function renderAttachments() {

    attachmentPreview.innerHTML = "";

    if (attachedFiles.length === 0) {
        attachmentPreview.style.display = "none";
        return;
    }

    attachmentPreview.style.display = "flex";

    attachedFiles.forEach((f, index) => {

        const chip = document.createElement("div");
        chip.className = "attachment-chip";

        if (f.isImage) {
            const img = document.createElement("img");
            img.src = f.dataUrl;
            chip.appendChild(img);
        } else {
            const icon = document.createElement("div");
            icon.className = "attachment-file-icon";
            icon.innerHTML = fileIconSvg();
            chip.appendChild(icon);
        }

        const name = document.createElement("span");
        name.className = "attachment-name";
        name.textContent = f.name;
        chip.appendChild(name);

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "attachment-remove";
        removeBtn.setAttribute("aria-label", "Remove attachment");
        removeBtn.textContent = "\u00D7";
        removeBtn.addEventListener("click", () => {
            attachedFiles.splice(index, 1);
            renderAttachments();
        });
        chip.appendChild(removeBtn);

        attachmentPreview.appendChild(chip);

    });

}

attachBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", handleFileSelect);

// ===============================
// SHARED NETWORK CALLS
// Used by text mode, voice mode (js/voiceMode.js), and
// attachments below — so every conversation lands in the
// same chat history no matter how it was sent.
// ===============================

window.VedChat = (function () {

    async function sendToServer(message, { showThinkingBubble = true } = {}) {

        if (!currentChatId || !chats[currentChatId]) {
            createNewChat();
        }

        if (chats[currentChatId].length === 0) {
            saveHistory(message);
        }

        chats[currentChatId].push({ sender: "user", text: message });

        const userDiv = document.createElement("div");
        userDiv.className = "user-message";
        userDiv.textContent = message;
        chatBox.appendChild(userDiv);

        let thinking = null;

        if (showThinkingBubble) {
            thinking = document.createElement("div");
            thinking.className = "bot-message";
            thinking.innerHTML = "<i>VED is thinking...</i>";
            chatBox.appendChild(thinking);
        }

        chatBox.scrollTop = chatBox.scrollHeight;

        try {

            const response = await fetch("/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: message })
            });

            const data = await response.json();

            if (thinking) thinking.remove();

            const cleanReply = stripMarkdown(data.reply);

            chats[currentChatId].push({ sender: "bot", text: cleanReply });

            const botDiv = document.createElement("div");
            botDiv.className = "bot-message";
            botDiv.textContent = cleanReply;
            chatBox.appendChild(botDiv);

            chatBox.scrollTop = chatBox.scrollHeight;

            return cleanReply;

        } catch (err) {

            console.error(err);

            if (thinking) thinking.remove();

            const errorDiv = document.createElement("div");
            errorDiv.className = "bot-message";
            errorDiv.textContent = "Error connecting to server.";
            chatBox.appendChild(errorDiv);

            return "Sorry, I ran into an error connecting to the server.";

        }

    }

    // Sends one image + a question to the existing /vision endpoint
    // (the same one Camera Mode uses), so VED can actually look at it.
    async function sendImageToServer(imageDataUrl, message) {

        if (!currentChatId || !chats[currentChatId]) {
            createNewChat();
        }

        if (chats[currentChatId].length === 0) {
            saveHistory(message || "Photo");
        }

        chats[currentChatId].push({ sender: "user", text: message });

        const userDiv = document.createElement("div");
        userDiv.className = "user-message";

        const thumb = document.createElement("img");
        thumb.src = imageDataUrl;
        thumb.className = "chat-photo-thumb";
        userDiv.appendChild(thumb);

        if (message) {
            const textPart = document.createElement("div");
            textPart.textContent = message;
            userDiv.appendChild(textPart);
        }

        chatBox.appendChild(userDiv);

        const thinking = document.createElement("div");
        thinking.className = "bot-message";
        thinking.innerHTML = "<i>VED is looking...</i>";
        chatBox.appendChild(thinking);

        chatBox.scrollTop = chatBox.scrollHeight;

        try {

            const response = await fetch("/vision", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: imageDataUrl, message: message || "What is this?" })
            });

            const data = await response.json();

            thinking.remove();

            const cleanReply = stripMarkdown(data.reply);

            chats[currentChatId].push({ sender: "bot", text: cleanReply });

            const botDiv = document.createElement("div");
            botDiv.className = "bot-message";
            botDiv.textContent = cleanReply;
            chatBox.appendChild(botDiv);

            chatBox.scrollTop = chatBox.scrollHeight;

            return cleanReply;

        } catch (err) {

            console.error(err);

            thinking.remove();

            const errorDiv = document.createElement("div");
            errorDiv.className = "bot-message";
            errorDiv.textContent = "Error analyzing the image.";
            chatBox.appendChild(errorDiv);

            return "Sorry, I ran into an error analyzing that image.";

        }

    }

    // Sends a PDF's raw bytes + a question to the /document route,
    // which extracts real text and lets VED actually read it.
    async function sendDocumentToServer(fileDataUrl, fileName, message) {

        if (!currentChatId || !chats[currentChatId]) {
            createNewChat();
        }

        if (chats[currentChatId].length === 0) {
            saveHistory(message || fileName);
        }

        chats[currentChatId].push({ sender: "user", text: message || fileName });

        const userDiv = document.createElement("div");
        userDiv.className = "user-message";

        const fileTag = document.createElement("div");
        fileTag.className = "chat-file-tag";
        fileTag.innerHTML = fileIconSvg();
        const fileTagName = document.createElement("span");
        fileTagName.textContent = fileName;
        fileTag.appendChild(fileTagName);
        userDiv.appendChild(fileTag);

        if (message) {
            const textPart = document.createElement("div");
            textPart.textContent = message;
            userDiv.appendChild(textPart);
        }

        chatBox.appendChild(userDiv);

        const thinking = document.createElement("div");
        thinking.className = "bot-message";
        thinking.innerHTML = "<i>VED is reading the document...</i>";
        chatBox.appendChild(thinking);

        chatBox.scrollTop = chatBox.scrollHeight;

        try {

            const response = await fetch("/document", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ document: fileDataUrl, message: message || "Summarize this document." })
            });

            const data = await response.json();

            thinking.remove();

            const cleanReply = stripMarkdown(data.reply);

            chats[currentChatId].push({ sender: "bot", text: cleanReply });

            const botDiv = document.createElement("div");
            botDiv.className = "bot-message";
            botDiv.textContent = cleanReply;
            chatBox.appendChild(botDiv);

            chatBox.scrollTop = chatBox.scrollHeight;

            return cleanReply;

        } catch (err) {

            console.error(err);

            thinking.remove();

            const errorDiv = document.createElement("div");
            errorDiv.className = "bot-message";
            errorDiv.textContent = "Error reading that document.";
            chatBox.appendChild(errorDiv);

            return "Sorry, I ran into an error reading that document.";

        }

    }

    return { sendToServer, sendImageToServer, sendDocumentToServer };

})();

// ===============================
// SEND MESSAGE (text mode + attachments)
// ===============================

async function sendMessage() {

    const message = input.value.trim();

    if (message === "" && attachedFiles.length === 0) return;

    input.value = "";

    const imageFile = attachedFiles.find(f => f.isImage);
    const pdfFile = attachedFiles.find(f => f.type === "application/pdf");
    const otherFiles = attachedFiles.filter(f => !f.isImage && f.type !== "application/pdf");

    let cleanReply;

    if (imageFile) {

        // VED can actually see this one via /vision.
        cleanReply = await window.VedChat.sendImageToServer(imageFile.dataUrl, message);

    } else if (pdfFile) {

        // VED can actually read this one via /document.
        cleanReply = await window.VedChat.sendDocumentToServer(pdfFile.dataUrl, pdfFile.name, message);

    } else if (otherFiles.length > 0) {

        // No parser for this file type yet (.doc/.docx/.txt) — VED
        // gets the filename as context, not the file's actual contents.
        const names = otherFiles.map(f => f.name).join(", ");
        const finalMessage = (message ? message + " " : "") + `[Attached file(s): ${names}]`;
        cleanReply = await window.VedChat.sendToServer(finalMessage);

    } else {

        cleanReply = await window.VedChat.sendToServer(message);

    }

    attachedFiles = [];
    renderAttachments();

    speak(cleanReply);

}

// ===============================
// SIDEBAR HOOKS
// Wires the Sidebar module (search/collapse/grouping/
// context menu UI) to this file's actual chat data.
// ===============================

Sidebar.onSelect(function (id) {

    if (!chats[id]) return;

    currentChatId = id;

    chatBox.innerHTML = "";

    chats[id].forEach(msg => {

        const div = document.createElement("div");

        if (msg.sender === "user") {
            div.className = "user-message";
        } else {
            div.className = "bot-message";
        }

        div.textContent = msg.text;

        chatBox.appendChild(div);

    });

    chatBox.scrollTop = chatBox.scrollHeight;

});

Sidebar.onDelete(function (id) {

    delete chats[id];

    // If the conversation being deleted is the one on screen,
    // drop back to a fresh chat instead of showing stale messages.
    if (id === currentChatId) {
        createNewChat();
    }

});

// ===============================
// BUTTON EVENTS
// ===============================

sendBtn.addEventListener("click", sendMessage);

input.addEventListener("keydown", function (e) {

    if (e.key === "Enter") {
        sendMessage();
    }

});

newChatBtn.addEventListener("click", createNewChat);

// ===============================
// MICROPHONE — opens the dedicated Voice Mode overlay
// (see js/speechEngine.js + js/voiceMode.js)
// ===============================

micBtn.addEventListener("click", () => {
    VoiceMode.open();
});

cameraBtn.addEventListener("click", () => {
    CameraMode.open();
});

// ===============================
// WAKE WORD TOGGLE — "Hey VED"
// (see js/wakeWord.js). Off by default.
// ===============================

const wakeWordToggleBtn = document.getElementById("wakeWordToggleBtn");

wakeWordToggleBtn.addEventListener("click", () => {
    WakeWord.toggle();
});

// ===============================
// START APP
// ===============================

window.onload = async () => {

    console.log("VED AI started");

    currentChatId = Date.now().toString();
    chats[currentChatId] = [];

    // Restore past conversation from the database, if any exists,
    // so a page refresh doesn't wipe the chat. Your DB currently
    // stores one continuous timeline rather than separate named
    // conversations, so this brings it back as one thread.
    try {

        const res = await fetch("/history");
        const data = await res.json();

        if (data.history && data.history.length > 0) {

            chatBox.innerHTML = "";

            data.history.forEach(row => {

                const sender = row.role === "user" ? "user" : "bot";
                chats[currentChatId].push({ sender, text: row.message });

                const div = document.createElement("div");
                div.className = sender === "user" ? "user-message" : "bot-message";
                div.textContent = row.message;
                chatBox.appendChild(div);

            });

            const firstUserMsg = data.history.find(r => r.role === "user");
            saveHistory(firstUserMsg ? firstUserMsg.message : "Previous conversation");

            chatBox.scrollTop = chatBox.scrollHeight;

        }

    } catch (err) {
        console.error("Could not load past history:", err);
    }

    window.speechSynthesis.getVoices();

};

window.speechSynthesis.onvoiceschanged = () => {

    window.speechSynthesis.getVoices();

};