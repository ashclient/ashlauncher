// main.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const fsp = fs.promises;
const { spawn } = require("child_process");
const http = require("http");
const https = require("https");
const { URL } = require("url");
const { PublicClientApplication } = require("@azure/msal-node");
const extract = require("extract-zip");
const settingsStore = require("./settings");

// ============================================================
// MSAL + Minecraft config
// ============================================================
const MS_CLIENT_ID = "0c76d921-5349-4799-92ea-9d9cf1808a4e";
const MS_REDIRECT_URI = "http://localhost:19191/auth/callback";
const MS_SCOPES = ["XboxLive.signin", "offline_access"];

// Where to store MSAL token cache (so you don't relogin every time)
const MSAL_CACHE_PATH = path.join(
  os.homedir(),
  "AppData",
  "Roaming",
  "ashclient",
  "msal_cache.json"
);

const msalConfig = {
  auth: {
    clientId: MS_CLIENT_ID,
    authority: "https://login.microsoftonline.com/consumers"
  },
  system: {
    loggerOptions: {
      loggerCallback(level, message) {
        console.log(message);
      },
      piiLoggingEnabled: false,
      logLevel: 2
    }
  },
  cache: {
    cachePlugin: {
      // Load token cache from disk
      beforeCacheAccess: async (ctx) => {
        try {
          const data = await fsp
            .readFile(MSAL_CACHE_PATH, "utf8")
            .catch(() => "");
          if (data) {
            ctx.tokenCache.deserialize(data);
          }
        } catch (e) {
          console.error("[MSAL] Failed to read cache:", e);
        }
      },
      // Save token cache to disk if changed
      afterCacheAccess: async (ctx) => {
        if (ctx.cacheHasChanged) {
          try {
            await fsp.mkdir(path.dirname(MSAL_CACHE_PATH), { recursive: true });
            await fsp.writeFile(MSAL_CACHE_PATH, ctx.tokenCache.serialize(), "utf8");
          } catch (e) {
            console.error("[MSAL] Failed to write cache:", e);
          }
        }
      }
    }
  }
};

const pca = new PublicClientApplication(msalConfig);

// ============================================================
// CDN and Library Configuration
// ============================================================
const ASH_CDN_BASE_URL = "https://raw.githubusercontent.com/ashclient/AshClient-CDN/main/";
const LIBRARIES_BASE_URL = "https://libraries.minecraft.net/";

