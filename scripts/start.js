// scripts/start.js
// Cross-platform local runner for Crown & Cross (Admin + Storefront)
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

const rootDir = path.resolve(__dirname, "..");
const adminDir = path.join(rootDir, "admin");
const publicDir = path.join(rootDir, "CC-Hosting-Public");

console.log("=====================================================");
console.log("  Crown & Cross — Local Development Runner");
console.log("=====================================================");
console.log("  Admin Portal:      http://localhost:3000");
console.log("  Public Storefront: http://localhost:3001");
console.log("=====================================================\n");

function openBrowser(url) {
  const plat = process.platform;
  try {
    if (plat === "win32") {
      spawn("cmd", ["/c", "start", "", url], { stdio: "ignore" });
    } else if (plat === "darwin") {
      spawn("open", [url], { stdio: "ignore" });
    } else {
      spawn("xdg-open", [url], { stdio: "ignore" });
    }
  } catch (err) {
    console.error(`Could not automatically open browser for ${url}:`, err.message);
  }
}

const activePollers = [];

function waitForUrlAndOpen(url, label, delayMs = 0) {
  let opened = false;
  const pollInterval = setInterval(() => {
    if (opened) {
      clearInterval(pollInterval);
      return;
    }

    const req = http.get(url, (res) => {
      if (!opened) {
        opened = true;
        clearInterval(pollInterval);
        setTimeout(() => {
          console.log(`\n>>> [${label}] is ready! Opening in your browser: ${url}\n`);
          openBrowser(url);
        }, delayMs);
      }
      res.resume();
    });

    req.on("error", () => {
      // Server still booting up, continue polling
    });

    req.setTimeout(1000, () => {
      req.destroy();
    });
  }, 600);

  activePollers.push(pollInterval);
}

function run(name, command, cwd) {
  // Use pipe and CI mode so Next.js doesn't interleave interactive spinners or raw escape codes in Windows cmd
  const child = spawn(command, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    env: {
      ...process.env,
      FORCE_COLOR: "0",
      CI: "1"
    }
  });

  const handleStreamData = (data) => {
    const text = data.toString();
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      // Strip ANSI escape codes, cursor control codes, and unprintable characters
      const cleanLine = line
        .replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, "")
        .replace(/\[\?[0-9]+[a-zA-Z]/g, "")
        .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, "")
        .trim();
      if (cleanLine) {
        console.log(`[${name}] ${cleanLine}`);
      }
    }
  };

  child.stdout.on("data", handleStreamData);
  child.stderr.on("data", handleStreamData);

  child.on("error", (err) => {
    console.error(`[${name}] Failed to start:`, err.message);
  });

  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.log(`[${name}] exited with code ${code}`);
    }
  });

  return child;
}

function runBuild(name, cwd) {
  return new Promise((resolve, reject) => {
    console.log(`>>> [Pre-Flight Build] Compiling ${name}...`);
    const child = spawn("npm run build", {
      cwd,
      stdio: "inherit",
      shell: true,
      env: process.env
    });
    child.on("close", (code) => {
      if (code === 0) {
        console.log(`✓ [Pre-Flight Build] ${name} compiled successfully.\n`);
        resolve();
      } else {
        console.error(`✕ [Pre-Flight Build] ${name} build failed with exit code ${code}.\n`);
        reject(new Error(`${name} build failed`));
      }
    });
    child.on("error", (err) => {
      reject(err);
    });
  });
}

let adminProcess = null;
let publicProcess = null;

async function start() {
  try {
    console.log("-----------------------------------------------------");
    console.log("  Running pre-launch production builds...");
    console.log("-----------------------------------------------------\n");
    await runBuild("Admin Portal", adminDir);
    await runBuild("Public Storefront", publicDir);
    console.log("✓ All builds completed successfully! Launching dev servers...\n");
  } catch (err) {
    console.error("Aborting launch due to build failure. Please fix build errors above.");
    process.exit(1);
  }

  // Start Admin on port 3000
  adminProcess = run("Admin", "npm run dev", adminDir);

  // Start Public Storefront on port 3001
  publicProcess = run("Store", "npm run dev", publicDir);

  // Automatically open in browser once each service responds
  waitForUrlAndOpen("http://localhost:3000", "Admin Portal", 0);
  waitForUrlAndOpen("http://localhost:3001", "Public Storefront", 800);
}

start();

const shutdown = () => {
  console.log("\nShutting down Crown & Cross servers...");
  activePollers.forEach((p) => clearInterval(p));
  try {
    if (process.platform === "win32") {
      if (adminProcess && adminProcess.pid) {
        spawn("taskkill", ["/pid", adminProcess.pid, "/T", "/F"], { stdio: "ignore" });
      }
      if (publicProcess && publicProcess.pid) {
        spawn("taskkill", ["/pid", publicProcess.pid, "/T", "/F"], { stdio: "ignore" });
      }
    } else {
      try {
        if (adminProcess && adminProcess.pid) process.kill(-adminProcess.pid, "SIGTERM");
      } catch (_) {
        if (adminProcess && adminProcess.kill) adminProcess.kill("SIGTERM");
      }
      try {
        if (publicProcess && publicProcess.pid) process.kill(-publicProcess.pid, "SIGTERM");
      } catch (_) {
        if (publicProcess && publicProcess.kill) publicProcess.kill("SIGTERM");
      }
    }
  } catch (_) { }
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);