// launcher.js
const { spawn } = require("child_process");
const path = require("path");
const os = require("os");

function getMinecraftDir() {
  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
      ".minecraft"
    );
  }
  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "minecraft"
    );
  }
  return path.join(os.homedir(), ".minecraft");
}

/**
 * opts:
 * - javaPath
 * - clientJar
 * - ramMB
 * - closeOnLaunch
 */
function launchMinecraft(opts) {
  const javaPath = opts.javaPath || "javaw.exe";
  const clientJar = opts.clientJar;
  const ram = opts.ramMB || 4096;

  if (!clientJar) {
    console.error("No clientJar configured.");
    return;
  }

  const args = [
    `-Xmx${ram}m`,
    "-jar",
    clientJar,
    "--gameDir",
    getMinecraftDir()
  ];

  console.log("Launching:", javaPath, args.join(" "));

  const child = spawn(javaPath, args, {
    detached: true,
    stdio: "ignore"
  });

  child.unref();
}

module.exports = {
  launchMinecraft
};