const LIBRARY_PATHS = [
  "com/mojang/netty/1.8.8/netty-1.8.8.jar",
  "oshi-project/oshi-core/1.1/oshi-core-1.1.jar",
  "net/java/dev/jna/jna/3.4.0/jna-3.4.0.jar",
  "net/java/dev/jna/platform/3.4.0/platform-3.4.0.jar",
  "com/ibm/icu/icu4j-core-mojang/51.2/icu4j-core-mojang-51.2.jar",
  "net/sf/jopt-simple/jopt-simple/4.6/jopt-simple-4.6.jar",
  "com/paulscode/codecjorbis/20101023/codecjorbis-20101023.jar",
  "com/paulscode/codecwav/20101023/codecwav-20101023.jar",
  "com/paulscode/libraryjavasound/20101123/libraryjavasound-20101123.jar",
  "com/paulscode/librarylwjglopenal/20100824/librarylwjglopenal-20100824.jar",
  "com/paulscode/soundsystem/20120107/soundsystem-20120107.jar",
  "io/netty/netty-all/4.0.23.Final/netty-all-4.0.23.Final.jar",
  "com/google/guava/guava/17.0/guava-17.0.jar",
  "org/apache/commons/commons-lang3/3.3.2/commons-lang3-3.3.2.jar",
  "commons-io/commons-io/2.4/commons-io-2.4.jar",
  "commons-codec/commons-codec/1.9/commons-codec-1.9.jar",
  "net/java/jinput/jinput/2.0.5/jinput-2.0.5.jar",
  "net/java/jutils/jutils/1.0.0/jutils-1.0.0.jar",
  "com/google/code/gson/gson/2.2.4/gson-2.2.4.jar",
  "com/mojang/authlib/1.5.21/authlib-1.5.21.jar",
  "com/mojang/realms/1.7.59/realms-1.7.59.jar",
  "org/apache/commons/commons-compress/1.8.1/commons-compress-1.8.1.jar",
  "org/apache/httpcomponents/httpclient/4.3.3/httpclient-4.3.3.jar",
  "commons-logging/commons-logging/1.1.3/commons-logging-1.1.3.jar",
  "org/apache/httpcomponents/httpcore/4.3.2/httpcore-4.3.2.jar",
  "org/apache/logging/log4j/log4j-api/2.0-beta9/log4j-api-2.0-beta9.jar",
  "org/apache/logging/log4j/log4j-core/2.0-beta9/log4j-core-2.0-beta9.jar",
  "org/lwjgl/lwjgl/lwjgl/2.9.4-nightly-20150209/lwjgl-2.9.4-nightly-20150209.jar",
  "org/lwjgl/lwjgl/lwjgl_util/2.9.4-nightly-20150209/lwjgl_util-2.9.4-nightly-20150209.jar",
  "org/lwjgl/lwjgl/lwjgl-platform/2.9.4-nightly-20150209/lwjgl-platform-2.9.4-nightly-20150209.jar",
  "org/lwjgl/lwjgl/lwjgl/2.9.2-nightly-20140822/lwjgl-2.9.2-nightly-20140822.jar",
  "org/lwjgl/lwjgl/lwjgl_util/2.9.2-nightly-20140822/lwjgl_util-2.9.2-nightly-20140822.jar",
  "tv/twitch/twitch/6.5/twitch-6.5.jar"
];

const NATIVE_JARS = [
  "org/lwjgl/lwjgl/lwjgl-platform/2.9.4-nightly-20150209/lwjgl-platform-2.9.4-nightly-20150209-natives-windows.jar",
  "org/lwjgl/lwjgl/lwjgl-platform/2.9.2-nightly-20140822/lwjgl-platform-2.9.2-nightly-20140822-natives-windows.jar",
  "net/java/jinput/jinput-platform/2.0.5/jinput-platform-2.0.5-natives-windows.jar",
  "tv/twitch/twitch-platform/6.5/twitch-platform-6.5-natives-windows-64.jar",
  "tv/twitch/twitch-external-platform/4.5/twitch-external-platform-4.5-natives-windows-64.jar"
];

// ============================================================
// AshClient custom resources
// ============================================================
const CUSTOM_CLIENTINPUT_REL = "resources/ClientInput.dll";
const CUSTOM_DISCORD_JAR_REL = "resources/java-discord-rpc-2.0.1-all.jar";

const CLIENTINPUT_URL = ASH_CDN_BASE_URL + CUSTOM_CLIENTINPUT_REL;
const DISCORD_RPC_JAR_URL = ASH_CDN_BASE_URL + CUSTOM_DISCORD_JAR_REL;

const ASHCLIENT_STORAGE = path.join(os.homedir(), "AppData", "Roaming", "ashclient");
const DISCORD_RPC_LOCAL_JAR = path.join(ASHCLIENT_STORAGE, "java-discord-rpc-2.0.1-all.jar");

// ============================================================
// Helper functions
// ============================================================
function cleanRel(p) {
  return p.replace(/\\/g, "/").replace(/(\.\.[/\\])+/g, "").replace(/^\/+/, "");
}

function httpsRequestJson(urlString, options, bodyObj) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const reqOptions = {
      method: options.method || "GET",
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: options.headers || {}
    };

    const req = https.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const err = new Error(`HTTP ${res.statusCode}: ${data}`);
          err.statusCode = res.statusCode;
          return reject(err);
        }
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    if (bodyObj) req.write(JSON.stringify(bodyObj));
    req.end();
  });
}

