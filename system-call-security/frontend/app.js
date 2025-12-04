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

// ---- Fun Simulation Messages ----
const simulationMessages = {
  fork: "🍴 <b>Process Forked!</b><br>Parent PID: 1024 -> Child PID: 4592 created.<br>Memory pages duplicated.",
  exec: "🚀 <b>Executing Binary...</b><br>Loading <code>/bin/custom_script</code> into memory.<br>Replaced process image.",
  wait: "⏳ <b>Waiting...</b><br>Parent process paused.<br>Received signal SIGCHLD from child process.",
  exit: "🚪 <b>Process Terminated</b><br>Process 4592 exited with status code 0.<br>Resources freed.",
  read: "📖 <b>Reading Data</b><br>Read 4096 bytes from file descriptor [3].<br>Buffer populated.",
  write: "✍️ <b>Writing Data</b><br>Flushed buffer to disk.<br>128 bytes written to <code>/var/log/sys.log</code>.",
  open: "📂 <b>Opening File</b><br>File <code>secret_data.txt</code> opened.<br>Assigned File Descriptor [3].",
  close: "🚫 <b>Closing File</b><br>File Descriptor [3] released.<br>File handle detached.",
  stat: "📊 <b>File Status</b><br>Inode: 83721<br>Size: 2KB<br>Permissions: -rw-r--r--"
};

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
  const simBox = document.getElementById("simulation-box");
  const simOut = document.getElementById("simulation-output");
  const aiCard = document.getElementById("ai-card"); // NEW

  // 1. Show "Processing" state immediately
  resultDiv.style.display = 'block';
  simBox.style.display = 'none';
  aiCard.style.display = 'none';
  
  resultDiv.innerHTML = `
    <div style="text-align:center; padding: 20px;">
      <i class="fas fa-microchip fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
      <p class="text-muted mt-3">AI Neural Engine is analyzing <b>${syscall}()</b> request...</p>
    </div>
  `;

  // 2. Add the 3-second delay (HOLD)
  await new Promise(resolve => setTimeout(resolve, 3000));

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
    
    // Check if error
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

    // 3. Show Final Result
    resultDiv.innerHTML = `
      <div class="mt-3">
        <div class="${badgeClass}">
          <span class="icon">${icon}</span>
          <span>${data.status.toUpperCase()}</span>
        </div>
        <p class="text-muted mb-2">Policy Check: <b>${data.reason}</b></p>
        <p class="text-muted" style="font-size:0.8rem">Timestamp: ${new Date(data.timestamp).toLocaleString()}</p>
      </div>
    `;

    // 4. Update AI Card (NEW)
    if (data.aiResult) {
        aiCard.style.display = 'block';
        const risk = data.aiResult.riskScore;
        const bar = document.getElementById("ai-risk-bar");
        const badge = document.getElementById("ai-risk-badge");
        const text = document.getElementById("ai-analysis-text");

        // Color logic for risk bar
        let color = "#22c55e"; // Green
        let riskLabel = "LOW RISK";
        if(risk > 40) { color = "#fbbf24"; riskLabel = "MODERATE RISK"; } // Yellow
        if(risk > 75) { color = "#ef4444"; riskLabel = "HIGH RISK"; } // Red

        badge.textContent = `${riskLabel} (${risk}%)`;
        badge.className = risk > 75 ? "badge blocked" : (risk > 40 ? "badge warning" : "badge allowed");
        
        // Animate Bar
        setTimeout(() => {
            bar.style.width = `${risk}%`;
            bar.style.backgroundColor = color;
        }, 100);

        // Typewriter effect for text
        text.innerHTML = `<b>AI Analysis:</b> ${data.aiResult.details}`;
    }

    // 5. Show Simulation Message if Allowed
    if (data.status === "allowed") {
        simBox.style.display = 'block';
        const simMsg = simulationMessages[syscall] || "Operation executed successfully.";
        simOut.innerHTML = simMsg;
    }

    // 6. Update Logs
    await loadLogs();

  } catch (err) {
    console.error(err);
    resultDiv.innerHTML = `<p class="text-muted">Error connecting to server.</p>`;
  }
}

async function loadLogs() {
  const tbody = document.getElementById("logs-body");
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/logs`);
    const logs = await res.json();

    if (!Array.isArray(logs) || logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center">No logs recorded yet.</td></tr>`;
      return;
    }

    // Clear current rows only when we have the new data ready
    tbody.innerHTML = "";
    
    logs
      .slice()
      .reverse()
      .forEach(entry => {
        const tr = document.createElement("tr");
        
        if(entry.status === 'blocked') {
            tr.style.backgroundColor = "rgba(254, 226, 226, 0.1)"; // Very subtle red tint
        }

        const dateObj = new Date(entry.timestamp);
        const timeStr = dateObj.toLocaleString(); 
        
        // Show risk score in logs if available
        let riskDisplay = "-";
        if(entry.aiResult && entry.aiResult.riskScore) {
            const r = entry.aiResult.riskScore;
            let color = "green";
            if(r > 40) color = "orange";
            if(r > 75) color = "red";
            riskDisplay = `<span style="color:${color}; font-weight:bold;">${r}%</span>`;
        }

        tr.innerHTML = `
          <td style="font-size:0.8rem; white-space:nowrap;">${timeStr}</td>
          <td><b>${entry.username}</b></td>
          <td><span class="badge" style="font-size:0.7rem; padding: 2px 8px; background: rgba(0,0,0,0.05); color: #94a3b8;">${entry.role}</span></td>
          <td style="font-family: var(--font-mono); color: var(--primary);">${entry.syscall}()</td>
          <td>
            <span class="badge ${entry.status === 'allowed' ? 'allowed' : 'blocked'}">
              ${entry.status}
            </span>
          </td>
          <td class="text-muted" style="font-size:0.85rem">${riskDisplay}</td>
        `;
        tbody.appendChild(tr);
      });
  } catch (err) {
    console.error(err);
    if(tbody.innerHTML === "") {
        tbody.innerHTML = `<tr><td colspan="6">Failed to load logs.</td></tr>`;
    }
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
    userSpan.innerHTML = `Logged in as <b>${user.username}</b> <span class="badge" style="background:rgba(255,255,255,0.3); color:#333;">${user.role}</span>`;

    document
      .getElementById("logout-link")
      .addEventListener("click", e => {
        e.preventDefault();
        clearUser();
        window.location.href = "login.html";
      });

    syscallForm.addEventListener("submit", submitSyscall);
    
    // Refresh Logic
    document
      .getElementById("refresh-logs")
      .addEventListener("click", loadLogs);

    // NEW: Clear Logic
    document
      .getElementById("clear-logs")
      .addEventListener("click", async () => {
        if(confirm("Are you sure you want to clear all system logs? This cannot be undone.")) {
            try {
                await fetch(`${API_BASE}/logs/clear`, { method: "POST" });
                loadLogs();
            } catch(e) {
                alert("Failed to clear logs");
            }
        }
      });

    loadLogs();
  }
});