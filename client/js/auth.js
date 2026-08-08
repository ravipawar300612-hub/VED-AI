// ==========================================
// VED AI — AUTH EXPERIENCE CONTROLLER
// Talks to the real endpoints in server/auth.js.
// ==========================================

const API_BASE = "";

const cards = document.querySelectorAll(".auth-card");
const successOverlay = document.querySelector(".auth-success");

// Carried between the forgot -> otp -> reset views
let pendingEmail = "";
let pendingCode = "";

// ===============================
// VIEW ROUTER
// ===============================

function showView(name) {

    cards.forEach(card => {
        card.hidden = card.dataset.view !== name;
    });

    successOverlay.hidden = true;

}

function routeFromHash() {
    const name = (location.hash || "#login").replace("#", "");
    const valid = ["login", "register", "forgot", "otp", "reset"];
    showView(valid.includes(name) ? name : "login");
}

window.addEventListener("hashchange", routeFromHash);
routeFromHash();

// ===============================
// PASSWORD SHOW / HIDE
// ===============================

document.querySelectorAll(".password-toggle-btn").forEach(btn => {

    btn.addEventListener("click", () => {

        const input = btn.closest(".auth-input-wrap").querySelector("input");
        const eyeIcon = btn.querySelector(".icon-eye");
        const eyeOffIcon = btn.querySelector(".icon-eye-off");

        const isHidden = input.type === "password";

        input.type = isHidden ? "text" : "password";
        eyeIcon.hidden = isHidden;
        eyeOffIcon.hidden = !isHidden;
        btn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");

    });

});

// ===============================
// CAPS LOCK WARNING
// ===============================

document.querySelectorAll('.auth-input[type="password"]').forEach(input => {

    const warning = input.closest(".auth-field").querySelector(".caps-warning");
    if (!warning) return;

    input.addEventListener("keyup", (e) => {
        const isCaps = e.getModifierState && e.getModifierState("CapsLock");
        warning.hidden = !isCaps;
    });

    input.addEventListener("blur", () => {
        warning.hidden = true;
    });

});

// ===============================
// FIELD VALIDATION HELPERS
// ===============================

function setFieldError(input, message) {

    const field = input.closest(".auth-field");
    if (!field) return;

    field.classList.add("has-error");
    field.querySelector(".field-error").textContent = message;

}

function clearFieldError(input) {

    const field = input.closest(".auth-field");
    if (!field) return;

    field.classList.remove("has-error");
    field.querySelector(".field-error").textContent = "";

}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function showBanner(card, message) {

    const banner = card.querySelector(".auth-error-banner");
    banner.textContent = message;
    banner.hidden = false;

}

function hideBanner(card) {
    card.querySelector(".auth-error-banner").hidden = true;
}

// ===============================
// SUBMIT BUTTON LOADING STATE
// ===============================

function setLoading(button, isLoading) {

    button.disabled = isLoading;
    button.querySelector(".btn-label").hidden = isLoading;
    button.querySelector(".btn-spinner").hidden = !isLoading;

}

async function callApi(path, body) {

    const response = await fetch(API_BASE + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
    }

    return data;

}

function showSuccess(title, subtitle, redirect) {

    successOverlay.querySelector(".success-title").textContent = title;
    successOverlay.querySelector(".success-sub").textContent = subtitle;
    successOverlay.hidden = false;

    if (redirect) {
        setTimeout(() => {
            window.location.href = "index.html";
        }, 1400);
    }

}

// ===============================
// LOGIN VIEW
// ===============================

const loginForm = document.querySelector('[data-view="login"]');

loginForm.addEventListener("submit", async (e) => {

    e.preventDefault();
    hideBanner(loginForm);

    const email = document.getElementById("loginEmail");
    const password = document.getElementById("loginPassword");
    const rememberMe = document.getElementById("rememberMe").checked;

    let hasError = false;

    if (!isValidEmail(email.value.trim())) {
        setFieldError(email, "Enter a valid email address");
        hasError = true;
    } else {
        clearFieldError(email);
    }

    if (password.value.length < 6) {
        setFieldError(password, "Password must be at least 6 characters");
        hasError = true;
    } else {
        clearFieldError(password);
    }

    if (hasError) return;

    const btn = loginForm.querySelector(".auth-submit-btn");
    setLoading(btn, true);

    try {

        const data = await callApi("/api/login", {
            email: email.value.trim(),
            password: password.value,
            rememberMe
        });

        setLoading(btn, false);
        showSuccess("Welcome back, " + data.name, "Redirecting to VED AI...", true);

    } catch (err) {

        setLoading(btn, false);
        showBanner(loginForm, err.message);

    }

});

// ===============================
// REGISTER VIEW
// ===============================

const registerForm = document.querySelector('[data-view="register"]');