async function downloadFile(url, dest, id = "unknown") {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          file.close(() => fs.unlink(dest, () => { }));
          return reject(new Error(`Failed to download ${url}: HTTP ${res.statusCode}`));
        }

        const total = parseInt(res.headers["content-length"] || "0", 10);
        let downloaded = 0;

        res.on("data", (chunk) => {
          downloaded += chunk.length;

          // Send progress to renderer for the progress bar
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("ash:downloadProgress", {
              id,
              downloaded,
              total,
              percent: total
                ? Math.floor((downloaded / total) * 100)
                : 0
            });
          }
        });

        res.pipe(file);
        file.on("finish", () => {
          file.close(() => {
            // Ensure final 100% is sent
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send("ash:downloadProgress", {
                id,
                downloaded: total || downloaded,
                total: total || downloaded,
                percent: 100
              });
            }
            resolve();
          });
        });
      })
      .on("error", (err) => {
        file.close(() => fs.unlink(dest, () => { }));
        reject(err);
      });
  });
}


async function downloadWithFallback(relPath, dest) {
  const safe = cleanRel(relPath);
  const mojang = LIBRARIES_BASE_URL + safe;
  const cdn = ASH_CDN_BASE_URL + safe;

  const id = `lib:${safe}`;

  try {
    await downloadFile(mojang, dest, id);
    return;
  } catch (_) { }

  await downloadFile(cdn, dest, id);
}
async function fileExists(p) {
  try {
    await fsp.access(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// AshClient version auto-download
// ============================================================
async function ensureAshClientVersion(mcDir) {
  const versionRoot = path.join(mcDir, "versions", "ashclient-1.8.9");
  const jarPath = path.join(versionRoot, "ashclient-1.8.9.jar");
  const jsonPath = path.join(versionRoot, "ashclient-1.8.9.json");

  const JAR_URL = ASH_CDN_BASE_URL + "releases/ashclient-1.8.9.jar";
  const JSON_URL = ASH_CDN_BASE_URL + "releases/ashclient-1.8.9.json";

  await fsp.mkdir(versionRoot, { recursive: true });

  // Check jar
  let needJar = !(await fileExists(jarPath));
  if (!needJar) {
    const size = fs.statSync(jarPath).size;
    if (size < 10000) needJar = true;
  }

  if (needJar) {
    console.log("[AshClient] Downloading ashclient-1.8.9.jar");
    await downloadFile(JAR_URL, jarPath, "ashclient-jar");
  }

  // Check JSON
  let needJson = !(await fileExists(jsonPath));
  if (!needJson) {
    const size = fs.statSync(jsonPath).size;
    if (size < 10) needJson = true;
  }

  if (needJson) {
    console.log("[AshClient] Downloading ashclient-1.8.9.json");
    await downloadFile(JSON_URL, jsonPath, "ashclient-json");
  }

  return { jarPath, jsonPath };
}

// ============================================================
// Library and native extraction
// ============================================================
async function ensureLibraries(librariesDir) {
  await fsp.mkdir(librariesDir, { recursive: true });

  for (const rel of LIBRARY_PATHS) {
    const safe = cleanRel(rel);
    const full = path.join(librariesDir, safe);

    if (await fileExists(full)) continue;

    await fsp.mkdir(path.dirname(full), { recursive: true });
    try {
      await downloadWithFallback(safe, full);
    } catch (err) {
      console.error("[Library] Failed:", safe, err);
    }
  }
}

async function extractNatives(librariesDir, nativesDir) {
  await fsp.mkdir(nativesDir, { recursive: true });

  for (const rel of NATIVE_JARS) {
    const safe = cleanRel(rel);
    const jarPath = path.join(librariesDir, safe);

    if (!(await fileExists(jarPath))) {
      await fsp.mkdir(path.dirname(jarPath), { recursive: true });
      await downloadWithFallback(safe, jarPath);
    }

    try {
      await extract(jarPath, { dir: nativesDir });
    } catch (err) {
      console.error("[Natives] Failed extracting:", jarPath, err);
    }
  }
}

// ============================================================
// Microsoft / Minecraft authentication chain
// ============================================================
async function loginMinecraftWithMsAccessToken(msAccessToken) {
  const xblResp = await httpsRequestJson(
    "https://user.auth.xboxlive.com/user/authenticate",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-xbl-contract-version": "1"
      }
    },
    {
      Properties: {
        AuthMethod: "RPS",
        SiteName: "user.auth.xboxlive.com",
        RpsTicket: "d=" + msAccessToken
      },
      RelyingParty: "http://auth.xboxlive.com",
      TokenType: "JWT"
    }
  );

  const xbl = xblResp.Token;
  const uhs = xblResp.DisplayClaims.xui[0].uhs;

  const xstsResp = await httpsRequestJson(
    "https://xsts.auth.xboxlive.com/xsts/authorize",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-xbl-contract-version": "1"
      }
    },
    {
      Properties: {
        SandboxId: "RETAIL",
        UserTokens: [xbl]
      },
      RelyingParty: "rp://api.minecraftservices.com/",
      TokenType: "JWT"
    }
  );

  const xsts = xstsResp.Token;
  const identity = `XBL3.0 x=${uhs};${xsts}`;

  const login = await httpsRequestJson(
    "https://api.minecraftservices.com/authentication/login_with_xbox",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    },
    { identityToken: identity }
  );

  const mcAccessToken = login.access_token;

  let profile = null;
  try {
    profile = await httpsRequestJson("https://api.minecraftservices.com/minecraft/profile", {
      method: "GET",
      headers: { Authorization: `Bearer ${mcAccessToken}` }
    });
  } catch {}

  return { mcAccessToken, mcProfile: profile };
}

