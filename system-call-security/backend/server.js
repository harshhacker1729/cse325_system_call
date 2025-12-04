=const express = require("express");
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

// ----- Security policy for system calls -----
const syscallPolicies = {
  // File Management
  read: { roles: ["admin", "user"] },
  write: { roles: ["admin"] },
  open: { roles: ["admin", "user"] },
  close: { roles: ["admin", "user"] },
  stat: { roles: ["admin"] },
  
  // Process Control
  fork: { roles: ["admin", "user"] },
  exec: { roles: ["admin"] },
  wait: { roles: ["admin", "user"] },
  exit: { roles: ["admin", "user"] }
};

// ----- 🧠 AI Simulation Logic -----
function generateAIAnalysis(syscall, role, status) {
  // 1. Calculate Fake Risk Score (0-100)
  let baseRisk = 10;
  if (syscall === 'exec' || syscall === 'write') baseRisk += 50;
  if (syscall === 'fork') baseRisk += 30;
  if (role !== 'admin') baseRisk += 20;
  
  // Add some randomness to make it look "alive"
  const riskScore = Math.min(Math.floor(baseRisk + Math.random() * 15), 99);

  // 2. Generate "Smart" Analysis Text
  const analysisTemplates = [
    `Analyzing behavioral patterns for user role '${role}'...`,
    `Cross-referencing syscall '${syscall}' against known threat signatures...`,
    `Heuristic scan indicates a ${riskScore}% probability of anomalous intent.`,
    `Access control matrix verification: ${status.toUpperCase()}.`,
  ];

  let detailedReason = "";
  if (status === "blocked") {
    detailedReason = `CRITICAL: Unauthorized privilege escalation attempt detected. '${syscall}' requires higher clearance levels. AI recommends immediate session termination.`;
  } else if (riskScore > 60) {
    detailedReason = `WARNING: High-risk operation '${syscall}' detected. Pattern matches potential buffer overflow preparation. Monitoring memory heap closely.`;
  } else {
    detailedReason = `SAFE: Standard operation sequence detected. '${syscall}' aligns with normal user behavior profiles. No threat detected.`;
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
    reason = "Unknown or potentially dangerous system call";
  } else if (!syscallPolicies[syscall].roles.includes(role)) {
    status = "blocked";
    reason = `Role '${role}' is not permitted to execute '${syscall}'`;
  }

  // Generate AI Analysis
  const aiResult = generateAIAnalysis(syscall, role, status);

  return { status, reason, aiResult };
}

function logEvent(entry) {
  const line = JSON.stringify(entry) + "\n";
  fs.appendFile(logFile, line, err => {
    if (err) {
      console.error("Error writing log:", err);
    }
  });
}

// ----- Routes -----

// Login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(
    u => u.username === username && u.password === password
  );

  if (!user) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid username or password" });
  }

  return res.json({
    success: true,
    message: "Login successful",
    username: user.username,
    role: user.role
  });
});

// System call request
app.post("/api/syscall", (req, res) => {
  const { username, role, syscall } = req.body;

  if (!username || !role || !syscall) {
    return res
      .status(400)
      .json({ success: false, message: "username, role and syscall required" });
  }

  const { status, reason, aiResult } = evaluateSyscall({ username, role, syscall });

  const logEntry = {
    timestamp: new Date().toISOString(),
    username,
    role,
    syscall,
    status,
    reason,
    aiResult // Log the AI data too
  };

  logEvent(logEntry);

  return res.json({
    success: true,
    ...logEntry
  });
});

// Get logs
app.get("/api/logs", (req, res) => {
  if (!fs.existsSync(logFile)) {
    return res.json([]);
  }

  const content = fs.readFileSync(logFile, "utf8").trim();
  if (!content) {
    return res.json([]);
  }

  const lines = content.split("\n").filter(Boolean);
  const entries = lines
    .map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);

  return res.json(entries);
});

// Clear logs
app.post("/api/logs/clear", (req, res) => {
  try {
    fs.writeFileSync(logFile, ""); 
    res.json({ success: true, message: "Logs cleared successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to clear logs." });
  }
});

// ----- Start server -----
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});