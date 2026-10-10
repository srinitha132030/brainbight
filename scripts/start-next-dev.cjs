const net = require("node:net");
const { spawn } = require("node:child_process");
const path = require("node:path");

const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("Usage: node start-next-dev.cjs <port>");
  process.exit(1);
}

const probe = net.createConnection({ host: "127.0.0.1", port });
probe.setTimeout(1000);
probe.once("connect", () => {
  probe.destroy();
  console.log(`A server is already using port ${port}. Open http://localhost:${port} instead of starting another one.`);
});
probe.once("timeout", () => {
  probe.destroy();
  console.error(`Could not determine whether port ${port} is available.`);
  process.exitCode = 1;
});
probe.once("error", (error) => {
  if (error.code !== "ECONNREFUSED") {
    console.error(`Could not check port ${port}: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  let nextBin;
  try {
    nextBin = require.resolve("next/dist/bin/next", { paths: [process.cwd()] });
  } catch (resolveError) {
    console.error(`Could not find Next.js from ${process.cwd()}: ${resolveError.message}`);
    process.exitCode = 1;
    return;
  }

  const child = spawn(process.execPath, [nextBin, "dev", "-p", String(port)], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  child.once("error", (spawnError) => {
    console.error(`Could not start Next.js: ${spawnError.message}`);
    process.exitCode = 1;
  });
  child.once("exit", (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
});