// Try to silently sign in on startup using cached MSAL tokens
async function trySilentMicrosoftLoginAndMinecraft() {
  try {
    const accounts = await pca.getTokenCache().getAllAccounts();
    if (!accounts || accounts.length === 0) return null;

    const account = accounts[0];
    const tokenResponse = await pca.acquireTokenSilent({
      account,
      scopes: MS_SCOPES
    });

    const msName = account.name || account.username;

    let mc = null;
    try {
      mc = await loginMinecraftWithMsAccessToken(tokenResponse.accessToken);
    } catch (err) {
      console.error("[MC] Silent MC auth failed:", err);
      return null;
    }

    const finalName = mc?.mcProfile?.name || msName;

    msAccount = {
      username: finalName,
      microsoftName: msName,
      minecraftName: mc?.mcProfile?.name || null,
      minecraftUuid: mc?.mcProfile?.id || null,
      minecraftAccessToken: mc?.mcAccessToken || null
    };

    console.log("[Auth] Silent login succeeded as", msAccount.username);
    return msAccount;
  } catch (err) {
    console.error("[Auth] Silent Microsoft login failed:", err);
    return null;
  }
}

// ============================================================
// Window creation
// ============================================================
let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 650,
    minWidth: 900,
    minHeight: 550,
    backgroundColor: "#050510",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile("index.html");
}

// ============================================================
// Microsoft login handler
// ============================================================
let msAccount = null;

