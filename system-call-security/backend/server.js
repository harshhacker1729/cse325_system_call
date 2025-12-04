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

  return { status, reason };
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

  const { status, reason } = evaluateSyscall({ username, role, syscall });

  const logEntry = {
    timestamp: new Date().toISOString(),
    username,
    role,
    syscall,
    status,
    reason
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

// NEW: Clear logs
app.post("/api/logs/clear", (req, res) => {
  try {
    fs.writeFileSync(logFile, "POST /api/logs/clear"); // Wipe file content
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