registerForm.addEventListener("submit", async (e) => {

    e.preventDefault();
    hideBanner(registerForm);

    const name = document.getElementById("regName");
    const email = document.getElementById("regEmail");
    const password = document.getElementById("regPassword");

    let hasError = false;

    if (name.value.trim().length < 2) {
        setFieldError(name, "Enter your name");
        hasError = true;
    } else {
        clearFieldError(name);
    }

    if (!isValidEmail(email.value.trim())) {
        setFieldError(email, "Enter a valid email address");
        hasError = true;
    } else {
        clearFieldError(email);
    }

    if (password.value.length < 6) {
        setFieldError(password, "Password must be at least 6 characters");
        hasError = true;
    } else {
        clearFieldError(password);
    }

    if (hasError) return;

    const btn = registerForm.querySelector(".auth-submit-btn");
    setLoading(btn, true);

    try {

        const data = await callApi("/api/register", {
            name: name.value.trim(),
            email: email.value.trim(),
            password: password.value
        });

        setLoading(btn, false);
        showSuccess("Welcome, " + data.name, "Redirecting to VED AI...", true);

    } catch (err) {

        setLoading(btn, false);
        showBanner(registerForm, err.message);

    }

});

// ===============================
// FORGOT PASSWORD VIEW
// ===============================

const forgotForm = document.querySelector('[data-view="forgot"]');

forgotForm.addEventListener("submit", async (e) => {

    e.preventDefault();
    hideBanner(forgotForm);

    const email = document.getElementById("forgotEmail");

    if (!isValidEmail(email.value.trim())) {
        setFieldError(email, "Enter a valid email address");
        return;
    }

    clearFieldError(email);

    const btn = forgotForm.querySelector(".auth-submit-btn");
    setLoading(btn, true);

    try {

        await callApi("/api/forgot-password", { email: email.value.trim() });

        pendingEmail = email.value.trim();
        setLoading(btn, false);
        location.hash = "#otp";

    } catch (err) {

        setLoading(btn, false);
        showBanner(forgotForm, err.message);

    }

});

// ===============================
// OTP VERIFICATION VIEW
// ===============================

const otpForm = document.querySelector('[data-view="otp"]');
const otpBoxes = otpForm.querySelectorAll(".otp-box");

otpBoxes.forEach((box, index) => {

    box.addEventListener("input", () => {

        box.value = box.value.replace(/[^0-9]/g, "");

        if (box.value && index < otpBoxes.length - 1) {
            otpBoxes[index + 1].focus();
        }

    });

    box.addEventListener("keydown", (e) => {

        if (e.key === "Backspace" && !box.value && index > 0) {
            otpBoxes[index - 1].focus();
        }

    });

    box.addEventListener("paste", (e) => {

        e.preventDefault();
        const digits = (e.clipboardData.getData("text") || "").replace(/[^0-9]/g, "").split("");

        otpBoxes.forEach((b, i) => { b.value = digits[i] || ""; });

        const nextEmpty = Array.from(otpBoxes).findIndex(b => !b.value);
        (otpBoxes[nextEmpty] || otpBoxes[otpBoxes.length - 1]).focus();

    });

});

otpForm.addEventListener("submit", async (e) => {

    e.preventDefault();
    hideBanner(otpForm);

    const code = Array.from(otpBoxes).map(b => b.value).join("");

    if (code.length < 6) {
        showBanner(otpForm, "Enter the full 6-digit code");
        return;
    }

    const btn = otpForm.querySelector(".auth-submit-btn");
    setLoading(btn, true);

    try {

        await callApi("/api/verify-otp", { email: pendingEmail, code });

        pendingCode = code;
        setLoading(btn, false);
        location.hash = "#reset";

    } catch (err) {

        setLoading(btn, false);
        showBanner(otpForm, err.message);

    }

});

otpForm.querySelector(".resend-link").addEventListener("click", async (e) => {

    e.preventDefault();
    otpBoxes.forEach(b => { b.value = ""; });
    otpBoxes[0].focus();

    try {
        await callApi("/api/forgot-password", { email: pendingEmail });
    } catch (err) {
        showBanner(otpForm, err.message);
    }

});

// ===============================
// RESET PASSWORD VIEW
// ===============================

const resetForm = document.querySelector('[data-view="reset"]');

resetForm.addEventListener("submit", async (e) => {

    e.preventDefault();
    hideBanner(resetForm);

    const newPassword = document.getElementById("newPassword");
    const confirmPassword = document.getElementById("confirmPassword");

    let hasError = false;

    if (newPassword.value.length < 6) {
        setFieldError(newPassword, "Password must be at least 6 characters");
        hasError = true;
    } else {
        clearFieldError(newPassword);
    }

    if (confirmPassword.value !== newPassword.value || confirmPassword.value === "") {
        setFieldError(confirmPassword, "Passwords don't match");
        hasError = true;
    } else {
        clearFieldError(confirmPassword);
    }

    if (hasError) return;

    const btn = resetForm.querySelector(".auth-submit-btn");
    setLoading(btn, true);

    try {

        await callApi("/api/reset-password", {
            email: pendingEmail,
            code: pendingCode,
            password: newPassword.value
        });

        setLoading(btn, false);
        showSuccess("Password updated", "You can now sign in", false);

        setTimeout(() => { location.hash = "#login"; }, 1600);

    } catch (err) {

        setLoading(btn, false);
        showBanner(resetForm, err.message);

    }

});