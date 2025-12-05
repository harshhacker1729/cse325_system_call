const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 5001;

// ----- Middlewares -----
app.use(cors());
app.use(express.json());

// ----- Ensure logs directory -----
const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}
const logFile = path.join(logsDir, "syscalls.log");

// ----- Fake users (for demo) -----
const users = require("./users.json");

// ----- 1. UPDATED: Security policy for system calls -----
const syscallPolicies = {
  // File I/O
  read: { roles: ["admin", "user"] },
  write: { roles: ["admin"] },
  open: { roles: ["admin", "user"] },
  close: { roles: ["admin", "user"] },
  
  // New Directory Operations
  mkdir: { roles: ["admin", "user"] }, // Users can create folders
  rmdir: { roles: ["admin"] },         // Only Admins can delete folders
  
  // New Admin Privileges
  chown: { roles: ["admin"] },         // Change Ownership (Admin only)

  // Process Control
  fork: { roles: ["admin", "user"] },
  exec: { roles: ["admin"] },
  wait: { roles: ["admin", "user"] },
  exit: { roles: ["admin", "user"] }
};

// ----- 🧠 AI Simulation Logic -----
function generateAIAnalysis(syscall, role, status) {
  let baseRisk = 10;
  
  // Risk logic for new calls
  if (syscall === 'chown') baseRisk += 80; // Very high risk
  if (syscall === 'rmdir') baseRisk += 60; // High risk
  if (syscall === 'write' || syscall === 'exec') baseRisk += 50;
  
  if (role !== 'admin') baseRisk += 20;
  
  const riskScore = Math.min(Math.floor(baseRisk + Math.random() * 15), 99);

  const analysisTemplates = [
    `Analyzing behavioral patterns for user role '${role}'...`,
    `Cross-referencing syscall '${syscall}' against known threat signatures...`,
    `Heuristic scan indicates a ${riskScore}% probability of anomalous intent.`,
    `Access control matrix verification: ${status.toUpperCase()}.`,
  ];

  let detailedReason = "";
  if (status === "blocked") {
    detailedReason = `CRITICAL: Unauthorized privilege escalation attempt. '${syscall}' requires Admin clearance. AI blocked execution.`;
  } else if (riskScore > 75) {
    detailedReason = `WARNING: Critical system modification '${syscall}' detected. AI is logging this event for forensic audit.`;
  } else {
    detailedReason = `SAFE: Operation '${syscall}' is within normal behavioral parameters.`;
  }

  return {
    riskScore,
    analysis: analysisTemplates[Math.floor(Math.random() * analysisTemplates.length)],
    details: detailedReason
  };
}

function evaluateSyscall({ username, role, syscall }) {
  let status = "allowed";
  let reason = "Allowed by policy";

  if (!syscallPolicies[syscall]) {
    status = "blocked";
    reason = "Unknown system call";
  } else if (!syscallPolicies[syscall].roles.includes(role)) {
    status = "blocked";
    reason = `Role '${role}' denied access to '${syscall}'`;
  }

  const aiResult = generateAIAnalysis(syscall, role, status);

  return { status, reason, aiResult };
}

function logEvent(entry) {
  const line = JSON.stringify(entry) + "\n";
  fs.appendFile(logFile, line, err => { if (err) console.error(err); });
}

// ----- Routes -----

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });
  return res.json({ success: true, username: user.username, role: user.role });
});

app.post("/api/syscall", (req, res) => {
  const { username, role, syscall } = req.body;
  if (!username || !role || !syscall) return res.status(400).json({ success: false });

  const { status, reason, aiResult } = evaluateSyscall({ username, role, syscall });
  const logEntry = { timestamp: new Date().toISOString(), username, role, syscall, status, reason, aiResult };
  
  logEvent(logEntry);
  return res.json({ success: true, ...logEntry });
});

app.get("/api/logs", (req, res) => {
  if (!fs.existsSync(logFile)) return res.json([]);
  const content = fs.readFileSync(logFile, "utf8").trim();
  if (!content) return res.json([]);
  const lines = content.split("\n").filter(Boolean);
  const entries = lines.map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
  return res.json(entries);
});

// ----- 2. UPDATED: Restricted Clear Route -----
app.post("/api/logs/clear", (req, res) => {
  const { role } = req.body; // Expect role in body
  
  if (role !== 'admin') {
    return res.status(403).json({ success: false, message: "Access Denied: Only Admins can clear logs." });
  }

  try {
    fs.writeFileSync(logFile, ""); 
    res.json({ success: true, message: "Logs cleared successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to clear logs." });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});