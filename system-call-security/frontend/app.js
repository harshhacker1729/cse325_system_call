const API_BASE = "http://localhost:5001/api";

// ==========================================
// 1. AUTH & STORAGE
// ==========================================
function getUser() {
    try { return JSON.parse(localStorage.getItem("scs_user")); } catch { return null; }
}

function saveUser(user) {
    localStorage.setItem("scs_user", JSON.stringify(user));
}

// Global Logout Function (Matches HTML onclick="logout()")
window.logout = function() {
    localStorage.removeItem("scs_user");
    window.location.href = "login.html";
};

// ==========================================
// 2. TERMINAL OUTPUT LOGIC
// ==========================================
const terminalOutput = document.getElementById("terminal-output");

const terminalMessages = {
    fork:  `clone(child_stack=0, flags=CLONE_CHILD_CLEARTID|...)\n[KERNEL] Process created. PID: $PID\n[INFO] Memory pages COW (Copy-On-Write) initialized.`,
    exec:  `execve("/bin/custom_script", ["script"], 0x7ff...)\n[KERNEL] Replaced process image.\n[INFO] Entry point moved to 0x400080. Loading ELF headers...`,
    wait:  `wait4(-1, NULL, 0, NULL)\n[KERNEL] Parent process paused. Waiting for SIGCHLD signal...\n[INFO] Context switch: CPU yielded.`,
    exit:  `exit_group(0)\n[KERNEL] Process detached. Closing file descriptors.\n[INFO] PCB (Process Control Block) removed from scheduler.`,
    read:  `read(3, buffer, 4096)\n[KERNEL] VFS: accessing inode 84721...\n[SUCCESS] Copied 4096 bytes from kernel space to user buffer.`,
    write: `write(1, "data", 128)\n[KERNEL] I/O Scheduler: merging write request.\n[SUCCESS] Flushed dirty pages to /dev/sda1 (sector 50293).`,
    open:  `openat(AT_FDCWD, "secret_data.txt", O_RDONLY)\n[KERNEL] Checking permissions... OK.\n[SUCCESS] File descriptor 3 assigned to inode 33201.`,
    close: `close(3)\n[KERNEL] Releasing file descriptor 3...\n[SUCCESS] Reference count decremented. Resource freed.`,
    stat:  `stat("/etc/passwd", {st_mode=S_IFREG|0644, st_size=2048})\n[KERNEL] Reading directory entry cache...\n[SUCCESS] Metadata retrieved.`,
    mkdir: `mkdir("/home/user/new_folder", 0755)\n[KERNEL] VFS: Allocating new dentry.\n[SUCCESS] Directory node created.`,
    rmdir: `rmdir("/tmp/junk_folder")\n[KERNEL] Unlinking directory inode...\n[SUCCESS] Directory removed. Blocks marked as free.`,
    chown: `chown("/var/www/html", 1000, 1000)\n[KERNEL] Updating inode owner/group bits...\n[SUCCESS] File ownership changed to UID:1000 GID:1000.`
};

