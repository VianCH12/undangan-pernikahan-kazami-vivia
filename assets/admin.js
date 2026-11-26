import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-config.js";

const apiUrl = SUPABASE_URL + "/functions/v1/admin-api";
const loginPanel = document.getElementById("loginPanel");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("loginForm");
const loginStatus = document.getElementById("loginStatus");
const dashboardStatus = document.getElementById("dashboardStatus");
const guestRows = document.getElementById("guestRows");
let adminSession = sessionStorage.getItem("adminSession") || "";

function showLogin(message) {
    loginPanel.hidden = false;
    dashboard.hidden = true;
    if (message) {
        loginStatus.textContent = message;
    }
}

function showDashboard() {
    loginPanel.hidden = true;
    dashboard.hidden = false;
}

async function adminRequest(action, values = {}, session = adminSession) {
    const headers = {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY
    };
    if (session) {
        headers.Authorization = "Bearer " + session;
    }

    const response = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ action, ...values })
    });
    let result;
    try {
        result = await response.json();
    } catch {
        throw new Error("Respons dari server admin tidak valid.");
    }
    if (!response.ok) {
        if (response.status === 401 && action !== "login") {
            adminSession = "";
            sessionStorage.removeItem("adminSession");
        }
        throw new Error(result.error || "Permintaan admin gagal.");
    }
    return result;
}

function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value;
    row.appendChild(cell);
    return cell;
}

function invitationUrl(token) {
    const url = new URL("index.html", window.location.href);
    url.searchParams.set("token", token);
    return url.toString();
}

function renderGuests(guests) {
    guestRows.replaceChildren();
    if (!guests.length) {
        const row = document.createElement("tr");
        const cell = addCell(row, "Belum ada tamu. Tambahkan nama untuk membuat link undangan.");
        cell.colSpan = 4;
        guestRows.appendChild(row);
        return;
    }

    guests.forEach((guest) => {
        const row = document.createElement("tr");
        addCell(row, guest.nama);
        addCell(row, guest.status_konfirmasi || "Menunggu");
        addCell(row, String(guest.jumlah_kehadiran ?? 0));

        const linkCell = document.createElement("td");
        const actions = document.createElement("div");
        actions.className = "link-actions";
        const url = invitationUrl(guest.invitation_token);
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Buka";

        const copyButton = document.createElement("button");
        copyButton.type = "button";
        copyButton.className = "copy-button";
        copyButton.textContent = "Salin link";
        copyButton.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(url);
                dashboardStatus.textContent = "Link untuk " + guest.nama + " berhasil disalin.";
            } catch (error) {
                console.error("Gagal menyalin link undangan.", error);
                dashboardStatus.textContent = "Link tidak dapat disalin. Buka link lalu salin dari bilah alamat.";
            }
        });

        actions.append(link, copyButton);
        linkCell.appendChild(actions);
        row.appendChild(linkCell);
        guestRows.appendChild(row);
    });
}

async function loadGuests() {
    const { guests } = await adminRequest("list");
    renderGuests(guests);
    dashboardStatus.textContent = "";
    showDashboard();
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY.trim()) {
        loginStatus.textContent = "Lengkapi URL project dan publishable/anon key di assets/supabase-config.js.";
        return;
    }

    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const fields = new FormData(form);
    button.disabled = true;
    loginStatus.textContent = "Memeriksa password...";

    try {
        const result = await adminRequest("login", { password: fields.get("password") }, "");
        adminSession = result.session_token;
        sessionStorage.setItem("adminSession", adminSession);
        form.reset();
        await loadGuests();
    } catch (error) {
        loginStatus.textContent = error instanceof Error ? error.message : "Login gagal.";
    } finally {
        button.disabled = false;
    }
});

document.getElementById("guestForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const fields = new FormData(form);
    const name = String(fields.get("name") || "").trim();
    button.disabled = true;
    dashboardStatus.textContent = "Menambahkan tamu...";

    try {
        const result = await adminRequest("add", { name });
        form.reset();
        dashboardStatus.textContent = result.message;
        await loadGuests();
    } catch (error) {
        dashboardStatus.textContent = error instanceof Error ? error.message : "Tamu tidak berhasil ditambahkan.";
        if (!adminSession) showLogin(dashboardStatus.textContent);
    } finally {
        button.disabled = false;
    }
});

document.getElementById("logoutButton").addEventListener("click", async () => {
    let message = "Anda telah keluar.";
    try {
        await adminRequest("logout");
    } catch (error) {
        console.error("Gagal mengakhiri sesi admin.", error);
        message = "Sesi lokal dihapus, tetapi server gagal mengakhiri sesi.";
    } finally {
        adminSession = "";
        sessionStorage.removeItem("adminSession");
        showLogin(message);
    }
});

async function initializeAdmin() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY.trim()) {
        loginStatus.textContent = "Lengkapi URL project dan publishable/anon key di assets/supabase-config.js.";
        return;
    }
    if (!adminSession) {
        showLogin();
        return;
    }

    try {
        await loadGuests();
    } catch (error) {
        adminSession = "";
        sessionStorage.removeItem("adminSession");
        showLogin(error instanceof Error ? error.message : "Admin tidak dapat dimuat.");
    }
}

initializeAdmin();