function performInteractiveMicrosoftLogin() {
  return new Promise(async (resolve, reject) => {
    let server;
    let authWindow;
    let finished = false;

    function cleanup() {
      if (finished) return;
      finished = true;

      try {
        server.close();
      } catch (_) {}
      server = null;

      if (authWindow && !authWindow.isDestroyed()) authWindow.close();
      authWindow = null;
    }

    try {
      server = http.createServer(async (req, res) => {
        try {
          const reqUrl = new URL(req.url, MS_REDIRECT_URI);
          if (reqUrl.pathname !== "/auth/callback") {
            res.writeHead(404);
            res.end("Not found");
            return;
          }

          const code = reqUrl.searchParams.get("code");
          if (!code) {
            res.writeHead(400);
            res.end("Missing code");
            cleanup();
            return reject(new Error("Missing authorization code"));
          }

          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("Login successful. This window will close shortly.");

          const tokenResponse = await pca.acquireTokenByCode({
            code,
            scopes: MS_SCOPES,
            redirectUri: MS_REDIRECT_URI
          });

          const account = tokenResponse.account;
          const msName = account.name || account.username;

          let mc = null;
          try {
            mc = await loginMinecraftWithMsAccessToken(tokenResponse.accessToken);
          } catch (err) {
            console.error("[MC] Auth chain failed:", err);
          }

          const finalName = mc?.mcProfile?.name || msName;

          msAccount = {
            username: finalName,
            microsoftName: msName,
            minecraftName: mc?.mcProfile?.name || null,
            minecraftUuid: mc?.mcProfile?.id || null,
            minecraftAccessToken: mc?.mcAccessToken || null
          };

          cleanup();
          resolve(msAccount);
        } catch (err) {
          cleanup();
          reject(err);
        }
      });

      server.listen(19191, "127.0.0.1");

      const authUrl = await pca.getAuthCodeUrl({
        scopes: MS_SCOPES,
        redirectUri: MS_REDIRECT_URI
      });

      authWindow = new BrowserWindow({
        width: 500,
        height: 650,
        title: "Sign in with Microsoft",
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      authWindow.loadURL(authUrl);
    } catch (err) {
      reject(err);
    }
  });
}

// ============================================================
// IPC handlers
// ============================================================
ipcMain.handle("ash:getSettings", async () => settingsStore.loadSettings());
ipcMain.handle("ash:saveSettings", async (_e, s) => (settingsStore.saveSettings(s), true));
ipcMain.handle("ash:getAccount", async () => msAccount);

ipcMain.handle("ash:signInMicrosoft", async () => {
  try {
    if (msAccount) return { ok: true, account: msAccount };
    const acc = await performInteractiveMicrosoftLogin();
    return { ok: true, account: acc };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ============================================================
// Minecraft launcher
// ============================================================
ipcMain.handle("ash:launchMinecraft", async (_event, options) => {
  const settings = settingsStore.loadSettings();

  // Refresh / validate tokens silently before launch if possible
  try {
    const accounts = await pca.getTokenCache().getAllAccounts();
    if (accounts && accounts.length > 0) {
      const account = accounts[0];
      const tokenResponse = await pca.acquireTokenSilent({
        account,
        scopes: MS_SCOPES
      });

      const msName = account.name || account.username;
      let mc = null;
      try {
        mc = await loginMinecraftWithMsAccessToken(tokenResponse.accessToken);
      } catch (err) {
        console.error("[MC] Auth chain failed before launch:", err);
      }

      if (mc?.mcAccessToken && mc?.mcProfile?.id) {
        const finalName = mc?.mcProfile?.name || msName;
        msAccount = {
          username: finalName,
          microsoftName: msName,
          minecraftName: mc?.mcProfile?.name || null,
          minecraftUuid: mc?.mcProfile?.id || null,
          minecraftAccessToken: mc?.mcAccessToken || null
        };
      }
    }
  } catch (err) {
    console.error("[Auth] Silent refresh before launch failed:", err);
  }

  if (!msAccount?.minecraftAccessToken || !msAccount?.minecraftUuid) {
    throw new Error("You must sign in with Microsoft before launching.");
  }

  const javaPath = options.javaPath || settings.javaPath || "javaw.exe";
  const ramMB = options.ramMB || settings.ramMB || 4096;

  const mcDir = process.env.APPDATA
    ? path.join(process.env.APPDATA, ".minecraft")
    : path.join(os.homedir(), ".minecraft");

  const librariesDir = path.join(mcDir, "libraries");
  const CUSTOM_ID = "ashclient-1.8.9";
  const vanillaJar = path.join(mcDir, "versions", "1.8.9", "1.8.9.jar");

  // 1. Ensure AshClient version files
  const { jarPath: ashJar } = await ensureAshClientVersion(mcDir);

  // 2. Ensure all libraries
  await ensureLibraries(librariesDir);

  // 3. Extract natives
  const nativesDir = path.join(mcDir, "natives", CUSTOM_ID);
  await extractNatives(librariesDir, nativesDir);

  // 4. Download ClientInput.dll
  const clientInputDll = path.join(nativesDir, "ClientInput.dll");
  if (!(await fileExists(clientInputDll))) {
    console.log("[Launcher] Downloading ClientInput.dll...");
    await downloadFile(CLIENTINPUT_URL, clientInputDll, "clientinput-dll");
  }

  // 5. Download Discord RPC jar
  await fsp.mkdir(ASHCLIENT_STORAGE, { recursive: true });
  if (!(await fileExists(DISCORD_RPC_LOCAL_JAR))) {
    console.log("[Launcher] Downloading Discord RPC jar...");
    await downloadFile(DISCORD_RPC_JAR_URL, DISCORD_RPC_LOCAL_JAR, "discord-rpc");
  }

  // Build classpath
  const classpathEntries = [
    ashJar,
    vanillaJar,
    DISCORD_RPC_LOCAL_JAR,
    ...LIBRARY_PATHS.map((rel) => path.join(librariesDir, cleanRel(rel)))
  ];

  const classpath = classpathEntries.join(path.delimiter);
  const assetsDir = path.join(mcDir, "assets");

  const jvmArgs = [
    `-Xmx${ramMB}m`,
    `-Djava.library.path=${nativesDir}`,
    `-Dorg.lwjgl.librarypath=${nativesDir}`,
    "-cp",
    classpath
  ];

  const mcArgs = [
    "net.minecraft.client.main.Main",
    "--version", CUSTOM_ID,
    "--gameDir", mcDir,
    "--assetsDir", assetsDir,
    "--assetIndex", "1.8",
    "--userType", "msa",
    "--versionType", "release",
    "--username", msAccount.username,
    "--uuid", msAccount.minecraftUuid,
    "--accessToken", msAccount.minecraftAccessToken
  ];

  const allArgs = [...jvmArgs, ...mcArgs];

  console.log("[Launcher] Launching AshClient with:", javaPath, allArgs.join(" "));

  // Notify renderer: game launching
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("ash:playState", "launching");
  }

  const child = spawn(javaPath, allArgs, {
    detached: false,
    stdio: ["ignore", "pipe", "pipe"]
  });

  // When JVM actually outputs anything, we consider it "running"
  let hasStarted = false;

  child.stdout.on("data", (d) => {
    if (!hasStarted) {
      hasStarted = true;

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("ash:playState", "running");
      }
    }
    console.log("[MC]", d.toString());
  });

  child.stderr.on("data", (d) => {
    console.error("[MC-ERR]", d.toString());
  });

// When MC closes
child.on("close", (code) => {
  console.log("[MC] exited with code", code);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("ash:playState", "idle");
  }
});


  child.stdout.on("data", (d) => console.log("[MC]", d.toString()));
  child.stderr.on("data", (d) => console.error("[MC-ERR]", d.toString()));

  child.on("close", (code) => {
    console.log("[MC] exited with code", code);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("ash:playState", "idle");
    }
  });

  return true;
});

// ============================================================
// App lifecycle
// ============================================================
app.whenReady().then(async () => {
  // Try silent login on startup so user doesn't have to re-login
  await trySilentMicrosoftLoginAndMinecraft();

  createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