function printToTerminal(html) {
    if (!terminalOutput) return;
    const div = document.createElement("div");
    div.className = "mb-1 border-l-2 pl-2 border-transparent hover:border-slate-600 transition-colors";
    div.innerHTML = html;
    terminalOutput.appendChild(div);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

// ==========================================
// 3. DASHBOARD STATS & CHARTING LOGIC (NEW)
// ==========================================

let syscallTrendChart = null;
let syscallTypeChart = null;

async function fetchAndRenderDashboardStats() {
    try {
        const res = await fetch(`${API_BASE}/stats`);
        const stats = await res.json();
        
        // 1. Update KPI Cards
        document.getElementById("kpi-total-users").textContent = stats.totalUsers;
        document.getElementById("kpi-total-syscalls").textContent = stats.totalSyscalls;
        document.getElementById("kpi-total-allowed").textContent = stats.totalAllowed;
        document.getElementById("kpi-total-blocked").textContent = stats.totalBlocked;

        // 2. Update Top User Panel
        document.getElementById("top-user-username").textContent = stats.topUser.username;
        document.getElementById("top-user-role").textContent = `Role: ${stats.topUser.role}`;
        document.getElementById("top-user-count").textContent = stats.topUser.count;

        // 3. Render Syscall Trend Chart (Line Chart)
        const trendData = stats.syscallTrend.map(d => d.count);
        const trendLabels = stats.syscallTrend.map(d => `${d.hour}:00`);

        if (syscallTrendChart) {
            syscallTrendChart.data.labels = trendLabels;
            syscallTrendChart.data.datasets[0].data = trendData;
            syscallTrendChart.update();
        } else {
            const ctx = document.getElementById('syscall-trend-chart').getContext('2d');
            syscallTrendChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: trendLabels,
                    datasets: [{
                        label: 'Syscalls per Hour',
                        data: trendData,
                        borderColor: '#3b82f6', // Blue 500
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        borderWidth: 2,
                        tension: 0.4,
                        pointRadius: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: '#e2e8f0' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#e2e8f0' }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        title: { display: false }
                    }
                }
            });
        }

        // 4. Render Syscall Type Distribution Chart (Doughnut Chart)
        const distributionLabels = Object.keys(stats.syscallDistribution);
        const distributionData = Object.values(stats.syscallDistribution);
        const backgroundColors = distributionLabels.map((_, i) => 
            `hsl(${i * 45}, 70%, 50%)` // Generate distinct colors for each type
        );

        if (syscallTypeChart) {
            syscallTypeChart.data.labels = distributionLabels;
            syscallTypeChart.data.datasets[0].data = distributionData;
            syscallTypeChart.data.datasets[0].backgroundColor = backgroundColors;
            syscallTypeChart.update();
        } else {
            const ctx = document.getElementById('syscall-type-chart').getContext('2d');
            syscallTypeChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: distributionLabels,
                    datasets: [{
                        data: distributionData,
                        backgroundColor: backgroundColors,
                        hoverOffset: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { 
                            position: 'bottom',
                            labels: { color: '#e2e8f0' }
                        },
                        title: { display: false }
                    }
                }
            });
        }

    } catch (e) {
        console.error("Failed to fetch or render dashboard stats:", e);
        // Fallback for KPIs if API fails
        document.getElementById("kpi-total-users").textContent = "ERR";
        document.getElementById("kpi-total-syscalls").textContent = "ERR";
        document.getElementById("kpi-total-allowed").textContent = "ERR";
        document.getElementById("kpi-total-blocked").textContent = "ERR";
    }
}


// ==========================================
// 4. CORE FUNCTIONS (MATCHING HTML ONCLICK)
// ==========================================

// 1. Matches onclick="triggerSyscall('name')"
window.triggerSyscall = async function(syscallType) {
    const user = getUser();
    if (!user) return window.logout();

    // Visual Feedback in Terminal
    printToTerminal(`<span class="text-blue-400">$ ${syscallType}()</span> <span class="text-slate-500 text-xs">...processing</span>`);

    try {
        // Call Backend
        const res = await fetch(`${API_BASE}/syscall`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: user.username,
                role: user.role,
                syscall: syscallType
            })
        });

        const data = await res.json();
        const pid = Math.floor(Math.random() * 20000) + 1000;
        let msg = terminalMessages[syscallType] || `[KERNEL] Executing ${syscallType}...`;
        msg = msg.replace('$PID', pid);

        // Render Result
        if (data.status === 'blocked') {
            printToTerminal(`
                <div class="text-red-400 font-bold">[BLOCKED] Permission Denied</div>
                <div class="text-slate-500 text-xs">${data.reason}</div>
                <div class="text-red-500 text-xs mt-1">AI Risk Score: ${data.aiResult.riskScore}%</div>
            `);
        } else {
            printToTerminal(`
                <div class="text-green-400 font-bold">[SUCCESS] Allowed</div>
                <div class="text-slate-300 text-xs whitespace-pre-wrap">${msg}</div>
                <div class="text-slate-500 text-xs mt-1">AI Risk Score: ${data.aiResult.riskScore}%</div>
            `);
        }

        // Auto-refresh the log table and stats
        window.refreshLogs();
        fetchAndRenderDashboardStats(); // Refresh stats after new syscall

    } catch (err) {
        console.error(err);
        printToTerminal(`<span class="text-red-500">Error: Server unreachable</span>`);
    }
};

