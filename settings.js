// settings.js
const fs = require("fs");
const path = require("path");
const os = require("os");

function getBaseDir() {
  const appData =
    process.env.APPDATA ||
    (process.platform === "darwin"
      ? path.join(os.homedir(), "Library", "Application Support")
      : path.join(os.homedir(), ".config"));

  return path.join(appData, "ashlauncher"); // renamed to avoid conflicts
}

function getSettingsPath() {
  return path.join(getBaseDir(), "launcher-settings.json");
}

function ensureDirExists() {
  const dir = getBaseDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function defaultSettings() {
  ensureDirExists();
  const baseDir = getBaseDir();
  return {
    ramMB: 4096,
    javaPath: "javaw.exe",
    clientJar: path.join(
      process.env.APPDATA,
      ".minecraft",
      "versions",
      "ashclient-1.8.9",
      "ashclient-1.8.9.jar"
    ),
    closeOnLaunch: false
  };
}

function loadSettings() {
  try {
    ensureDirExists();
    const file = getSettingsPath();

    if (!fs.existsSync(file)) {
      const def = defaultSettings();
      fs.writeFileSync(file, JSON.stringify(def, null, 2), "utf8");
      return def;
    }

    const raw = fs.readFileSync(file, "utf8");
    const data = JSON.parse(raw);

    return Object.assign(defaultSettings(), data);
  } catch (e) {
    console.error("[Settings] Failed to load settings:", e);
    return defaultSettings();
  }
}

function saveSettings(settings) {
  try {
    ensureDirExists();
    const file = getSettingsPath();
    fs.writeFileSync(file, JSON.stringify(settings, null, 2), "utf8");
  } catch (e) {
    console.error("[Settings] Failed to save settings:", e);
  }
}

module.exports = {
  loadSettings,
  saveSettings,
  getSettingsPath,
  getBaseDir
};
