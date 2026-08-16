// ==========================================
// VED AI — AUTH GUARD
// Runs before anything else on index.html.
// Redirects to login.html if there's no valid
// session, and shows the logged-in user's name
// + a logout control in the sidebar footer.
// ==========================================

(async function () {

    try {

        const res = await fetch("/api/me", { credentials: "include" });

        if (!res.ok) {
            window.location.href = "login.html";
            return;
        }

        const data = await res.json();

        document.addEventListener("DOMContentLoaded", () => {

            const footer = document.querySelector(".sb-footer");
            if (!footer) return;

            footer.textContent = "";

            const nameSpan = document.createElement("span");
            nameSpan.textContent = data.name;
            footer.appendChild(nameSpan);

            const logoutBtn = document.createElement("button");
            logoutBtn.type = "button";
            logoutBtn.textContent = "Log out";
            logoutBtn.style.cssText = "margin-left:8px;background:none;border:none;color:inherit;opacity:.7;cursor:pointer;text-decoration:underline;font-size:11px;padding:0;";

            logoutBtn.addEventListener("click", async () => {
                await fetch("/api/logout", { method: "POST", credentials: "include" });
                window.location.href = "login.html";
            });

            footer.appendChild(logoutBtn);

        });

    } catch (err) {
        window.location.href = "login.html";
    }

})();