// 2. Matches onclick="refreshLogs()"
window.refreshLogs = async function() {
    const tbody = document.getElementById("kernel-log-body");
    if (!tbody) return;

    try {
        const res = await fetch(`${API_BASE}/logs`);
        const logs = await res.json();
        tbody.innerHTML = "";

        if (!logs.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-slate-600">No logs found.</td></tr>`;
            return;
        }

        logs.slice().reverse().forEach(entry => {
            const tr = document.createElement("tr");
            tr.className = "hover:bg-slate-700/30 transition-colors border-b border-slate-700/50";
            
            const time = new Date(entry.timestamp).toLocaleTimeString();
            const statusColor = entry.status === 'blocked' ? 'text-red-400' : 'text-green-400';
            const risk = entry.aiResult ? entry.aiResult.riskScore : 0;
            const riskColor = risk > 75 ? 'text-red-500 font-bold' : (risk > 40 ? 'text-yellow-500' : 'text-green-500');

            tr.innerHTML = `
                <td class="px-4 py-2 text-slate-500 text-xs">${time}</td>
                <td class="px-4 py-2 text-blue-300 font-bold">${entry.username}</td>
                <td class="px-4 py-2 text-slate-400 text-xs uppercase">${entry.role}</td>
                <td class="px-4 py-2 font-mono text-purple-400">${entry.syscall}()</td>
                <td class="px-4 py-2 ${statusColor} font-bold text-xs uppercase">${entry.status}</td>
                <td class="px-4 py-2 ${riskColor}">${risk}%</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error("Log error", e); }
};

// 3. Matches onclick="clearLogs()"
window.clearLogs = async function() {
    const user = getUser();
    if (!user || user.role !== 'admin') {
        alert("Access Denied: Only Admins can clear logs.");
        return;
    }

    if (!confirm("Clear all kernel audit logs?")) return;

    try {
        await fetch(`${API_BASE}/logs/clear`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: user.role })
        });
        window.refreshLogs();
        fetchAndRenderDashboardStats(); // Refresh stats after clearing logs
        printToTerminal(`<span class="text-yellow-500">[ADMIN] System logs flushed.</span>`);
    } catch (e) { alert("Error clearing logs"); }
};

// ==========================================
// 5. INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const user = getUser();
    
    // Login Page Logic
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        if(user) window.location.href = "dashboard.html"; // Already logged in
        
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector("button");
            const u = document.getElementById("username").value;
            const p = document.getElementById("password").value;
            
            btn.innerText = "Authenticating...";
            await new Promise(r => setTimeout(r, 800)); // Smooth delay

            try {
                const res = await fetch(`${API_BASE}/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: u, password: p })
                });
                const data = await res.json();
                if (data.success) {
                    saveUser(data);
                    window.location.href = "dashboard.html";
                } else {
                    alert(data.message);
                    btn.innerText = "Login";
                }
            } catch {
                alert("Server offline");
                btn.innerText = "Login";
            }
        });
        return;
    }

    // Dashboard Logic
    if (document.getElementById("terminal-output")) {
        if (!user) {
            window.location.href = "login.html";
            return;
        }
        
        // Update UI with User Info
        document.getElementById("username-span").textContent = user.username;
        document.getElementById("role-badge").textContent = user.role;
        
        // Initial Data Load
        window.refreshLogs();
        fetchAndRenderDashboardStats(); // Initial dashboard stats load
    }
});