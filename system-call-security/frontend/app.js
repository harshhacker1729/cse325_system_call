const API_BASE = "http://localhost:5001/api";

// ---- Storage helpers ----
function saveUser(user) {
  localStorage.setItem("scs_user", JSON.stringify(user));
}

function getUser() {
  const raw = localStorage.getItem("scs_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearUser() {
  localStorage.removeItem("scs_user");
}

// ---- Login page logic ----
async function handleLoginSubmit(event) {
  event.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const msg = document.getElementById("login-message");
  msg.textContent = "Logging in...";

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      msg.textContent = "Invalid username or password.";
      return;
    }

    const data = await res.json();
    if (data.success) {
      saveUser({ username: data.username, role: data.role });
      msg.textContent = "Login successful. Redirecting...";
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 800);
    } else {
      msg.textContent = data.message || "Login failed.";
    }
  } catch (err) {
    console.error(err);
    msg.textContent = "Error connecting to server.";
  }
}

// ---- Dashboard logic ----
async function submitSyscall(event) {
  event.preventDefault();
  const user = getUser();
  if (!user) {
    alert("Please login again.");
    window.location.href = "login.html";
    return;
  }

  const select = document.getElementById("syscall-select");
  const syscall = select.value;
  if (!syscall) return;

  const resultDiv = document.getElementById("syscall-result");
  resultDiv.innerHTML = "<p class='text-muted'>Processing...</p>";

  try {
    const res = await fetch(`${API_BASE}/syscall`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: user.username,
        role: user.role,
        syscall
      })
    });

    const data = await res.json();
    if (!data.success) {
      resultDiv.innerHTML = `<p class="text-muted">${data.message}</p>`;
      return;
    }

    const badgeClass =
      data.status === "allowed"
        ? "badge allowed"
        : data.status === "blocked"
        ? "badge blocked"
        : "badge warning";

    const icon =
      data.status === "allowed"
        ? "✅"
        : data.status === "blocked"
        ? "⛔"
        : "⚠️";

    resultDiv.innerHTML = `
      <div class="mt-3">
        <div class="${badgeClass}">
          <span class="icon">${icon}</span>
          <span>${data.status.toUpperCase()}</span>
        </div>
        <p class="text-muted mb-2">Reason: ${data.reason}</p>
        <p class="text-muted">Logged at: ${data.timestamp}</p>
      </div>
    `;

    await loadLogs();
  } catch (err) {
    console.error(err);
    resultDiv.innerHTML = `<p class="text-muted">Error connecting to server.</p>`;
  }
}

async function loadLogs() {
  const tbody = document.getElementById("logs-body");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6">Loading...</td></tr>`;

  try {
    const res = await fetch(`${API_BASE}/logs`);
    const logs = await res.json();

    if (!Array.isArray(logs) || logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6">No logs yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    logs
      .slice()
      .reverse()
      .forEach(entry => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${entry.timestamp}</td>
          <td>${entry.username}</td>
          <td>${entry.role}</td>
          <td>${entry.syscall}</td>
          <td>${entry.status}</td>
          <td>${entry.reason}</td>
        `;
        tbody.appendChild(tr);
      });
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="6">Failed to load logs.</td></tr>`;
  }
}

// ---- Init per page ----
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLoginSubmit);
  }

  const syscallForm = document.getElementById("syscall-form");
  if (syscallForm) {
    const user = getUser();
    if (!user) {
      alert("You must login first.");
      window.location.href = "login.html";
      return;
    }

    const userSpan = document.getElementById("current-user");
    userSpan.textContent = `${user.username} (${user.role})`;

    document
      .getElementById("logout-link")
      .addEventListener("click", e => {
        e.preventDefault();
        clearUser();
        window.location.href = "login.html";
      });

    syscallForm.addEventListener("submit", submitSyscall);
    document
      .getElementById("refresh-logs")
      .addEventListener("click", loadLogs);
    loadLogs();
  }
});
