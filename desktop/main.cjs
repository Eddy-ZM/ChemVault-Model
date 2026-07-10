const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { TextDecoder } = require('node:util');
const gaussianParsers = require('./gaussian-parsers.cjs');

const APP_TITLE = 'ChemVault Model';
const DEFAULT_API_BASE = 'https://model.chemvault.science/api/chem';
const DEFAULT_USER_ORIGIN = 'https://user.chemvault.science';
const DEFAULT_START_PATH = '/';
const DEFAULT_VERSION_MANIFEST_URL = 'https://model.chemvault.science/app-version.json';
const QUANTUM_TIMEOUT_MS = 180000;
const MAX_GAUSSIAN_TIMEOUT_MS = 12 * 60 * 60 * 1000;
const GAUSSIAN_LOG_POLL_INTERVAL_MS = 1500;
const GAUSSIAN_LOG_PROGRESS_CHUNK_BYTES = 256 * 1024;
const MAX_QUANTUM_INPUT_BYTES = 2 * 1024 * 1024;
const MAX_GAUSSIAN_CHECKPOINT_BYTES = 128 * 1024 * 1024;
const MAX_GAUSSIAN_BRIDGE_ATTACHMENT_BYTES = 128 * 1024 * 1024;
const VERSION_CHECK_TIMEOUT_MS = 8000;
const PYSCF_INSTALL_TIMEOUT_MS = 1200000;
const PYSCF_PIP_TIMEOUT_SECONDS = 120;
const TEXT_DECODERS = {
  utf8: new TextDecoder('utf-8'),
  utf16le: new TextDecoder('utf-16le'),
  gb18030: new TextDecoder('gb18030')
};
const EXTERNAL_ENGINE_CONFIG_FILE = 'quantum-engines.json';
const LOCAL_ENGINE_CONFIG_FILE = 'local-quantum-engines.json';
const ENGINE_SETUP_REQUEST_FILE = 'engine-setup-request.json';
const QUANTUM_ENGINE_LABELS = {
  xtb: 'xTB',
  pyscf: 'PySCF',
  psi4: 'Psi4',
  gaussian: 'Gaussian',
  orca: 'ORCA'
};
const LOCAL_OPEN_SOURCE_ENGINES = {
  xtb: {
    engine: 'xtb',
    engineLabel: 'xTB',
    installMode: 'manual',
    installCommand: 'Install xTB for Windows, add xtb.exe to PATH, set CHEMVAULT_XTB_PATH, or bundle it under desktop/quantum/xtb.'
  },
  pyscf: {
    engine: 'pyscf',
    engineLabel: 'PySCF',
    installMode: 'managed',
    installCommand: 'Managed install: python -m venv <ChemVault user data>/engines/pyscf && pip install pyscf'
  },
  psi4: {
    engine: 'psi4',
    engineLabel: 'Psi4',
    installMode: 'manual',
    installCommand: 'Recommended manual install: conda install -c conda-forge psi4'
  }
};
const DEFAULT_EXTERNAL_ENGINE_CONFIG = {
  gaussian: {
    engine: 'gaussian',
    executablePath: '',
    method: 'B3LYP',
    basisSet: '6-31G(d)',
    routeOptions: '',
    processorCount: 0,
    memoryGb: 0,
    scratchDirectory: '',
    outputDetail: 'standard',
    performanceProfile: 'balanced'
  },
  orca: {
    engine: 'orca',
    executablePath: '',
    method: 'B3LYP',
    basisSet: 'def2-SVP',
    routeOptions: 'TightSCF',
    processorCount: 4,
    memoryGb: 4,
    scratchDirectory: '',
    outputDetail: 'standard',
    performanceProfile: 'balanced'
  }
};
const ATOMIC_SYMBOLS = [
  '',
  'H', 'He',
  'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne',
  'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar',
  'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
  'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr',
  'Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd',
  'In', 'Sn', 'Sb', 'Te', 'I', 'Xe',
  'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy',
  'Ho', 'Er', 'Tm', 'Yb', 'Lu',
  'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg',
  'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn',
  'Fr', 'Ra', 'Ac', 'Th', 'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf',
  'Es', 'Fm', 'Md', 'No', 'Lr',
  'Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt', 'Ds', 'Rg', 'Cn', 'Nh', 'Fl', 'Mc',
  'Lv', 'Ts', 'Og'
];

let mainWindow = null;
let staticServer = null;
const userCookieJar = new Map();
const activeQuantumProcesses = new Map();

app.setName(APP_TITLE);

ipcMain.handle('app:version-status', async () => getAppVersionStatus());
ipcMain.handle('app:open-update-url', async (_event, url) => openUpdateUrl(url));
ipcMain.handle('quantum:engine-status', async (_event, engine) => getQuantumEngineStatus(engine));
ipcMain.handle('quantum:run', async (event, request) => runQuantumCalculation(request, (progress) => {
  event.sender.send('quantum:run-progress', progress);
}));
ipcMain.handle('quantum:cancel', async (_event, calculationId) => cancelQuantumCalculation(calculationId));
ipcMain.handle('quantum:external-config:get', async (_event, engine) => getExternalQuantumConfig(engine));
ipcMain.handle('quantum:external-config:save', async (_event, config) => saveExternalQuantumConfig(config));
ipcMain.handle('quantum:external-config:discover', async (_event, engine) => discoverAndSaveExternalQuantumConfig(engine));
ipcMain.handle('quantum:select-executable', async (_event, engine) => selectQuantumEngineExecutable(engine));
ipcMain.handle('quantum:select-scratch-directory', async () => selectGaussianScratchDirectory());
ipcMain.handle('quantum:gaussian-tools', async () => getGaussianBridgeTools());
ipcMain.handle('quantum:gaussian-formchk', async (_event, request) => runGaussianFormchk(request));
ipcMain.handle('quantum:gaussian-cubegen', async (_event, request) => runGaussianCubegen(request));
ipcMain.handle('quantum:gaussian-open-gaussview', async (_event, request) => openGaussianInGaussView(request));
ipcMain.handle('quantum:local-engines:list', async () => getLocalOpenSourceEngines());
ipcMain.handle('quantum:local-engine:install', async (event, engine) => installLocalOpenSourceEngine(engine, (progress) => {
  event.sender.send('quantum:local-engine:install-progress', progress);
}));
ipcMain.handle('quantum:local-engine:select', async (_event, engine) => selectLocalOpenSourceEngineExecutable(engine));
ipcMain.handle('quantum:local-engines:open-folder', async () => openLocalEngineFolder());
ipcMain.handle('quantum:engine-setup-request:get', async () => readEngineSetupRequest());
ipcMain.handle('quantum:engine-setup-request:clear', async () => clearEngineSetupRequest());

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  const staticRoot = path.join(app.getAppPath(), 'out');
  staticServer = await startDesktopServer(staticRoot);
  createMainWindow(staticServer.url);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && staticServer) {
      createMainWindow(staticServer.url);
    }
  });
});

app.on('before-quit', () => {
  if (staticServer) {
    staticServer.close();
    staticServer = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function createMainWindow(baseUrl) {
  mainWindow = new BrowserWindow({
    title: APP_TITLE,
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    icon: path.join(app.getAppPath(), 'out', 'favicon.ico'),
    backgroundColor: '#f1f5f9',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url, baseUrl)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isExternalUrl(url, baseUrl)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  const startPath = normalizeStartPath(process.env.CHEMVAULT_DESKTOP_START_PATH || DEFAULT_START_PATH);
  mainWindow.loadURL(new URL(startPath, baseUrl).toString());
}

function isExternalUrl(value, baseUrl) {
  try {
    const target = new URL(value);
    const local = new URL(baseUrl);
    return target.origin !== local.origin;
  } catch {
    return true;
  }
}

function normalizeStartPath(value) {
  const trimmed = String(value || DEFAULT_START_PATH).trim();
  if (!trimmed || /^https?:\/\//iu.test(trimmed)) return DEFAULT_START_PATH;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

async function getAppVersionStatus() {
  const checkedAt = new Date().toISOString();
  const localManifest = readLocalVersionManifest();
  const localConfig = platformVersionConfig(localManifest, 'windows');
  const currentVersion = String(app.getVersion() || localConfig.version || '0.0.0');
  const currentBuildId = String(localConfig.buildId || localManifest?.generatedFrom?.commit || currentVersion);
  const currentReleaseId = String(localConfig.releaseId || `windows-v${currentVersion}`);
  const sourceUrl = versionManifestUrl();

  try {
    const remoteManifest = await fetchVersionManifest(sourceUrl);
    const remoteConfig = platformVersionConfig(remoteManifest, 'windows');
    const latestVersion = String(remoteConfig.latestVersion || remoteConfig.version || currentVersion);
    const minimumSupportedVersion = String(remoteConfig.minimumSupportedVersion || '0.0.0');
    const updateRequired = compareVersions(currentVersion, minimumSupportedVersion) < 0 || Boolean(remoteConfig.forceUpdate);
    const updateAvailable = updateRequired || compareVersions(currentVersion, latestVersion) < 0;
    const canDefer = updateAvailable && !updateRequired;

    return {
      ok: true,
      appName: APP_TITLE,
      platform: 'windows',
      status: updateRequired ? 'required' : updateAvailable ? 'available' : 'current',
      currentVersion,
      currentBuildId,
      currentReleaseId,
      latestVersion,
      latestBuildId: String(remoteConfig.buildId || ''),
      minimumSupportedVersion,
      updateAvailable,
      updateRequired,
      canDefer,
      deferralHours: boundedInteger(remoteConfig.allowDeferralHours, 24, 1, 168),
      checkIntervalSeconds: boundedInteger(remoteConfig.updateCheckIntervalSeconds, 300, 60, 86400),
      checkedAt,
      sourceUrl,
      downloadUrl: validExternalUrl(remoteConfig.downloadUrl) || 'https://github.com/Eddy-ZM/ChemVault-Model/releases/latest',
      releaseNotesUrl: validExternalUrl(remoteConfig.releaseNotesUrl) || '',
      message: String(remoteConfig.message || (updateRequired
        ? 'This ChemVault Model desktop build must be updated before continuing.'
        : updateAvailable
          ? 'A newer ChemVault Model desktop build is available.'
          : 'ChemVault Model is current.'))
    };
  } catch (error) {
    return {
      ok: false,
      appName: APP_TITLE,
      platform: 'windows',
      status: 'offline',
      currentVersion,
      currentBuildId,
      currentReleaseId,
      latestVersion: currentVersion,
      latestBuildId: '',
      minimumSupportedVersion: '0.0.0',
      updateAvailable: false,
      updateRequired: false,
      canDefer: false,
      deferralHours: 24,
      checkIntervalSeconds: 300,
      checkedAt,
      sourceUrl,
      downloadUrl: 'https://github.com/Eddy-ZM/ChemVault-Model/releases/latest',
      releaseNotesUrl: '',
      message: 'Could not verify whether ChemVault Model is the latest release. The app will keep checking in the background.',
      error: error instanceof Error ? error.message : 'Version check failed.'
    };
  }
}

async function openUpdateUrl(value) {
  const url = validExternalUrl(value) || 'https://github.com/Eddy-ZM/ChemVault-Model/releases/latest';
  await shell.openExternal(url);
  return { ok: true, url };
}

function versionManifestUrl() {
  return String(
    process.env.CHEMVAULT_APP_VERSION_URL ||
      process.env.CHEMVAULT_MODEL_VERSION_URL ||
      process.env.NEXT_PUBLIC_CHEMVAULT_APP_VERSION_URL ||
      DEFAULT_VERSION_MANIFEST_URL
  ).trim() || DEFAULT_VERSION_MANIFEST_URL;
}

async function fetchVersionManifest(manifestUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERSION_CHECK_TIMEOUT_MS);

  try {
    const target = new URL(manifestUrl);
    target.searchParams.set('t', String(Date.now()));
    const response = await fetch(target.toString(), {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`Version manifest returned HTTP ${response.status}.`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function readLocalVersionManifest() {
  const candidates = [
    path.join(app.getAppPath(), 'out', 'app-version.json'),
    path.join(process.resourcesPath || '', 'app-version.json')
  ];

  for (const candidate of candidates) {
    if (!candidate || !isReadableFile(candidate)) continue;
    try {
      return JSON.parse(fs.readFileSync(candidate, 'utf8'));
    } catch {
      return {};
    }
  }

  return {};
}

function platformVersionConfig(manifest, platform) {
  if (!manifest || typeof manifest !== 'object') return {};
  return (
    manifest.platforms?.[platform] ||
    manifest.apps?.model?.platforms?.[platform] ||
    manifest.apps?.['chemvault-model']?.platforms?.[platform] ||
    manifest.model?.platforms?.[platform] ||
    manifest.model?.[platform] ||
    manifest[platform] ||
    {}
  );
}

function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = a[index] || 0;
    const rightPart = b[index] || 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
}

function versionParts(value) {
  return String(value || '0')
    .split(/[.+-]/u)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
}

function validExternalUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function startDesktopServer(staticRoot) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (request, response) => {
      try {
        await handleDesktopRequest(staticRoot, request, response);
      } catch (error) {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end(error instanceof Error ? error.message : 'Desktop server error');
      }
    });

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not start desktop server.'));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () => server.close()
      });
    });
  });
}

async function handleDesktopRequest(staticRoot, request, response) {
  const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
  if (requestUrl.pathname.startsWith('/desktop-user-api/')) {
    await proxyUserApi(request, response, requestUrl);
    return;
  }

  if (requestUrl.pathname.startsWith('/api/chem/')) {
    await proxyChemApi(request, response, requestUrl);
    return;
  }

  serveStaticFile(staticRoot, requestUrl, response);
}

async function proxyChemApi(request, response, requestUrl) {
  const apiBase = normalizeApiBase(
    process.env.CHEMVAULT_MODEL_API_URL ||
      process.env.NEXT_PUBLIC_MOLECULE_API_URL ||
      process.env.VITE_MOLECULE_API_URL ||
      DEFAULT_API_BASE
  );
  const targetPath = requestUrl.pathname.slice('/api/chem'.length);
  const targetUrl = `${apiBase}${targetPath}${requestUrl.search}`;
  const body = await readRequestBody(request);

  const headers = sanitizeProxyHeaders(request.headers);
  headers['x-chemvault-client'] = 'desktop-windows';

  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: body.length > 0 && request.method !== 'GET' && request.method !== 'HEAD' ? body : undefined
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'fetch failed';
    response.writeHead(502, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    response.end(
      JSON.stringify({
        error: `Cannot reach the ChemVault chemistry service. ${message}`,
        code: 'CHEM_API_PROXY_FAILED'
      })
    );
    return;
  }

  const responseHeaders = {};
  upstream.headers.forEach((value, key) => {
    if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
      responseHeaders[key] = value;
    }
  });

  response.writeHead(upstream.status, responseHeaders);
  const arrayBuffer = await upstream.arrayBuffer();
  response.end(Buffer.from(arrayBuffer));
}

async function proxyUserApi(request, response, requestUrl) {
  const userOrigin = normalizeOrigin(process.env.CHEMVAULT_USER_ORIGIN || process.env.NEXT_PUBLIC_CHEMVAULT_USER_ORIGIN || DEFAULT_USER_ORIGIN);
  const targetPath = requestUrl.pathname.slice('/desktop-user-api'.length);
  const targetUrl = `${userOrigin}${targetPath}${requestUrl.search}`;
  const body = await readRequestBody(request);

  const headers = sanitizeProxyHeaders(request.headers);
  headers.origin = userOrigin;
  headers.referer = `${userOrigin}/`;
  headers['x-chemvault-client'] = 'desktop-windows';

  const cookieHeader = desktopUserCookieHeader();
  if (cookieHeader) {
    headers.cookie = cookieHeader;
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      redirect: 'manual',
      body: body.length > 0 && request.method !== 'GET' && request.method !== 'HEAD' ? body : undefined
    });

    rememberSetCookies(readSetCookieHeaders(upstream.headers));

    const responseHeaders = {};
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (!['content-encoding', 'content-length', 'transfer-encoding', 'set-cookie'].includes(lower)) {
        responseHeaders[key] = value;
      }
    });
    responseHeaders['cache-control'] = 'no-store';
    responseHeaders['content-type'] = responseHeaders['content-type'] || 'application/json; charset=utf-8';

    response.writeHead(upstream.status, responseHeaders);
    const arrayBuffer = await upstream.arrayBuffer();
    response.end(Buffer.from(arrayBuffer));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ChemVault User request failed.';
    response.writeHead(502, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    response.end(
      JSON.stringify({
        error: {
          code: 'DESKTOP_USER_PROXY_FAILED',
          message: `Cannot reach ChemVault User service. ${message}`
        }
      })
    );
  }
}

function sanitizeProxyHeaders(source) {
  const headers = {};
  for (const [key, value] of Object.entries(source)) {
    const normalizedKey = key.toLowerCase();
    if (['host', 'connection', 'content-length', 'accept-encoding'].includes(normalizedKey)) continue;
    if (typeof value === 'string') {
      headers[key] = value;
    } else if (Array.isArray(value)) {
      headers[key] = value.join(', ');
    }
  }
  return headers;
}

function normalizeApiBase(value) {
  const trimmed = String(value || DEFAULT_API_BASE).trim().replace(/\/+$/u, '');
  if (/\/api\/chem$/iu.test(trimmed)) return trimmed;
  if (/\/api$/iu.test(trimmed)) return `${trimmed}/chem`;
  return `${trimmed}/api/chem`;
}

function normalizeOrigin(value) {
  return String(value || DEFAULT_USER_ORIGIN).trim().replace(/\/+$/u, '');
}

function desktopUserCookieHeader() {
  return Array.from(userCookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function readSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }

  const combined = headers.get('set-cookie');
  if (!combined) return [];
  return splitCombinedSetCookie(combined);
}

function splitCombinedSetCookie(value) {
  const cookies = [];
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== ',') continue;
    const next = value.slice(index + 1).trimStart();
    if (/^[^=;,\s]+=/.test(next)) {
      cookies.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  cookies.push(value.slice(start).trim());
  return cookies.filter(Boolean);
}

function rememberSetCookies(cookies) {
  for (const cookie of cookies) {
    const [pair, ...attributes] = cookie.split(';').map((part) => part.trim());
    const equalsIndex = pair.indexOf('=');
    if (equalsIndex <= 0) continue;

    const name = pair.slice(0, equalsIndex);
    const value = pair.slice(equalsIndex + 1);
    const expired = attributes.some((attribute) => /^max-age=0$/iu.test(attribute) || /^expires=/iu.test(attribute) && /1970|1969|Thu, 01 Jan/iu.test(attribute));

    if (expired || value === '') {
      userCookieJar.delete(name);
    } else {
      userCookieJar.set(name, value);
    }
  }
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

function serveStaticFile(staticRoot, requestUrl, response) {
  const filePath = resolveStaticPath(staticRoot, requestUrl.pathname);
  if (!filePath) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': contentType(filePath),
    'Cache-Control': cacheControl(filePath)
  });
  fs.createReadStream(filePath).pipe(response);
}

function resolveStaticPath(staticRoot, pathname) {
  const decoded = decodeURIComponent(pathname);
  const safePath = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const relative = safePath === '/' ? 'index.html' : safePath.replace(/^[/\\]/u, '');
  const candidates = [];

  candidates.push(path.join(staticRoot, relative));
  if (!path.extname(relative)) {
    candidates.push(path.join(staticRoot, relative, 'index.html'));
    candidates.push(path.join(staticRoot, `${relative}.html`));
  }
  if (relative.endsWith('/')) {
    candidates.push(path.join(staticRoot, relative, 'index.html'));
  }

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (!resolved.startsWith(path.resolve(staticRoot))) continue;
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      return resolved;
    }
  }

  return null;
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.map': 'application/json; charset=utf-8'
  };
  return types[ext] || 'application/octet-stream';
}

function cacheControl(filePath) {
  return filePath.includes(`${path.sep}_next${path.sep}`) || filePath.includes(`${path.sep}vendor${path.sep}`)
    ? 'public, max-age=31536000, immutable'
    : 'no-cache';
}

async function getQuantumEngineStatus(engineValue) {
  const engineKind = normalizeEngineKind(engineValue);
  if (isCommercialEngineKind(engineKind)) {
    return getExternalEngineStatus(engineKind);
  }

  if (engineKind === 'pyscf') {
    const status = await getPyscfStatus();
    return {
      available: status.available,
      engine: 'pyscf',
      engineLabel: QUANTUM_ENGINE_LABELS.pyscf,
      method: 'DFT/HF',
      executable: status.executable,
      source: status.installMode === 'managed' ? 'configured' : 'path',
      version: status.version,
      message: status.message
    };
  }

  const engine = resolveXtbEngine();
  if (!engine) {
    return {
      available: false,
      engine: 'xtb',
      engineLabel: QUANTUM_ENGINE_LABELS.xtb,
      method: 'GFN2-xTB',
      message: 'xTB engine was not found. Install xTB, set CHEMVAULT_XTB_PATH, or bundle it under desktop/quantum/xtb before building.'
    };
  }

  const versionResult = await runProcess(engine.executable, ['--version'], { timeoutMs: 10000, env: buildXtbEnv(engine) });
  return {
    available: true,
    engine: 'xtb',
    engineLabel: QUANTUM_ENGINE_LABELS.xtb,
    method: 'GFN2-xTB',
    executable: engine.executable,
    source: engine.source,
    version: extractVersion(`${versionResult.stdout}\n${versionResult.stderr}`),
    message: 'xTB engine is ready.'
  };
}

async function runQuantumCalculation(request, onProgress = () => {}) {
  const engineKind = normalizeEngineKind(request?.engine);
  const calculationId = normalizeCalculationId(request?.calculationId);
  emitCalculationProgress(
    onProgress,
    engineKind,
    'preparing',
    2,
    `Preparing ${QUANTUM_ENGINE_LABELS[engineKind] || 'quantum engine'} calculation.`
  );

  if (isCommercialEngineKind(engineKind)) {
    return runExternalQuantumCalculation(engineKind, { ...request, calculationId }, onProgress);
  }

  if (engineKind === 'pyscf') {
    return runPyscfCalculation({ ...request, calculationId }, onProgress);
  }

  const startedAt = Date.now();
  emitCalculationProgress(onProgress, 'xtb', 'checking-engine', 6, 'Checking xTB engine availability.', undefined, startedAt);
  const engine = resolveXtbEngine();
  const calculationMode = normalizeCalculationMode(request?.calculationMode);
  const baseResult = {
    ok: false,
    engine: 'xtb',
    engineLabel: QUANTUM_ENGINE_LABELS.xtb,
    method: 'GFN2-xTB',
    calculationMode,
    energyHartree: null,
    dipoleDebye: null,
    charges: [],
    chargeModel: 'xTB population analysis',
    elapsedMs: 0,
    warnings: [],
    outputTail: '',
    outputLog: ''
  };

  if (!engine) {
    emitCalculationProgress(onProgress, 'xtb', 'error', 100, 'xTB engine was not found.', undefined, startedAt);
    return {
      ...baseResult,
      elapsedMs: Date.now() - startedAt,
      error: 'xTB engine was not found. Install xTB, set CHEMVAULT_XTB_PATH, or bundle it under desktop/quantum/xtb before building.'
    };
  }

  const xyz = normalizeQuantumInput(request?.xyz);
  if (!xyz) {
    emitCalculationProgress(onProgress, 'xtb', 'error', 100, 'A valid 3D XYZ structure is required before running xTB.', undefined, startedAt);
    return {
      ...baseResult,
      elapsedMs: Date.now() - startedAt,
      error: 'A valid 3D XYZ structure is required before running a quantum calculation.'
    };
  }

  const charge = boundedInteger(request?.charge, 0, -20, 20);
  const unpairedElectrons = boundedInteger(request?.unpairedElectrons, 0, 0, 20);
  const timeoutMs = boundedInteger(request?.timeoutMs, QUANTUM_TIMEOUT_MS, 30000, 900000);
  const workDir = await fs.promises.mkdtemp(path.join(app.getPath('temp'), 'chemvault-xtb-'));
  const inputPath = path.join(workDir, 'input.xyz');

  try {
    emitCalculationProgress(onProgress, 'xtb', 'writing-input', 18, 'Writing xTB XYZ input file.', undefined, startedAt);
    await fs.promises.writeFile(inputPath, xyz, 'utf8');
    const args = buildXtbArgs(inputPath, charge, unpairedElectrons, calculationMode);
    emitCalculationProgress(onProgress, 'xtb', 'starting-engine', 28, 'Starting xTB calculation process.', undefined, startedAt);
    const runStartedAt = Date.now();
    const processResult = await runProcessWithProgress(
      engine.executable,
      args,
      {
        cwd: workDir,
        timeoutMs,
        env: buildXtbEnv(engine),
        jobId: calculationId,
        progress: (output) => emitCalculationProgress(
          onProgress,
          'xtb',
          'running-engine',
          estimateProgress(runStartedAt, timeoutMs, 32, 82),
          'xTB is running the quantum calculation.',
          output,
          startedAt
        )
      }
    );
    const engineCompletedAt = Date.now();
    const output = `${processResult.stdout}\n${processResult.stderr}`.trim();
    emitCalculationProgress(onProgress, 'xtb', 'reading-output', 86, 'Reading xTB result files.', outputTail(output), startedAt);
    const charges = await readCharges(workDir, xyz);
    const optimizedXyz = calculationMode === 'geometry-optimization'
      ? normalizeQuantumInput(await readOptionalText(path.join(workDir, 'xtbopt.xyz')))
      : null;
    emitCalculationProgress(onProgress, 'xtb', 'parsing-output', 94, 'Parsing xTB energy, dipole, and charge output.', outputTail(output), startedAt);
    const energyHartree = parseEnergy(output);
    const dipoleDebye = parseDipole(output);
    const warnings = [];

    if (processResult.timedOut) warnings.push('xTB calculation timed out before completion.');
    if (processResult.cancelled) warnings.push('Calculation was cancelled before completion.');
    if (energyHartree === null) warnings.push('Total energy was not found in xTB output.');
    if (!dipoleDebye) warnings.push('Dipole moment was not found in xTB output.');
    if (charges.length === 0) warnings.push('Partial charges file was not produced by xTB.');

    const completedAt = Date.now();
    const result = {
      ok: processResult.exitCode === 0 && !processResult.cancelled,
      cancelled: processResult.cancelled || undefined,
      timedOut: processResult.timedOut || undefined,
      engine: 'xtb',
      engineLabel: QUANTUM_ENGINE_LABELS.xtb,
      method: 'GFN2-xTB',
      calculationMode,
      performanceProfile: 'fast-screening',
      energyHartree,
      dipoleDebye,
      charges,
      chargeModel: 'xTB population analysis',
      optimizedXyz,
      elapsedMs: completedAt - startedAt,
      engineElapsedMs: engineCompletedAt - runStartedAt,
      postProcessingElapsedMs: completedAt - engineCompletedAt,
      warnings,
      outputTail: outputTail(output),
      outputLog: output,
      error: processResult.cancelled ? 'xTB calculation was cancelled by the user.' : processResult.exitCode === 0 ? undefined : `xTB exited with code ${processResult.exitCode}.`
    };
    emitCalculationProgress(
      onProgress,
      'xtb',
      result.ok ? 'complete' : 'error',
      100,
      result.ok ? 'xTB calculation completed.' : result.error,
      result.outputTail,
      startedAt
    );
    return result;
  } catch (error) {
    emitCalculationProgress(
      onProgress,
      'xtb',
      'error',
      100,
      error instanceof Error ? error.message : 'xTB calculation failed.',
      undefined,
      startedAt
    );
    return {
      ...baseResult,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'Quantum calculation failed.'
    };
  } finally {
    await fs.promises.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function getExternalEngineStatus(engineKind) {
  const config = await getExternalQuantumConfig(engineKind);
  const engineLabel = QUANTUM_ENGINE_LABELS[engineKind] || 'External engine';
  const methodLabel = externalMethodLabel(config);

  if (!config.executablePath) {
    return {
      available: false,
      engine: engineKind,
      engineLabel,
      method: methodLabel,
      message: `${engineLabel} executable is not configured and was not found during automatic discovery. Select a licensed local installation before running this engine.`
    };
  }

  if (!isReadableFile(config.executablePath)) {
    return {
      available: false,
      engine: engineKind,
      engineLabel,
      method: methodLabel,
      executable: config.executablePath,
      source: 'configured',
      message: `${engineLabel} executable was not found at the configured path.`
    };
  }

  return {
    available: true,
    engine: engineKind,
    engineLabel,
    method: methodLabel,
    executable: config.executablePath,
    source: 'configured',
    message: `${engineLabel} external engine port is ready.`
  };
}

async function runExternalQuantumCalculation(engineKind, request, onProgress = () => {}) {
  const startedAt = Date.now();
  emitCalculationProgress(
    onProgress,
    engineKind,
    'checking-engine',
    5,
    `Loading ${QUANTUM_ENGINE_LABELS[engineKind] || 'external engine'} configuration.`,
    undefined,
    startedAt
  );
  const config = await getExternalQuantumConfig(engineKind);
  const engineLabel = QUANTUM_ENGINE_LABELS[engineKind] || 'External engine';
  const calculationMode = normalizeCalculationMode(request?.calculationMode);
  const gaussianTask = engineKind === 'gaussian' ? normalizeGaussianTask(request?.gaussianTask, calculationMode) : undefined;
  const gaussianTaskLabel = gaussianTask ? gaussianTaskLabelFor(gaussianTask) : undefined;
  const method = sanitizeQuantumToken(request?.method) || config.method;
  const basisSet = sanitizeQuantumToken(request?.basisSet) || config.basisSet;
  const routeOptions = sanitizeRouteOptions(request?.routeOptions || config.routeOptions || '');
  const outputDetail = normalizeGaussianOutputDetail(request?.outputDetail || config.outputDetail);
  const performanceProfile = request?.performanceProfile === 'fast-screening'
    ? 'fast-screening'
    : normalizeGaussianPerformanceProfile(request?.performanceProfile || config.performanceProfile);
  const resourceDefaults = gaussianResourceDefaults();
  const processorCount = boundedInteger(request?.processorCount, config.processorCount || resourceDefaults.processors, 1, resourceDefaults.availableProcessors);
  const memoryGb = boundedInteger(request?.memoryGb, config.memoryGb || resourceDefaults.memoryGb, 1, resourceDefaults.memoryCapGb);
  const scratchDirectory = String(request?.scratchDirectory || config.scratchDirectory || '').trim();
  const reuseGaussianCheckpoint = engineKind === 'gaussian' && Boolean(request?.reuseGaussianCheckpoint && request?.gaussianCheckpointBase64);
  const calculationId = normalizeCalculationId(request?.calculationId);
  const methodLabel = externalMethodLabel({ ...config, method, basisSet });
  const baseResult = {
    ok: false,
    engine: engineKind,
    engineLabel,
    method: methodLabel,
    calculationMode,
    ...(gaussianTask ? { gaussianTask, gaussianTaskLabel } : {}),
    performanceProfile,
    outputDetail,
    resourceUsage: {
      processorCount,
      memoryGb,
      ...(scratchDirectory ? { scratchDirectory } : {})
    },
    reusedCheckpoint: reuseGaussianCheckpoint || undefined,
    energyHartree: null,
    dipoleDebye: null,
    charges: [],
    chargeModel: `${engineLabel} Mulliken population analysis`,
    elapsedMs: 0,
    warnings: [],
    outputTail: '',
    outputLog: ''
  };

  if (!config.executablePath || !isReadableFile(config.executablePath)) {
    emitCalculationProgress(onProgress, engineKind, 'error', 100, `${engineLabel} executable is not configured or cannot be read.`, undefined, startedAt);
    return {
      ...baseResult,
      elapsedMs: Date.now() - startedAt,
      error: `${engineLabel} executable is not configured or cannot be read.`
    };
  }

  const xyz = normalizeQuantumInput(request?.xyz);
  if (!xyz) {
    emitCalculationProgress(onProgress, engineKind, 'error', 100, 'A valid 3D XYZ structure is required before running an external engine.', undefined, startedAt);
    return {
      ...baseResult,
      elapsedMs: Date.now() - startedAt,
      error: 'A valid 3D XYZ structure is required before running an external quantum engine.'
    };
  }

  const charge = boundedInteger(request?.charge, 0, -20, 20);
  const unpairedElectrons = boundedInteger(request?.unpairedElectrons, 0, 0, 20);
  const multiplicity = unpairedElectrons + 1;
  const timeoutMs = boundedInteger(
    request?.timeoutMs,
    calculationMode === 'geometry-optimization' ? 4 * 60 * 60 * 1000 : 30 * 60 * 1000,
    30000,
    engineKind === 'gaussian' ? MAX_GAUSSIAN_TIMEOUT_MS : 3600000
  );
  const workDir = await fs.promises.mkdtemp(path.join(app.getPath('temp'), `chemvault-${engineKind}-`));

  try {
    emitCalculationProgress(onProgress, engineKind, 'writing-input', 18, `Writing ${engineLabel} input files.`, undefined, startedAt);
    const job = engineKind === 'gaussian'
      ? await prepareGaussianJob(workDir, xyz, {
          charge,
          multiplicity,
          method,
          basisSet,
          routeOptions,
          calculationMode,
          gaussianTask,
          processorCount,
          memoryGb,
          outputDetail,
          reuseCheckpoint: reuseGaussianCheckpoint,
          checkpointBase64: request?.gaussianCheckpointBase64
        })
      : await prepareOrcaJob(workDir, xyz, { charge, multiplicity, method, basisSet, routeOptions, calculationMode, processorCount, memoryGb });
    emitCalculationProgress(onProgress, engineKind, 'starting-engine', 28, `Starting ${engineLabel} calculation process.`, undefined, startedAt);
    const runStartedAt = Date.now();
    const processResult = engineKind === 'gaussian'
      ? await runGaussianJob(config.executablePath, job, workDir, timeoutMs, (output) => emitCalculationProgress(
        onProgress,
        engineKind,
        'running-engine',
        estimateProgress(runStartedAt, timeoutMs, 32, 82),
        `${engineLabel} is running the quantum calculation.`,
        output,
        startedAt
      ), calculationId, { scratchDirectory })
      : await runProcessWithProgress(config.executablePath, job.args, {
        cwd: workDir,
        timeoutMs,
        env: buildExternalEngineEnv(engineKind, config.executablePath, workDir),
        jobId: calculationId,
        progress: (output) => emitCalculationProgress(
          onProgress,
          engineKind,
          'running-engine',
          estimateProgress(runStartedAt, timeoutMs, 32, 82),
          `${engineLabel} is running the quantum calculation.`,
          output,
          startedAt
        )
      });
    const engineCompletedAt = Date.now();
    const fileOutput = await readOptionalText(job.outputPath);
    const output = [processResult.stdout, processResult.stderr, fileOutput].filter(Boolean).join('\n').trim();
    emitCalculationProgress(onProgress, engineKind, 'reading-output', 86, `Reading ${engineLabel} output files.`, outputTail(output), startedAt);
    const gaussianPopulation = engineKind === 'gaussian' ? parseGaussianPopulation(output) : null;
    const energyHartree = engineKind === 'gaussian' ? parseGaussianEnergy(output) : parseOrcaEnergy(output);
    const dipoleDebye = engineKind === 'gaussian' ? parseGaussianDipole(output) : parseOrcaDipole(output);
    const charges = engineKind === 'gaussian' ? gaussianPopulation.charges : parseOrcaCharges(output);
    const frontierOrbitals = engineKind === 'gaussian' ? parseGaussianFrontierOrbitals(output) : null;
    const frequencySummary = engineKind === 'gaussian' ? parseGaussianFrequencySummary(output) : null;
    const thermochemistry = engineKind === 'gaussian' ? parseGaussianThermochemistry(output) : null;
    const optimizedXyz = engineKind === 'gaussian' ? parseGaussianOptimizedXyz(output) : null;
    const excitedStates = engineKind === 'gaussian' ? parseGaussianExcitedStates(output) : null;
    const nmrShielding = engineKind === 'gaussian' ? parseGaussianNmrShielding(output) : null;
    emitCalculationProgress(onProgress, engineKind, 'parsing-output', 94, `Parsing ${engineLabel} energy, dipole, and population analysis.`, outputTail(output), startedAt);
    const completedOk = !processResult.cancelled && processResult.exitCode === 0 && (engineKind !== 'gaussian' || /Normal termination of Gaussian/iu.test(output));
    const warnings = [];
    const gaussianFiles = engineKind === 'gaussian' ? await collectGaussianFiles(job, fileOutput || output) : undefined;

    if (processResult.timedOut) warnings.push(`${engineLabel} calculation timed out before completion.`);
    if (processResult.cancelled) warnings.push(`${engineLabel} calculation was cancelled before completion.`);
    if (engineKind === 'gaussian' && processResult.exitCode === 0 && !completedOk) {
      warnings.push('Gaussian did not report normal termination in the output log.');
    }
    if (engineKind === 'gaussian' && completedOk && !gaussianFiles?.checkpoint) {
      warnings.push(gaussianFiles?.checkpointUnavailableReason || 'Gaussian checkpoint file was not generated or could not be attached to the export package.');
    }
    if (energyHartree === null) warnings.push('Total energy was not found in the external engine output.');
    if (!dipoleDebye) warnings.push('Dipole moment was not found in the external engine output.');
    if (charges.length === 0) warnings.push('Mulliken charges were not found in the external engine output.');

    const completedAt = Date.now();
    const result = {
      ok: completedOk,
      cancelled: processResult.cancelled || undefined,
      timedOut: processResult.timedOut || undefined,
      engine: engineKind,
      engineLabel,
      method: methodLabel,
      calculationMode,
      ...(gaussianTask ? { gaussianTask, gaussianTaskLabel } : {}),
      performanceProfile,
      outputDetail,
      energyHartree,
      dipoleDebye,
      charges,
      chargeModel: engineKind === 'gaussian' ? gaussianPopulation.model : `${engineLabel} Mulliken population analysis`,
      frontierOrbitals,
      frequencySummary,
      thermochemistry,
      optimizedXyz,
      excitedStates,
      nmrShielding,
      elapsedMs: completedAt - startedAt,
      engineElapsedMs: engineCompletedAt - runStartedAt,
      postProcessingElapsedMs: completedAt - engineCompletedAt,
      resourceUsage: {
        processorCount,
        memoryGb,
        ...(scratchDirectory ? { scratchDirectory } : {})
      },
      reusedCheckpoint: reuseGaussianCheckpoint || undefined,
      warnings,
      outputTail: outputTail(output),
      outputLog: output,
      gaussianFiles: gaussianFiles ? { ...gaussianFiles, reusedCheckpoint: reuseGaussianCheckpoint || undefined } : undefined,
      error: completedOk ? undefined : diagnoseExternalEngineFailure(engineKind, processResult, output, config)
    };
    emitCalculationProgress(
      onProgress,
      engineKind,
      result.ok ? 'complete' : 'error',
      100,
      result.ok ? `${engineLabel} calculation completed.` : result.error,
      result.outputTail,
      startedAt
    );
    return result;
  } catch (error) {
    const completedAt = Date.now();
    emitCalculationProgress(
      onProgress,
      engineKind,
      'error',
      100,
      error instanceof Error ? error.message : `${engineLabel} calculation failed.`,
      undefined,
      startedAt
    );
    return {
      ...baseResult,
      elapsedMs: completedAt - startedAt,
      engineElapsedMs: 0,
      postProcessingElapsedMs: completedAt - startedAt,
      error: error instanceof Error ? error.message : `${engineLabel} calculation failed.`
    };
  } finally {
    await fs.promises.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function getLocalOpenSourceEngines() {
  const [xtbStatus, pyscfStatus, psi4Status] = await Promise.all([
    getXtbLocalStatus(),
    getPyscfStatus(),
    getPsi4Status()
  ]);
  return [xtbStatus, pyscfStatus, psi4Status];
}

async function getXtbLocalStatus() {
  const engine = resolveXtbEngine();
  const template = LOCAL_OPEN_SOURCE_ENGINES.xtb;
  if (!engine) {
    return {
      ...template,
      available: false,
      installed: false,
      message: 'xTB was not found. Install it locally, add it to PATH, set CHEMVAULT_XTB_PATH, or bundle it with the desktop package.'
    };
  }

  const versionResult = await runProcess(engine.executable, ['--version'], { timeoutMs: 10000, env: buildXtbEnv(engine) });
  return {
    ...template,
    available: true,
    installed: true,
    executable: engine.executable,
    installPath: engine.root,
    installMode: 'detected',
    version: extractVersion(`${versionResult.stdout}\n${versionResult.stderr}`),
    message: 'xTB is available for local semiempirical calculations.'
  };
}

async function getPyscfStatus() {
  const template = LOCAL_OPEN_SOURCE_ENGINES.pyscf;
  const configured = await resolveConfiguredPyscfPythonCommand();
  if (configured) {
    return {
      ...template,
      available: configured.probe.available,
      installed: configured.probe.available,
      installMode: 'configured',
      executable: configured.executable,
      installPath: configured.installPath,
      version: configured.probe.version,
      message: configured.probe.available
        ? 'Configured Python with PySCF is ready for local DFT/HF single-point calculations.'
        : `Configured Python was selected, but PySCF could not be imported. ${configured.probe.message}`
    };
  }

  const resolved = await resolvePyscfPythonCommand();

  if (resolved?.installMode === 'managed') {
    return {
      ...template,
      available: resolved.probe.available,
      installed: resolved.probe.available,
      executable: resolved.executable,
      installPath: resolved.installPath,
      version: resolved.probe.version,
      message: resolved.probe.available
        ? 'Managed PySCF environment is ready for local DFT/HF single-point calculations.'
        : `Managed PySCF environment was found, but PySCF could not be imported. ${resolved.probe.message}`
    };
  }

  if (resolved?.installMode === 'detected') {
    return {
      ...template,
      available: true,
      installed: true,
      installMode: 'detected',
      executable: resolved.executable,
      installPath: resolved.installPath,
      version: resolved.probe.version,
      message: 'System Python with PySCF is available for local DFT/HF single-point calculations.'
    };
  }

  return {
    ...template,
    available: false,
    installed: false,
    installPath: path.join(localEnginesRoot(), 'pyscf'),
    message: 'PySCF is not installed in ChemVault or on the current Python path.'
  };
}

async function resolvePyscfPythonCommand() {
  const configured = await resolveConfiguredPyscfPythonCommand();
  if (configured?.probe.available) {
    return configured;
  }

  const managedPython = pyscfPythonExecutable();
  if (isReadableFile(managedPython)) {
    const probe = await probePyscf(managedPython, []);
    return {
      executable: managedPython,
      argsPrefix: [],
      installMode: 'managed',
      installPath: path.dirname(path.dirname(managedPython)),
      probe
    };
  }

  const systemPython = await resolveSystemPython();
  if (!systemPython) return null;

  const probe = await probePyscf(systemPython.executable, systemPython.argsPrefix);
  if (!probe.available) return null;

  return {
    executable: systemPython.executable,
    argsPrefix: systemPython.argsPrefix,
    installMode: 'detected',
    installPath: path.dirname(systemPython.executable),
    probe
  };
}

async function resolveConfiguredPyscfPythonCommand() {
  const executable = configuredLocalEngineExecutable('pyscf');
  if (!executable) return null;

  const probe = await probePyscf(executable, []);
  return {
    executable,
    argsPrefix: [],
    installMode: 'configured',
    installPath: path.dirname(executable),
    probe
  };
}

async function getPsi4Status() {
  const template = LOCAL_OPEN_SOURCE_ENGINES.psi4;
  const configuredExecutable = configuredLocalEngineExecutable('psi4');
  const executable = configuredExecutable || discoverPsi4Executable();
  if (!executable) {
    return {
      ...template,
      available: false,
      installed: false,
      message: 'Psi4 was not found on PATH. Install it with Conda/Mamba and restart ChemVault Model.'
    };
  }

  const versionResult = await runProcess(executable, ['--version'], { timeoutMs: 10000 });
  const output = `${versionResult.stdout}\n${versionResult.stderr}`;
  return {
    ...template,
    available: versionResult.exitCode === 0,
    installed: versionResult.exitCode === 0,
    installMode: configuredExecutable ? 'configured' : 'detected',
    executable,
    installPath: path.dirname(executable),
    version: extractVersion(output),
    message: versionResult.exitCode === 0
      ? 'Psi4 was detected on PATH. Direct Psi4 job execution is reserved for the external engine bridge.'
      : 'Psi4 executable was found, but the version probe failed.'
  };
}

async function installLocalOpenSourceEngine(engineValue, onProgress = () => {}) {
  const engine = normalizeLocalOpenSourceEngineKind(engineValue);
  if (engine === 'pyscf') {
    return installPyscfEngine(onProgress);
  }

  const status = engine === 'xtb' ? await getXtbLocalStatus() : await getPsi4Status();
  const engineLabel = QUANTUM_ENGINE_LABELS[engine];
  emitInstallProgress(onProgress, engine, 'error', 100, `${engineLabel} requires a manual system installation.`);
  return {
    ok: false,
    engine,
    engineLabel,
    status,
    outputTail: '',
    error: `${engineLabel} requires a manual system installation. ${LOCAL_OPEN_SOURCE_ENGINES[engine].installCommand}`
  };
}

async function selectLocalOpenSourceEngineExecutable(engineValue) {
  const engine = normalizeLocalOpenSourceEngineKind(engineValue);
  const engineLabel = QUANTUM_ENGINE_LABELS[engine] || engine;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: engine === 'pyscf' ? 'Select Python executable with PySCF installed' : `Select ${engineLabel} executable`,
    properties: ['openFile'],
    filters: [
      {
        name: engine === 'pyscf' ? 'Python executable' : `${engineLabel} executable`,
        extensions: ['exe', 'bat', 'cmd']
      },
      { name: 'All files', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, canceled: true, engine, engineLabel };
  }

  const executablePath = result.filePaths[0];
  const configs = await readLocalEngineConfigs();
  configs[engine] = {
    engine,
    executablePath,
    selectedAt: new Date().toISOString()
  };
  const configPath = localEngineConfigPath();
  await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
  await fs.promises.writeFile(configPath, JSON.stringify(configs, null, 2), 'utf8');

  const status = engine === 'xtb'
    ? await getXtbLocalStatus()
    : engine === 'pyscf'
      ? await getPyscfStatus()
      : await getPsi4Status();

  return {
    ok: status.available,
    canceled: false,
    engine,
    engineLabel,
    executablePath,
    status,
    message: status.available
      ? `${engineLabel} was selected and verified.`
      : `${engineLabel} was selected, but ChemVault could not verify it yet.`
  };
}

async function installPyscfEngine(onProgress = () => {}) {
  const engine = 'pyscf';
  const engineLabel = QUANTUM_ENGINE_LABELS.pyscf;
  const venvDir = path.join(localEnginesRoot(), 'pyscf');
  const managedPython = pyscfPythonExecutable();
  const outputParts = [];
  emitInstallProgress(onProgress, engine, 'checking', 5, 'Checking Python 3 and existing PySCF environment.', undefined, {
    operation: 'Scanning PATH, configured Python paths, and the ChemVault managed engine folder.',
    targetPath: venvDir
  });
  const pythonCandidates = await resolvePyscfInstallPythonCandidates(onProgress);

  if (pythonCandidates.length === 0) {
    const status = await getPyscfStatus();
    emitInstallProgress(onProgress, engine, 'error', 100, 'Python 3 was not found. Install Python 3 or set CHEMVAULT_PYTHON_PATH.', undefined, {
      operation: 'Python discovery finished without a usable Python executable.',
      targetPath: localEnginesRoot()
    });
    return {
      ok: false,
      engine,
      engineLabel,
      status,
      outputTail: '',
      error: 'Python 3 was not found. Install Python 3 first, or set CHEMVAULT_PYTHON_PATH to python.exe.'
    };
  }

  await fs.promises.mkdir(localEnginesRoot(), { recursive: true });
  emitInstallProgress(onProgress, engine, 'creating-environment', 10, 'Prepared the ChemVault local engine folder.', undefined, {
    operation: 'Created or verified the local engine root folder.',
    targetPath: localEnginesRoot()
  });

  let lastInstallResult = null;
  let lastDiagnosis = null;
  let finalStatus = await getPyscfStatus();

  for (let index = 0; index < pythonCandidates.length; index += 1) {
    const python = pythonCandidates[index];
    const candidateLabel = pythonInstallCandidateLabel(python);
    const managedProbe = isReadableFile(managedPython)
      ? await probePythonForPyscfInstall({ executable: managedPython, argsPrefix: [] })
      : null;
    const shouldRebuild = index > 0 || shouldRebuildPyscfManagedEnvironment(managedProbe, python.probe);

    if (shouldRebuild) {
      await resetManagedPyscfEnvironment(
        venvDir,
        onProgress,
        outputParts,
        index > 0
          ? `Rebuilding the managed environment with ${candidateLabel}.`
          : 'Repair monitor is rebuilding the managed environment before retrying PySCF.'
      );
    }

    if (!isReadableFile(managedPython)) {
      emitInstallProgress(
        onProgress,
        engine,
        'creating-environment',
        15,
        `Creating the managed Python environment with ${candidateLabel}.`,
        outputTail(outputParts.join('\n')),
        {
          attempt: candidateLabel,
          operation: 'Preparing to create the managed PySCF virtual environment.',
          command: formatProcessCommand(python.executable, [...python.argsPrefix, '-m', 'venv', venvDir]),
          targetPath: venvDir,
          diagnosis: python.probe.summary,
          repairAction: 'Creating a clean private environment before installing PySCF.'
        }
      );
      const createResult = await runMonitoredPyscfInstallProcess(
        python.executable,
        [...python.argsPrefix, '-m', 'venv', venvDir],
        {
          onProgress,
          engine,
          phase: 'creating-environment',
          percent: 25,
          message: `Creating the managed Python environment with ${candidateLabel}.`,
          attempt: candidateLabel,
          operation: 'Creating the managed PySCF virtual environment.',
          targetPath: venvDir,
          timeoutMs: 180000
        }
      );
      outputParts.push(createResult.stdout, createResult.stderr);
      if (createResult.exitCode !== 0) {
        lastDiagnosis = diagnosePyscfInstallerOutput(combinedProcessOutput(createResult));
        if (index < pythonCandidates.length - 1) continue;

        const status = await getPyscfStatus();
        emitInstallProgress(
          onProgress,
          engine,
          'error',
          100,
          'Could not create the managed Python environment.',
          outputTail(outputParts.join('\n')),
          {
            attempt: candidateLabel,
            operation: 'Creating the managed PySCF virtual environment failed.',
            targetPath: venvDir,
            diagnosis: lastDiagnosis.summary,
            repairAction: lastDiagnosis.repairAction || 'Try installing Python from python.org, then run setup again.'
          }
        );
        return {
          ok: false,
          engine,
          engineLabel,
          status,
          outputTail: outputTail(outputParts.join('\n')),
          error: `Could not create the managed Python environment for PySCF. ${lastDiagnosis.summary}`
        };
      }
    }

    await repairPyscfPipTooling(managedPython, onProgress, outputParts, candidateLabel);
    lastInstallResult = await installPyscfPackageWithRepair(managedPython, onProgress, outputParts, candidateLabel);
    emitInstallProgress(onProgress, engine, 'verifying', 90, 'Verifying PySCF import from the managed environment.', outputTail(outputParts.join('\n')), {
      attempt: candidateLabel,
      operation: 'Running final PySCF import verification.',
      command: formatProcessCommand(managedPython, ['-c', 'import pyscf; print(pyscf.__version__)']),
      targetPath: managedPython
    });
    finalStatus = await getPyscfStatus();

    if (lastInstallResult.ok && finalStatus.available) {
      emitInstallProgress(
        onProgress,
        engine,
        'complete',
        100,
        'PySCF is ready for local DFT/HF calculations.',
        outputTail(outputParts.join('\n')),
        {
          attempt: candidateLabel,
          operation: 'Final PySCF verification completed successfully.',
          targetPath: managedPython,
          diagnosis: 'PySCF import verification passed.',
          repairAction: 'No further repair is required.'
        }
      );
      return {
        ok: true,
        engine,
        engineLabel,
        status: finalStatus,
        outputTail: outputTail(outputParts.join('\n'))
      };
    }

    lastDiagnosis = lastInstallResult.diagnosis || diagnosePyscfInstallerOutput(outputParts.join('\n'));
    if (!shouldTryAnotherPythonForPyscf(lastDiagnosis) || index === pythonCandidates.length - 1) {
      break;
    }

    emitInstallProgress(
      onProgress,
      engine,
      'installing-engine',
      82,
      'PySCF did not install cleanly with this Python. Trying another Python candidate.',
      outputTail(outputParts.join('\n')),
      {
        attempt: candidateLabel,
        operation: 'Preparing to retry with another Python candidate.',
        targetPath: venvDir,
        diagnosis: lastDiagnosis.summary,
        repairAction: 'The monitor will rebuild the environment with another Python version and retry.'
      }
    );
  }

  const status = finalStatus || await getPyscfStatus();
  const diagnosis = lastDiagnosis || diagnosePyscfInstallerOutput(outputParts.join('\n'));
  emitInstallProgress(
    onProgress,
    engine,
    'error',
    100,
    'PySCF installation did not complete.',
    outputTail(outputParts.join('\n')),
    {
      attempt: lastInstallResult?.attempt,
      operation: 'PySCF setup stopped after all automatic attempts finished.',
      targetPath: venvDir,
      diagnosis: diagnosis.summary,
      repairAction: diagnosis.repairAction || 'Use Configure Existing to select a Python environment where PySCF is already installed.'
    }
  );

  return {
    ok: false,
    engine,
    engineLabel,
    status,
    outputTail: outputTail(outputParts.join('\n')),
    error: `PySCF installation did not complete. ${diagnosis.summary}`
  };
}

async function repairPyscfPipTooling(managedPython, onProgress, outputParts, attempt) {
  const engine = 'pyscf';
  emitInstallProgress(
    onProgress,
    engine,
    'installing-dependencies',
    32,
    'Repair monitor is checking pip inside the managed environment.',
    outputTail(outputParts.join('\n')),
    {
      attempt,
      operation: 'Preparing pip bootstrap inside the managed PySCF environment.',
      command: formatProcessCommand(managedPython, ['-m', 'ensurepip', '--upgrade']),
      targetPath: managedPython,
      diagnosis: 'pip, wheel, setuptools, and packaging must be healthy before PySCF can be installed.',
      repairAction: 'Bootstrapping pip and upgrading installer tooling.'
    }
  );

  const ensurePip = await runMonitoredPyscfInstallProcess(
    managedPython,
    ['-m', 'ensurepip', '--upgrade'],
    {
      onProgress,
      engine,
      phase: 'installing-dependencies',
      percent: 38,
      message: 'Bootstrapping pip in the managed environment.',
      attempt,
      operation: 'Running ensurepip to create or upgrade pip.',
      targetPath: managedPython,
      timeoutMs: 180000
    }
  );
  outputParts.push(ensurePip.stdout, ensurePip.stderr);

  const pipUpgrade = await runMonitoredPyscfInstallProcess(
    managedPython,
    [
      '-m',
      'pip',
      'install',
      '--upgrade',
      '--retries',
      '5',
      '--timeout',
      String(PYSCF_PIP_TIMEOUT_SECONDS),
      'pip',
      'wheel',
      'setuptools',
      'packaging'
    ],
    {
      onProgress,
      engine,
      phase: 'installing-dependencies',
      percent: 50,
      message: 'Upgrading pip, wheel, setuptools, and packaging.',
      attempt,
      operation: 'Running pip upgrade for installer tooling.',
      targetPath: managedPython,
      timeoutMs: 600000
    }
  );
  outputParts.push(pipUpgrade.stdout, pipUpgrade.stderr);
}

async function installPyscfPackageWithRepair(managedPython, onProgress, outputParts, candidateLabel) {
  const engine = 'pyscf';
  const attempts = pyscfInstallAttempts();
  let lastDiagnosis = null;

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    if (attempt.preArgs) {
      const preflight = await runMonitoredPyscfInstallProcess(
        managedPython,
        attempt.preArgs,
        {
          onProgress,
          engine,
          phase: 'installing-engine',
          percent: Math.min(78, attempt.percent - 4),
          message: attempt.preMessage || 'Preparing the next PySCF repair attempt.',
          attempt: `${candidateLabel} / ${attempt.name}`,
          operation: `Running preflight command for ${attempt.name}.`,
          targetPath: managedPython,
          timeoutMs: 180000
        }
      );
      outputParts.push(preflight.stdout, preflight.stderr);
    }

    emitInstallProgress(
      onProgress,
      engine,
      'installing-engine',
      attempt.percent,
      attempt.message,
      outputTail(outputParts.join('\n')),
      {
        attempt: `${candidateLabel} / ${attempt.name}`,
        operation: `Preparing PySCF package command: ${attempt.name}.`,
        command: formatProcessCommand(managedPython, attempt.args),
        targetPath: managedPython,
        diagnosis: lastDiagnosis?.summary,
        repairAction: attempt.repairAction
      }
    );

    const result = await runMonitoredPyscfInstallProcess(
      managedPython,
      attempt.args,
      {
        onProgress,
        engine,
        phase: 'installing-engine',
        percent: attempt.percent,
        message: attempt.message,
        attempt: `${candidateLabel} / ${attempt.name}`,
        operation: `Running PySCF package command: ${attempt.name}.`,
        targetPath: managedPython,
        timeoutMs: PYSCF_INSTALL_TIMEOUT_MS
      }
    );
    outputParts.push(result.stdout, result.stderr);
    lastDiagnosis = diagnosePyscfInstallerOutput(combinedProcessOutput(result));

    emitInstallProgress(onProgress, engine, 'verifying', 88, 'Checking whether PySCF imports after this attempt.', outputTail(outputParts.join('\n')), {
      attempt: `${candidateLabel} / ${attempt.name}`,
      operation: `Verifying PySCF after ${attempt.name}.`,
      command: formatProcessCommand(managedPython, ['-c', 'import pyscf; print(pyscf.__version__)']),
      targetPath: managedPython,
      diagnosis: lastDiagnosis.summary,
      repairAction: 'Running import verification before deciding whether another repair attempt is needed.'
    });
    const probe = await probePyscf(managedPython, []);
    if (result.exitCode === 0 && probe.available) {
      return { ok: true, attempt: `${candidateLabel} / ${attempt.name}`, diagnosis: lastDiagnosis };
    }

    if (isTerminalPyscfInstallFailure(lastDiagnosis)) {
      break;
    }
  }

  return {
    ok: false,
    attempt: `${candidateLabel} / ${attempts.at(-1)?.name || 'install'}`,
    diagnosis: lastDiagnosis || diagnosePyscfInstallerOutput(outputParts.join('\n'))
  };
}

function pyscfInstallAttempts() {
  const configuredIndex = pipIndexArgs();
  const defaultRetryArgs = [
    '--upgrade',
    '--retries',
    '5',
    '--timeout',
    String(PYSCF_PIP_TIMEOUT_SECONDS)
  ];
  const attempts = [
    {
      name: 'standard install',
      percent: 62,
      message: 'Installing or updating PySCF with standard pip settings.',
      repairAction: 'Using pip with longer timeout and retry settings.',
      args: ['-m', 'pip', 'install', ...defaultRetryArgs, ...configuredIndex, 'pyscf']
    },
    {
      name: 'binary wheel repair',
      percent: 72,
      message: 'Retrying PySCF with binary wheels only.',
      repairAction: 'Avoiding source builds that commonly fail on Windows without compiler tooling.',
      args: ['-m', 'pip', 'install', ...defaultRetryArgs, '--only-binary=:all:', '--prefer-binary', ...configuredIndex, 'pyscf']
    },
    {
      name: 'clean cache repair',
      percent: 80,
      message: 'Clearing pip cache and retrying PySCF.',
      preMessage: 'Clearing pip cache before retrying PySCF.',
      repairAction: 'Removing partial downloads and forcing a clean package fetch.',
      preArgs: ['-m', 'pip', 'cache', 'purge'],
      args: ['-m', 'pip', 'install', ...defaultRetryArgs, '--no-cache-dir', '--prefer-binary', ...configuredIndex, 'pyscf']
    }
  ];

  if (configuredIndex.length === 0) {
    attempts.push({
      name: 'alternate HTTPS index repair',
      percent: 86,
      message: 'Retrying PySCF through an alternate HTTPS package index.',
      repairAction: 'Using a regional HTTPS mirror when the default PyPI connection is unstable.',
      args: [
        '-m',
        'pip',
        'install',
        ...defaultRetryArgs,
        '--prefer-binary',
        '--index-url',
        'https://pypi.tuna.tsinghua.edu.cn/simple',
        '--trusted-host',
        'pypi.tuna.tsinghua.edu.cn',
        'pyscf'
      ]
    });
  }

  return attempts;
}

async function runMonitoredPyscfInstallProcess(executable, args, options) {
  const command = formatProcessCommand(executable, args);
  emitInstallProgress(
    options.onProgress,
    options.engine,
    options.phase,
    options.percent,
    options.message,
    undefined,
    {
      attempt: options.attempt,
      command,
      cwd: options.cwd,
      operation: options.operation || 'Starting external process.',
      targetPath: options.targetPath || executable
    }
  );
  return runProcessWithProgress(executable, args, {
    cwd: options.cwd,
    timeoutMs: options.timeoutMs,
    progress: (output) => {
      const diagnosis = diagnosePyscfInstallerOutput(output);
      emitInstallProgress(
        options.onProgress,
        options.engine,
        options.phase,
        options.percent,
        options.message,
        output,
        {
          attempt: options.attempt,
          command,
          cwd: options.cwd,
          diagnosis: diagnosis.summary,
          operation: options.operation || 'External process is running and streaming output.',
          targetPath: options.targetPath || executable,
          repairAction: diagnosis.repairAction
        }
      );
    }
  });
}

async function resetManagedPyscfEnvironment(venvDir, onProgress, outputParts, reason) {
  const engine = 'pyscf';
  emitInstallProgress(
    onProgress,
    engine,
    'creating-environment',
    12,
    reason,
    outputTail(outputParts.join('\n')),
    {
      operation: 'Preparing to remove the existing ChemVault managed PySCF environment.',
      targetPath: venvDir,
      diagnosis: 'The existing managed environment is missing, incompatible, or failed verification.',
      repairAction: 'Removing only ChemVault managed PySCF files and recreating the environment.'
    }
  );

  const root = path.resolve(localEnginesRoot());
  const target = path.resolve(venvDir);
  if (!isPathInside(target, root)) {
    throw new Error('Refusing to reset a managed engine path outside the ChemVault engine folder.');
  }
  await fs.promises.rm(target, { recursive: true, force: true });
  emitInstallProgress(onProgress, engine, 'creating-environment', 14, 'Removed the previous managed PySCF environment.', outputTail(outputParts.join('\n')), {
    operation: 'Deleted the old managed PySCF folder after path safety verification.',
    targetPath: target
  });
}

function shouldRebuildPyscfManagedEnvironment(managedProbe, selectedProbe) {
  if (!managedProbe) return false;
  if (!managedProbe.available) return true;
  if (isRecommendedPyscfPythonProbe(managedProbe)) return false;
  return isRecommendedPyscfPythonProbe(selectedProbe);
}

function isPathInside(target, root) {
  const relative = path.relative(root, target);
  return relative === '' || Boolean(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function pipIndexArgs() {
  const configured = String(process.env.CHEMVAULT_PIP_INDEX_URL || process.env.PIP_INDEX_URL || '').trim();
  return configured ? ['--index-url', configured] : [];
}

function combinedProcessOutput(result) {
  return `${result?.stdout || ''}\n${result?.stderr || ''}`;
}

function formatProcessCommand(executable, args = []) {
  return [executable, ...args].map((part) => quoteCommandPart(part)).join(' ');
}

function quoteCommandPart(value) {
  const text = String(value ?? '');
  if (!text) return '""';
  return /[\s"]/u.test(text) ? `"${text.replace(/"/gu, '\\"')}"` : text;
}

function decodeTextBuffer(buffer) {
  if (!buffer || buffer.length === 0) return '';

  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return TEXT_DECODERS.utf16le.decode(buffer);
  }

  if (looksLikeUtf16Le(buffer)) {
    return TEXT_DECODERS.utf16le.decode(buffer);
  }

  const utf8 = TEXT_DECODERS.utf8.decode(buffer);
  if (!utf8.includes('\uFFFD')) return utf8;

  const gb18030 = TEXT_DECODERS.gb18030.decode(buffer);
  return replacementCount(gb18030) < replacementCount(utf8) ? gb18030 : utf8;
}

function looksLikeUtf16Le(buffer) {
  if (buffer.length < 8) return false;
  const sampleLength = Math.min(buffer.length, 256);
  let oddNulls = 0;
  let evenNulls = 0;
  for (let index = 0; index < sampleLength; index += 1) {
    if (buffer[index] !== 0) continue;
    if (index % 2 === 0) evenNulls += 1;
    else oddNulls += 1;
  }
  return oddNulls > sampleLength / 5 && evenNulls < sampleLength / 20;
}

function replacementCount(value) {
  return (String(value).match(/\uFFFD/gu) || []).length;
}

async function runGaussianJob(executablePath, job, workDir, timeoutMs, onOutput = () => {}, jobId = '', runtime = {}) {
  const env = buildGaussianEnv(executablePath, workDir, runtime.scratchDirectory);
  const readProgress = createIncrementalFileReader(job.outputPath, GAUSSIAN_LOG_PROGRESS_CHUNK_BYTES);
  let pollInFlight = false;
  const pollOutput = setInterval(async () => {
    if (pollInFlight) return;
    pollInFlight = true;
    try {
      const fileOutput = await readProgress();
      if (fileOutput) onOutput(outputTail(fileOutput));
    } finally {
      pollInFlight = false;
    }
  }, GAUSSIAN_LOG_POLL_INTERVAL_MS);

  if (process.platform === 'win32') {
    try {
      return await runProcessWithProgress(executablePath, [job.inputPath, job.outputPath], {
        cwd: workDir,
        timeoutMs,
        env,
        jobId,
        progress: onOutput
      });
    } finally {
      clearInterval(pollOutput);
      const fileOutput = await readProgress();
      if (fileOutput) onOutput(outputTail(fileOutput));
    }
  }

  try {
    return await runProcessWithProgress(executablePath, job.args, {
      cwd: workDir,
      timeoutMs,
      env,
      jobId,
      progress: onOutput
    });
  } finally {
    clearInterval(pollOutput);
    const fileOutput = await readProgress();
    if (fileOutput) onOutput(outputTail(fileOutput));
  }
}

function createIncrementalFileReader(filePath, maxChunkBytes) {
  let position = 0;
  const chunkLimit = Math.max(4096, Number(maxChunkBytes) || GAUSSIAN_LOG_PROGRESS_CHUNK_BYTES);

  return async () => {
    try {
      const stat = await fs.promises.stat(filePath);
      if (!stat.isFile() || stat.size <= 0) return '';
      if (stat.size < position) position = 0;
      const unreadBytes = stat.size - position;
      if (unreadBytes <= 0) return '';

      const bytesToRead = Math.min(unreadBytes, chunkLimit);
      const start = unreadBytes > chunkLimit ? stat.size - chunkLimit : position;
      const handle = await fs.promises.open(filePath, 'r');
      try {
        const buffer = Buffer.alloc(bytesToRead);
        const { bytesRead } = await handle.read(buffer, 0, bytesToRead, start);
        position = start + bytesRead;
        return bytesRead > 0 ? decodeTextBuffer(buffer.subarray(0, bytesRead)) : '';
      } finally {
        await handle.close();
      }
    } catch {
      return '';
    }
  };
}

function buildExternalEngineEnv(engineKind, executablePath, workDir) {
  if (engineKind === 'gaussian') return buildGaussianEnv(executablePath, workDir);
  return {
    ...process.env,
    PATH: uniquePathEntries([path.dirname(executablePath), process.env.PATH || '']).join(path.delimiter)
  };
}

function buildGaussianEnv(executablePath, workDir, requestedScratchDirectory = '') {
  const executableDir = path.dirname(executablePath);
  const installRoot = gaussianInstallRoot(executableDir);
  const scratchDir = String(requestedScratchDirectory || '').trim() || path.join(workDir, 'gaussian-scratch');
  fs.mkdirSync(scratchDir, { recursive: true });

  const pathEntries = [
    executableDir,
    path.join(executableDir, 'wbin'),
    path.join(executableDir, 'bin'),
    path.join(installRoot, 'g16'),
    path.join(installRoot, 'g16w'),
    process.env.PATH || ''
  ];

  return {
    ...process.env,
    GAUSS_EXEDIR: process.env.GAUSS_EXEDIR || executableDir,
    GAUSS_SCRDIR: process.env.GAUSS_SCRDIR || scratchDir,
    G16ROOT: process.env.G16ROOT || installRoot,
    GAUSS_ARCHDIR: process.env.GAUSS_ARCHDIR || executableDir,
    PATH: uniquePathEntries(pathEntries).join(path.delimiter)
  };
}

function gaussianInstallRoot(executableDir) {
  const base = path.basename(executableDir).toLowerCase();
  if (/^g\d{2}w?$/u.test(base)) return path.dirname(executableDir);
  const parent = path.dirname(executableDir);
  const parentBase = path.basename(parent).toLowerCase();
  if (/^g\d{2}w?$/u.test(parentBase)) return path.dirname(parent);
  return executableDir;
}

function uniquePathEntries(entries) {
  const seen = new Set();
  const output = [];
  for (const entry of entries.flatMap((value) => String(value || '').split(path.delimiter))) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const key = process.platform === 'win32' ? trimmed.toLowerCase() : trimmed;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(trimmed);
  }
  return output;
}

function diagnoseExternalEngineFailure(engineKind, processResult, output, config) {
  const engineLabel = QUANTUM_ENGINE_LABELS[engineKind] || 'External engine';
  const text = String(output || `${processResult.stdout || ''}\n${processResult.stderr || ''}`).trim();
  const executablePath = config?.executablePath || '';
  const executableDir = executablePath ? path.dirname(executablePath) : '';

  if (processResult.cancelled) {
    return `${engineLabel} calculation was cancelled by the user. Partial output may still be available in the calculation log.`;
  }

  if (processResult.timedOut) {
    return `${engineLabel} reached the configured runtime limit before normal termination. Partial output is available; retry the task or screen a smaller structure first.`;
  }

  if (engineKind === 'gaussian') {
    const gaussianError = summarizeGaussianError(text);
    if (gaussianError) return `Gaussian stopped before completion. ${gaussianError}`;
    if (processResult.exitCode === 0 && !/Normal termination of Gaussian/iu.test(text)) {
      return 'Gaussian process ended, but the output log did not contain a normal termination marker. Re-run the calculation and inspect the calculation log for the last Gaussian link message.';
    }
  }

  if (engineKind === 'gaussian' && processResult.exitCode === 127) {
    return [
      'Gaussian exited with code 127, which usually means the executable started without the required Gaussian runtime environment.',
      `ChemVault now launches it with Gaussian environment variables; if this still appears, choose the real Gaussian command executable from the install folder, for example ${path.join('C:\\', 'G16W', 'g16.exe')}, and confirm it runs from Command Prompt.`,
      executableDir ? `Configured folder: ${executableDir}` : ''
    ].filter(Boolean).join(' ');
  }

  if (engineKind === 'gaussian' && /link 0|l1\.exe|l\d+\.exe|cannot open|No such file|not recognized|unable to open|failed to locate/iu.test(text)) {
    return `${engineLabel} could not find required Gaussian link executables or files. Check that GAUSS_EXEDIR points to the Gaussian install folder and that the selected executable belongs to the same installation.`;
  }

  if (/license|licensed|permission|access denied|denied/iu.test(text)) {
    return `${engineLabel} started but reported a license or permission problem. Check the local installation license and run permissions.`;
  }

  if (/No such file|not found|not recognized|cannot find|ENOENT/iu.test(text)) {
    return `${engineLabel} could not start from the configured path. Re-select the installed executable and save the port again.`;
  }

  return `${engineLabel} exited with code ${processResult.exitCode}.`;
}

function summarizeGaussianError(output) {
  return gaussianParsers.summarizeGaussianLogError(output);
}

async function openLocalEngineFolder() {
  const root = localEnginesRoot();
  await fs.promises.mkdir(root, { recursive: true });
  const error = await shell.openPath(root);
  return { ok: !error, path: root, error: error || undefined };
}

async function readEngineSetupRequest() {
  try {
    const content = await fs.promises.readFile(engineSetupRequestPath(), 'utf8');
    const parsed = JSON.parse(content);
    const engines = Array.isArray(parsed?.engines)
      ? parsed.engines.map(normalizeLocalOpenSourceEngineKind).filter((engine, index, list) => list.indexOf(engine) === index)
      : [];
    return {
      pending: engines.length > 0,
      engines,
      source: parsed?.source === 'installer' ? 'installer' : 'application',
      message: typeof parsed?.message === 'string' ? parsed.message : undefined
    };
  } catch {
    return { pending: false, engines: [] };
  }
}

async function clearEngineSetupRequest() {
  await fs.promises.rm(engineSetupRequestPath(), { force: true }).catch(() => {});
  return { ok: true };
}

async function runPyscfCalculation(request, onProgress = () => {}) {
  const startedAt = Date.now();
  emitCalculationProgress(onProgress, 'pyscf', 'preparing', 4, 'Preparing PySCF calculation request.', undefined, startedAt);
  const calculationMode = normalizeCalculationMode(request?.calculationMode);
  const method = sanitizeQuantumToken(request?.method) || 'B3LYP';
  const basisSet = sanitizeQuantumToken(request?.basisSet) || '6-31G';
  const calculationId = normalizeCalculationId(request?.calculationId);
  const baseResult = {
    ok: false,
    engine: 'pyscf',
    engineLabel: QUANTUM_ENGINE_LABELS.pyscf,
    method: `${method}/${basisSet}`,
    calculationMode,
    energyHartree: null,
    dipoleDebye: null,
    charges: [],
    chargeModel: 'PySCF Mulliken population analysis',
    elapsedMs: 0,
    warnings: [],
    outputTail: '',
    outputLog: ''
  };

  if (calculationMode !== 'single-point') {
    emitCalculationProgress(onProgress, 'pyscf', 'error', 100, 'PySCF geometry optimization is not available in this runner.', undefined, startedAt);
    return {
      ...baseResult,
      elapsedMs: Date.now() - startedAt,
      error: 'The managed PySCF runner currently supports single-point DFT/HF analysis. Use xTB or an external engine for geometry optimization.'
    };
  }

  emitCalculationProgress(onProgress, 'pyscf', 'checking-engine', 8, 'Checking local PySCF Python environment.', undefined, startedAt);
  const pyscfCommand = await resolvePyscfPythonCommand();
  if (!pyscfCommand?.probe.available) {
    emitCalculationProgress(onProgress, 'pyscf', 'error', 100, 'PySCF is not installed.', undefined, startedAt);
    return {
      ...baseResult,
      elapsedMs: Date.now() - startedAt,
      error: 'PySCF is not installed. Install it from the Local Open-Source Engine Manager before running this engine.'
    };
  }

  const xyz = normalizeQuantumInput(request?.xyz);
  if (!xyz) {
    emitCalculationProgress(onProgress, 'pyscf', 'error', 100, 'A valid 3D XYZ structure is required before running PySCF.', undefined, startedAt);
    return {
      ...baseResult,
      elapsedMs: Date.now() - startedAt,
      error: 'A valid 3D XYZ structure is required before running PySCF.'
    };
  }

  const charge = boundedInteger(request?.charge, 0, -20, 20);
  const unpairedElectrons = boundedInteger(request?.unpairedElectrons, 0, 0, 20);
  const timeoutMs = boundedInteger(request?.timeoutMs, 600000, 30000, 3600000);
  const workDir = await fs.promises.mkdtemp(path.join(app.getPath('temp'), 'chemvault-pyscf-'));
  const inputPath = path.join(workDir, 'input.json');
  const scriptPath = path.join(workDir, 'chemvault_pyscf_job.py');

  try {
    emitCalculationProgress(onProgress, 'pyscf', 'writing-input', 20, 'Writing PySCF input payload and runner script.', undefined, startedAt);
    await fs.promises.writeFile(
      inputPath,
      JSON.stringify({
        atoms: parseXyzGeometry(xyz),
        charge,
        spin: unpairedElectrons,
        method,
        basisSet
      }),
      'utf8'
    );
    await fs.promises.writeFile(scriptPath, pyscfJobScript(), 'utf8');

    emitCalculationProgress(onProgress, 'pyscf', 'starting-engine', 30, 'Starting PySCF calculation process.', undefined, startedAt);
    const runStartedAt = Date.now();
    const processResult = await runProcessWithProgress(pyscfCommand.executable, [...pyscfCommand.argsPrefix, scriptPath, inputPath], {
      cwd: workDir,
      timeoutMs,
      env: {
        ...process.env,
        PYTHONUTF8: '1'
      },
      jobId: calculationId,
      progress: (output) => emitCalculationProgress(
        onProgress,
        'pyscf',
        'running-engine',
        estimateProgress(runStartedAt, timeoutMs, 34, 84),
        'PySCF is running the DFT/HF calculation.',
        output,
        startedAt
      )
    });
    const output = `${processResult.stdout}\n${processResult.stderr}`.trim();
    emitCalculationProgress(onProgress, 'pyscf', 'parsing-output', 92, 'Parsing PySCF JSON result, dipole, and Mulliken charges.', outputTail(output), startedAt);
    const parsed = parsePyscfResult(output);
    const warnings = [...(parsed?.warnings || [])];

    if (processResult.timedOut) warnings.push('PySCF calculation timed out before completion.');
    if (processResult.cancelled) warnings.push('PySCF calculation was cancelled before completion.');
    if (!parsed) warnings.push('PySCF result JSON was not found in the calculation output.');
    if (parsed && parsed.energyHartree === null) warnings.push('Total energy was not found in the PySCF output.');
    if (parsed && !parsed.dipoleDebye) warnings.push('Dipole moment was not returned by PySCF.');
    if (parsed && parsed.charges.length === 0) warnings.push('Mulliken charges were not returned by PySCF.');

    const result = {
      ok: processResult.exitCode === 0 && Boolean(parsed) && !processResult.cancelled,
      cancelled: processResult.cancelled || undefined,
      engine: 'pyscf',
      engineLabel: QUANTUM_ENGINE_LABELS.pyscf,
      method: parsed?.method || `${method}/${basisSet}`,
      calculationMode,
      energyHartree: parsed?.energyHartree ?? null,
      dipoleDebye: parsed?.dipoleDebye ?? null,
      charges: parsed?.charges ?? [],
      chargeModel: 'PySCF Mulliken population analysis',
      elapsedMs: Date.now() - startedAt,
      warnings,
      outputTail: outputTail(output),
      outputLog: output,
      error: processResult.cancelled ? 'PySCF calculation was cancelled by the user.' : processResult.exitCode === 0 && parsed ? undefined : `PySCF exited with code ${processResult.exitCode}.`
    };
    emitCalculationProgress(
      onProgress,
      'pyscf',
      result.ok ? 'complete' : 'error',
      100,
      result.ok ? 'PySCF calculation completed.' : result.error,
      result.outputTail,
      startedAt
    );
    return result;
  } catch (error) {
    emitCalculationProgress(
      onProgress,
      'pyscf',
      'error',
      100,
      error instanceof Error ? error.message : 'PySCF calculation failed.',
      undefined,
      startedAt
    );
    return {
      ...baseResult,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'PySCF calculation failed.'
    };
  } finally {
    await fs.promises.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function resolveXtbEngine() {
  const envCandidate = normalizeExecutableCandidate(process.env.CHEMVAULT_XTB_PATH, 'environment');
  const configuredCandidate = normalizeExecutableCandidate(configuredLocalEngineExecutable('xtb'), 'configured');
  const candidates = [
    envCandidate,
    configuredCandidate,
    ...bundledXtbCandidates(),
    ...pathXtbCandidates()
  ].filter(Boolean);

  return candidates.find((candidate) => candidate && isReadableFile(candidate.executable)) || null;
}

function bundledXtbCandidates() {
  const roots = [
    path.join(process.resourcesPath || '', 'quantum'),
    path.join(app.getAppPath(), 'quantum'),
    path.join(app.getAppPath(), 'desktop', 'quantum')
  ];
  return roots.flatMap((root) => candidateExecutables(root, 'bundled'));
}

function pathXtbCandidates() {
  const names = process.platform === 'win32' ? ['xtb.exe', 'xtb.cmd', 'xtb.bat'] : ['xtb'];
  const pathCandidates = String(process.env.PATH || '')
    .split(path.delimiter)
    .flatMap((directory) => names.map((name) => ({ executable: path.join(directory, name), root: directory, source: 'path' })));
  const discoveredCandidates = xtbDiscoveryRoots()
    .flatMap((directory) => names.flatMap((name) => [
      { executable: path.join(directory, name), root: directory, source: 'discovered' },
      { executable: path.join(directory, 'bin', name), root: directory, source: 'discovered' }
    ]));

  return [...pathCandidates, ...discoveredCandidates];
}

function normalizeExecutableCandidate(value, source) {
  if (!value) return null;
  const trimmed = String(value).trim().replace(/^["']|["']$/gu, '');
  if (!trimmed) return null;

  if (isReadableFile(trimmed)) {
    return { executable: trimmed, root: path.dirname(trimmed), source };
  }

  const executableName = process.platform === 'win32' ? 'xtb.exe' : 'xtb';
  const direct = path.join(trimmed, executableName);
  if (isReadableFile(direct)) return { executable: direct, root: trimmed, source };

  const nested = path.join(trimmed, 'bin', executableName);
  return isReadableFile(nested) ? { executable: nested, root: trimmed, source } : { executable: direct, root: trimmed, source };
}

function candidateExecutables(root, source) {
  const executableName = process.platform === 'win32' ? 'xtb.exe' : 'xtb';
  return [
    { executable: path.join(root, executableName), root, source },
    { executable: path.join(root, 'xtb', executableName), root: path.join(root, 'xtb'), source },
    { executable: path.join(root, 'xtb', 'bin', executableName), root: path.join(root, 'xtb'), source }
  ];
}

function buildXtbArgs(inputPath, charge, unpairedElectrons, calculationMode) {
  const args = [inputPath, '--gfn', '2', '--chrg', String(charge), '--uhf', String(unpairedElectrons)];
  if (calculationMode === 'geometry-optimization') {
    args.push('--opt');
  }
  return args;
}

function buildXtbEnv(engine) {
  const binDir = path.dirname(engine.executable);
  const pathEntries = [binDir, engine.root].filter(Boolean);
  return {
    ...process.env,
    PATH: [...pathEntries, process.env.PATH || ''].join(path.delimiter),
    XTBPATH: process.env.XTBPATH || engine.root,
    OMP_NUM_THREADS: process.env.OMP_NUM_THREADS || '4'
  };
}

async function getExternalQuantumConfig(engineValue) {
  const engine = normalizeExternalEngineKind(engineValue);
  const configs = await readExternalEngineConfigs();
  const savedConfig = configs[engine] || {};
  const discoveredPath = savedConfig.executablePath ? '' : discoverExternalEngineExecutable(engine);
  return normalizeExternalEngineConfig({
    ...DEFAULT_EXTERNAL_ENGINE_CONFIG[engine],
    ...savedConfig,
    ...(discoveredPath ? { executablePath: discoveredPath, discovered: true } : {})
  });
}

async function saveExternalQuantumConfig(config) {
  const normalized = normalizeExternalEngineConfig(config);
  const configs = await readExternalEngineConfigs();
  configs[normalized.engine] = normalized;
  const configPath = externalEngineConfigPath();
  await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
  await fs.promises.writeFile(configPath, JSON.stringify(configs, null, 2), 'utf8');
  return normalized;
}

async function discoverAndSaveExternalQuantumConfig(engineValue) {
  const engine = normalizeExternalEngineKind(engineValue);
  const discoveredPath = discoverExternalEngineExecutable(engine);
  const current = await getExternalQuantumConfig(engine);
  const nextConfig = normalizeExternalEngineConfig({
    ...current,
    executablePath: discoveredPath || current.executablePath,
    discovered: Boolean(discoveredPath)
  });

  if (discoveredPath) {
    await saveExternalQuantumConfig(nextConfig);
  }

  return {
    config: nextConfig,
    found: Boolean(discoveredPath),
    message: discoveredPath
      ? `${QUANTUM_ENGINE_LABELS[engine]} was found and saved.`
      : `${QUANTUM_ENGINE_LABELS[engine]} was not found in common Windows locations or PATH.`
  };
}

async function selectQuantumEngineExecutable(engineValue) {
  const engine = normalizeExternalEngineKind(engineValue);
  const engineLabel = QUANTUM_ENGINE_LABELS[engine] || 'External engine';
  const result = await dialog.showOpenDialog(mainWindow, {
    title: `Select ${engineLabel} executable`,
    properties: ['openFile'],
    filters: [
      { name: `${engineLabel} executable`, extensions: ['exe', 'bat', 'cmd'] },
      { name: 'All files', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}

async function selectGaussianScratchDirectory() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Gaussian scratch directory',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
}

async function getGaussianBridgeTools() {
  const config = await getExternalQuantumConfig('gaussian');
  const formchkPath = resolveGaussianTool('formchk', config.executablePath);
  const cubegenPath = resolveGaussianTool('cubegen', config.executablePath);
  const gaussViewPath = resolveGaussianTool('gaussview', config.executablePath);

  return {
    formchk: gaussianToolStatus('formchk', formchkPath),
    cubegen: gaussianToolStatus('cubegen', cubegenPath),
    gaussView: gaussianToolStatus('GaussView', gaussViewPath)
  };
}

async function runGaussianFormchk(request) {
  const config = await getExternalQuantumConfig('gaussian');
  const toolPath = resolveGaussianTool('formchk', config.executablePath);
  if (!toolPath) {
    return {
      ok: false,
      outputTail: '',
      error: 'Gaussian formchk was not found. Confirm Gaussian is installed and that formchk is available next to g16.exe or on PATH.'
    };
  }

  const workDir = await fs.promises.mkdtemp(path.join(app.getPath('temp'), 'chemvault-gaussian-formchk-'));
  try {
    const fileBase = bridgeFileBaseName(request?.fileBaseName || 'chemvault_gaussian');
    const chkPath = path.join(workDir, `${fileBase}.chk`);
    const fchkPath = path.join(workDir, `${fileBase}.fchk`);
    await writeBase64File(chkPath, request?.checkpointBase64, 'Gaussian checkpoint data is required before formchk can run.');
    const processResult = await runProcess(toolPath, [chkPath, fchkPath], {
      cwd: workDir,
      timeoutMs: 180000,
      env: buildGaussianEnv(config.executablePath || toolPath, workDir)
    });
    const output = `${processResult.stdout}\n${processResult.stderr}`.trim();
    if (processResult.exitCode !== 0 || !isReadableFile(fchkPath)) {
      return {
        ok: false,
        outputTail: outputTail(output),
        toolPath,
        error: outputTail(output) || `formchk exited with code ${processResult.exitCode}.`
      };
    }

    const attachment = await readBridgeAttachment(fchkPath, 'chemical/x-gaussian-formatted-checkpoint');
    return {
      ok: Boolean(attachment),
      attachment,
      outputTail: outputTail(output) || 'formchk completed and generated a formatted checkpoint file.',
      toolPath,
      error: attachment ? undefined : 'The formatted checkpoint file was too large to return to the app.'
    };
  } catch (error) {
    return {
      ok: false,
      outputTail: '',
      toolPath,
      error: error instanceof Error ? error.message : 'formchk failed.'
    };
  } finally {
    await fs.promises.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function runGaussianCubegen(request) {
  const config = await getExternalQuantumConfig('gaussian');
  const formchkPath = resolveGaussianTool('formchk', config.executablePath);
  const cubegenPath = resolveGaussianTool('cubegen', config.executablePath);
  if (!cubegenPath) {
    return {
      ok: false,
      outputTail: '',
      error: 'Gaussian cubegen was not found. Confirm Gaussian is installed and that cubegen is available next to g16.exe or on PATH.'
    };
  }
  if (!formchkPath && !request?.formattedCheckpointBase64) {
    return {
      ok: false,
      outputTail: '',
      toolPath: cubegenPath,
      error: 'A formatted checkpoint is required for cubegen. formchk was not found, so ChemVault could not create one automatically.'
    };
  }

  const workDir = await fs.promises.mkdtemp(path.join(app.getPath('temp'), 'chemvault-gaussian-cubegen-'));
  try {
    const fileBase = bridgeFileBaseName(request?.fileBaseName || 'chemvault_gaussian');
    const fchkPath = path.join(workDir, `${fileBase}.fchk`);
    const cubePath = path.join(workDir, `${fileBase}.cube`);
    const outputParts = [];
    const env = buildGaussianEnv(config.executablePath || cubegenPath, workDir);

    if (request?.formattedCheckpointBase64) {
      await writeBase64File(fchkPath, request.formattedCheckpointBase64, 'Formatted checkpoint data was empty.');
    } else {
      const chkPath = path.join(workDir, `${fileBase}.chk`);
      await writeBase64File(chkPath, request?.checkpointBase64, 'Gaussian checkpoint data is required before cubegen can run.');
      const formchkResult = await runProcess(formchkPath, [chkPath, fchkPath], {
        cwd: workDir,
        timeoutMs: 180000,
        env
      });
      outputParts.push(`${formchkResult.stdout}\n${formchkResult.stderr}`.trim());
      if (formchkResult.exitCode !== 0 || !isReadableFile(fchkPath)) {
        const output = outputParts.filter(Boolean).join('\n');
        return {
          ok: false,
          outputTail: outputTail(output),
          toolPath: cubegenPath,
          error: outputTail(output) || `formchk exited with code ${formchkResult.exitCode}.`
        };
      }
    }

    const kind = sanitizeCubegenKind(request?.cubeKind || 'density=scf');
    const cubegenResult = await runProcess(cubegenPath, ['0', kind, fchkPath, cubePath, '0', 'h'], {
      cwd: workDir,
      timeoutMs: 300000,
      env
    });
    outputParts.push(`${cubegenResult.stdout}\n${cubegenResult.stderr}`.trim());
    const output = outputParts.filter(Boolean).join('\n');
    if (cubegenResult.exitCode !== 0 || !isReadableFile(cubePath)) {
      return {
        ok: false,
        outputTail: outputTail(output),
        toolPath: cubegenPath,
        error: outputTail(output) || `cubegen exited with code ${cubegenResult.exitCode}.`
      };
    }

    const attachment = await readBridgeAttachment(cubePath, 'chemical/x-cube');
    return {
      ok: Boolean(attachment),
      attachment,
      outputTail: outputTail(output) || `cubegen completed with kind ${kind}.`,
      toolPath: cubegenPath,
      error: attachment ? undefined : 'The cube file was too large to return to the app.'
    };
  } catch (error) {
    return {
      ok: false,
      outputTail: '',
      toolPath: cubegenPath,
      error: error instanceof Error ? error.message : 'cubegen failed.'
    };
  } finally {
    await fs.promises.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function openGaussianInGaussView(request) {
  const config = await getExternalQuantumConfig('gaussian');
  const tools = await getGaussianBridgeTools();
  const fileBase = bridgeFileBaseName(request?.fileBaseName || 'chemvault_gaussian');
  const directory = path.join(app.getPath('userData'), 'gaussian-bridge', `${fileBase}-${Date.now()}`);
  await fs.promises.mkdir(directory, { recursive: true });

  const files = [];
  if (request?.inputText) {
    const inputPath = path.join(directory, `${fileBase}.gjf`);
    await fs.promises.writeFile(inputPath, request.inputText, 'utf8');
    files.push(inputPath);
  }
  if (request?.outputText) {
    const outputPath = path.join(directory, `${fileBase}.txt`);
    await fs.promises.writeFile(outputPath, request.outputText, 'utf8');
    files.push(outputPath);
  }
  if (request?.checkpointBase64) {
    const checkpointPath = path.join(directory, `${fileBase}.chk`);
    await writeBase64File(checkpointPath, request.checkpointBase64, 'Checkpoint data was empty.');
    files.push(checkpointPath);
  }
  if (request?.formattedCheckpointBase64) {
    const fchkPath = path.join(directory, `${fileBase}.fchk`);
    await writeBase64File(fchkPath, request.formattedCheckpointBase64, 'Formatted checkpoint data was empty.');
    files.push(fchkPath);
  }

  const primary = files.find((filePath) => /\.(fchk|chk|gjf)$/iu.test(filePath)) || files[0] || directory;
  const gaussViewPath = tools.gaussView.path;
  if (gaussViewPath) {
    try {
      const child = spawn(gaussViewPath, primary && primary !== directory ? [primary] : [], {
        cwd: directory,
        env: buildGaussianEnv(config.executablePath || gaussViewPath, directory),
        detached: true,
        windowsHide: false,
        shell: process.platform === 'win32' && /\.(cmd|bat)$/iu.test(gaussViewPath)
      });
      child.unref();
      return {
        ok: true,
        directory,
        openedWith: gaussViewPath,
        message: 'GaussView was opened with the exported Gaussian bridge files.'
      };
    } catch (error) {
      await shell.openPath(directory);
      return {
        ok: false,
        directory,
        openedWith: gaussViewPath,
        message: 'The bridge folder was opened because GaussView could not be started.',
        error: error instanceof Error ? error.message : 'GaussView could not be started.'
      };
    }
  }

  await shell.openPath(directory);
  return {
    ok: false,
    directory,
    message: 'GaussView was not found. ChemVault opened the Gaussian bridge folder instead.',
    error: 'GaussView executable was not found in common Gaussian locations or PATH.'
  };
}

async function readExternalEngineConfigs() {
  try {
    const content = await fs.promises.readFile(externalEngineConfigPath(), 'utf8');
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function externalEngineConfigPath() {
  return path.join(app.getPath('userData'), EXTERNAL_ENGINE_CONFIG_FILE);
}

function localEngineConfigPath() {
  return path.join(app.getPath('userData'), LOCAL_ENGINE_CONFIG_FILE);
}

function engineSetupRequestPath() {
  return path.join(app.getPath('userData'), ENGINE_SETUP_REQUEST_FILE);
}

function localEnginesRoot() {
  return path.join(app.getPath('userData'), 'engines');
}

function pyscfPythonExecutable() {
  return process.platform === 'win32'
    ? path.join(localEnginesRoot(), 'pyscf', 'Scripts', 'python.exe')
    : path.join(localEnginesRoot(), 'pyscf', 'bin', 'python');
}

async function readLocalEngineConfigs() {
  try {
    const content = await fs.promises.readFile(localEngineConfigPath(), 'utf8');
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function readLocalEngineConfigsSync() {
  try {
    const content = fs.readFileSync(localEngineConfigPath(), 'utf8');
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function configuredLocalEngineExecutable(engine) {
  const configs = readLocalEngineConfigsSync();
  const executablePath = configs?.[engine]?.executablePath;
  const normalized = String(executablePath || '').trim();
  return normalized && isReadableFile(normalized) ? normalized : '';
}

function normalizeExternalEngineConfig(value) {
  const engine = normalizeExternalEngineKind(value?.engine);
  const defaults = DEFAULT_EXTERNAL_ENGINE_CONFIG[engine];
  const resources = gaussianResourceDefaults();
  const processorFallback = defaults.processorCount || resources.processors;
  const memoryFallback = defaults.memoryGb || resources.memoryGb;
  return {
    engine,
    executablePath: String(value?.executablePath || '').trim(),
    method: sanitizeQuantumToken(value?.method) || defaults.method,
    basisSet: sanitizeQuantumToken(value?.basisSet) || defaults.basisSet,
    routeOptions: sanitizeRouteOptions(value?.routeOptions || defaults.routeOptions || ''),
    processorCount: boundedInteger(value?.processorCount, processorFallback, 1, Math.max(1, resources.availableProcessors)),
    memoryGb: boundedInteger(value?.memoryGb, memoryFallback, 1, Math.max(1, resources.memoryCapGb)),
    scratchDirectory: String(value?.scratchDirectory || defaults.scratchDirectory || '').trim(),
    outputDetail: normalizeGaussianOutputDetail(value?.outputDetail || defaults.outputDetail),
    performanceProfile: normalizeGaussianPerformanceProfile(value?.performanceProfile || defaults.performanceProfile)
  };
}

function normalizeGaussianOutputDetail(value) {
  if (value === 'charges' || value === 'orbitals') return value;
  return 'standard';
}

function normalizeGaussianPerformanceProfile(value) {
  return value === 'high-accuracy' ? 'high-accuracy' : 'balanced';
}

function normalizeEngineKind(value) {
  if (value === 'pyscf' || value === 'gaussian' || value === 'orca') return value;
  return 'xtb';
}

function normalizeExternalEngineKind(value) {
  return value === 'orca' ? 'orca' : 'gaussian';
}

function normalizeLocalOpenSourceEngineKind(value) {
  if (value === 'pyscf' || value === 'psi4') return value;
  return 'xtb';
}

function isCommercialEngineKind(value) {
  return value === 'gaussian' || value === 'orca';
}

function externalMethodLabel(config) {
  return config.basisSet ? `${config.method}/${config.basisSet}` : config.method;
}

async function resolveSystemPython() {
  const candidates = systemPythonCandidates();
  for (const candidate of candidates) {
    const result = await runProcess(candidate.executable, [...candidate.argsPrefix, '--version'], { timeoutMs: 10000 });
    if (result.exitCode === 0 && /\bPython\s+3\./iu.test(`${result.stdout}\n${result.stderr}`)) {
      return candidate;
    }
  }
  return null;
}

async function resolvePyscfInstallPythonCandidates(onProgress = () => {}) {
  const probes = [];
  const candidates = systemPythonCandidates();
  for (const candidate of candidates) {
    const probe = await probePythonForPyscfInstall(candidate);
    if (!probe.available) continue;
    probes.push({ ...candidate, probe });
  }

  probes.sort((left, right) => rankPyscfPythonCandidate(left.probe) - rankPyscfPythonCandidate(right.probe));
  const recommended = probes.filter((candidate) => isRecommendedPyscfPythonProbe(candidate.probe));
  const fallback = probes.filter((candidate) => !isRecommendedPyscfPythonProbe(candidate.probe));
  const resolved = [...recommended, ...fallback].slice(0, 4);

  if (resolved.length > 0) {
    emitInstallProgress(
      onProgress,
      'pyscf',
      'checking',
      8,
      `Selected ${pythonInstallCandidateLabel(resolved[0])} for the first install attempt.`,
      undefined,
      {
        attempt: pythonInstallCandidateLabel(resolved[0]),
        operation: 'Selecting the first Python candidate for managed PySCF setup.',
        command: formatProcessCommand(resolved[0].executable, [...resolved[0].argsPrefix, '-c', 'import sys, platform; print(sys.version); print(platform.architecture()[0])']),
        targetPath: resolved[0].executable,
        diagnosis: `Found ${resolved.length} usable Python candidate${resolved.length === 1 ? '' : 's'}.`,
        repairAction: recommended.length > 0
          ? 'Prioritizing 64-bit Python 3.10-3.12 for better PySCF wheel compatibility.'
          : 'No preferred Python 3.10-3.12 candidate was found; the monitor will try available Python 3 versions.'
      }
    );
  }

  return resolved;
}

async function probePythonForPyscfInstall(candidate) {
  const script = 'import json, platform, sys; print(json.dumps({"version": ".".join(map(str, sys.version_info[:3])), "major": sys.version_info[0], "minor": sys.version_info[1], "architecture": platform.architecture()[0], "executable": sys.executable}, ensure_ascii=True))';
  const result = await runProcess(candidate.executable, [...candidate.argsPrefix, '-c', script], { timeoutMs: 10000 });
  const output = `${result.stdout}\n${result.stderr}`.trim();
  if (result.exitCode !== 0) {
    return {
      available: false,
      summary: diagnosePyscfInstallerOutput(output).summary
    };
  }

  try {
    const parsed = JSON.parse(output.split(/\r?\n/u).filter(Boolean).at(-1) || '{}');
    const major = Number(parsed.major);
    const minor = Number(parsed.minor);
    const architecture = String(parsed.architecture || '');
    const version = String(parsed.version || '');
    const isPython3 = major === 3;
    return {
      available: isPython3,
      version,
      major,
      minor,
      architecture,
      executable: String(parsed.executable || candidate.executable),
      summary: isPython3
        ? `Python ${version} ${architecture} is available.`
        : 'This candidate is not Python 3.'
    };
  } catch {
    return {
      available: /\bPython\s+3\./iu.test(output),
      version: extractVersion(output) || '',
      major: 3,
      minor: 0,
      architecture: '',
      executable: candidate.executable,
      summary: outputTail(output) || 'Python candidate responded, but version metadata could not be parsed.'
    };
  }
}

function isRecommendedPyscfPythonProbe(probe) {
  return Boolean(
    probe?.available &&
      probe.major === 3 &&
      probe.minor >= 10 &&
      probe.minor <= 12 &&
      /64/u.test(String(probe.architecture || ''))
  );
}

function rankPyscfPythonCandidate(probe) {
  if (!probe?.available) return 100;
  const versionPreference = new Map([
    [11, 0],
    [12, 1],
    [10, 2],
    [9, 3],
    [8, 4],
    [13, 8]
  ]);
  const archPenalty = /64/u.test(String(probe.architecture || '')) ? 0 : 20;
  return (versionPreference.has(probe.minor) ? versionPreference.get(probe.minor) : 10) + archPenalty;
}

function pythonInstallCandidateLabel(candidate) {
  const probe = candidate?.probe || {};
  const version = probe.version ? `Python ${probe.version}` : path.basename(candidate?.executable || 'Python');
  const arch = probe.architecture ? ` ${probe.architecture}` : '';
  return `${version}${arch}`;
}

function systemPythonCandidates() {
  const candidates = [];
  const envCandidate = normalizePythonExecutableCandidate(process.env.CHEMVAULT_PYTHON_PATH);
  if (envCandidate) candidates.push(envCandidate);

  for (const executable of findPathExecutables(process.platform === 'win32' ? ['python.exe', 'python3.exe'] : ['python3', 'python'])) {
    candidates.push({ executable, argsPrefix: [] });
  }

  if (process.platform === 'win32') {
    for (const executable of findPathExecutables(['py.exe'])) {
      candidates.push({ executable, argsPrefix: ['-3'] });
    }
    for (const executable of discoverPythonExecutables()) {
      candidates.push({ executable, argsPrefix: [] });
    }
  }

  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = `${candidate.executable}\u0000${candidate.argsPrefix.join(' ')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizePythonExecutableCandidate(value) {
  if (!value) return null;
  const trimmed = String(value).trim().replace(/^["']|["']$/gu, '');
  if (!trimmed) return null;
  if (isReadableFile(trimmed)) return { executable: trimmed, argsPrefix: [] };

  const executableName = process.platform === 'win32' ? 'python.exe' : 'python';
  const direct = path.join(trimmed, executableName);
  if (isReadableFile(direct)) return { executable: direct, argsPrefix: [] };

  const nested = path.join(trimmed, process.platform === 'win32' ? 'Scripts' : 'bin', executableName);
  return isReadableFile(nested) ? { executable: nested, argsPrefix: [] } : null;
}

function findPathExecutable(names) {
  return findPathExecutables(names)[0] || null;
}

function findPathExecutables(names) {
  const found = [];
  for (const directory of String(process.env.PATH || '').split(path.delimiter)) {
    if (!directory) continue;
    for (const name of names) {
      const candidate = path.join(directory, name);
      if (isReadableFile(candidate)) found.push(candidate);
    }
  }
  return uniquePaths(found);
}

function discoverExternalEngineExecutable(engine) {
  const names = engine === 'orca' ? ['orca.exe', 'orca.bat', 'orca.cmd'] : ['g16.exe', 'g09.exe', 'g03.exe'];
  const roots = engine === 'orca' ? orcaDiscoveryRoots() : gaussianDiscoveryRoots();
  return findReadableCandidate([
    ...findPathExecutables(names),
    ...roots.flatMap((root) => names.flatMap((name) => [
      path.join(root, name),
      path.join(root, 'bin', name),
      path.join(root, 'wbin', name)
    ]))
  ]);
}

function resolveGaussianTool(tool, executablePath) {
  const names = gaussianToolNames(tool);
  return findReadableCandidate([
    ...findPathExecutables(names),
    ...gaussianToolRoots(executablePath).flatMap((root) => names.flatMap((name) => [
      path.join(root, name),
      path.join(root, 'bin', name),
      path.join(root, 'wbin', name),
      path.join(root, 'g16', name),
      path.join(root, 'g16w', name),
      path.join(root, 'g09', name),
      path.join(root, 'g09w', name)
    ]))
  ]);
}

function gaussianToolNames(tool) {
  if (tool === 'cubegen') return process.platform === 'win32' ? ['cubegen.exe', 'cubegen.bat', 'cubegen.cmd'] : ['cubegen'];
  if (tool === 'formchk') return process.platform === 'win32' ? ['formchk.exe', 'formchk.bat', 'formchk.cmd'] : ['formchk'];
  return process.platform === 'win32'
    ? ['gview.exe', 'gaussview.exe', 'gv.exe', 'GaussView.exe']
    : ['gview', 'gaussview', 'gv'];
}

function gaussianToolRoots(executablePath) {
  const roots = [];
  const normalized = String(executablePath || '').trim();
  if (normalized) {
    const executableDir = isReadableFile(normalized) ? path.dirname(normalized) : normalized;
    const installRoot = gaussianInstallRoot(executableDir);
    roots.push(
      executableDir,
      path.join(executableDir, 'bin'),
      path.join(executableDir, 'wbin'),
      installRoot,
      path.join(installRoot, 'g16'),
      path.join(installRoot, 'g16w'),
      path.join(installRoot, 'g09'),
      path.join(installRoot, 'g09w')
    );
  }
  return uniquePaths([
    ...roots,
    ...gaussianDiscoveryRoots(),
    ...windowsProgramRoots(['GaussView', 'Gaussian\\GaussView', 'Gaussian\\GVW', 'GVW'])
  ]);
}

function gaussianToolStatus(label, toolPath) {
  return {
    available: Boolean(toolPath),
    path: toolPath || undefined,
    message: toolPath ? `${label} found at ${toolPath}.` : `${label} was not found in the configured Gaussian installation or PATH.`
  };
}

function discoverPsi4Executable() {
  const names = process.platform === 'win32' ? ['psi4.exe', 'psi4.bat', 'psi4.cmd'] : ['psi4'];
  return findReadableCandidate([
    ...findPathExecutables(names),
    ...psi4DiscoveryRoots().flatMap((root) => names.flatMap((name) => [
      path.join(root, name),
      path.join(root, 'bin', name),
      path.join(root, 'Scripts', name),
      path.join(root, 'Library', 'bin', name)
    ]))
  ]);
}

function discoverPythonExecutables() {
  return findReadableCandidates(
    pythonDiscoveryRoots().flatMap((root) => [
      path.join(root, 'python.exe'),
      path.join(root, 'python3.exe'),
      path.join(root, 'Scripts', 'python.exe'),
      path.join(root, 'bin', 'python.exe')
    ])
  );
}

function xtbDiscoveryRoots() {
  return [
    ...windowsProgramRoots(['xTB', 'xtb', 'GrimmeLab\\xtb']),
    path.join(userHome(), 'scoop', 'apps', 'xtb', 'current'),
    path.join(localAppData(), 'Programs', 'xtb'),
    path.join('C:\\', 'xtb'),
    path.join('C:\\', 'ProgramData', 'chocolatey', 'bin')
  ];
}

function gaussianDiscoveryRoots() {
  return [
    path.join('C:\\', 'G16W'),
    path.join('C:\\', 'G16'),
    path.join('C:\\', 'G09W'),
    path.join('C:\\', 'G09'),
    path.join('C:\\', 'Gaussian'),
    ...windowsProgramRoots(['Gaussian', 'Gaussian\\G16W', 'Gaussian\\G16', 'Gaussian\\G09W', 'Gaussian\\G09'])
  ];
}

function orcaDiscoveryRoots() {
  return [
    path.join('C:\\', 'ORCA'),
    path.join('C:\\', 'orca'),
    ...windowsProgramRoots(['ORCA', 'orca']),
    path.join(userHome(), 'scoop', 'apps', 'orca', 'current')
  ];
}

function psi4DiscoveryRoots() {
  return [
    ...condaEnvironmentRoots('psi4'),
    ...windowsProgramRoots(['Psi4', 'psi4']),
    path.join(userHome(), 'scoop', 'apps', 'psi4', 'current')
  ];
}

function pythonDiscoveryRoots() {
  return [
    path.join(localAppData(), 'Programs', 'Python', 'Python313'),
    path.join(localAppData(), 'Programs', 'Python', 'Python312'),
    path.join(localAppData(), 'Programs', 'Python', 'Python311'),
    path.join(localAppData(), 'Programs', 'Python', 'Python310'),
    path.join(localAppData(), 'Microsoft', 'WindowsApps'),
    ...condaRootCandidates(),
    ...windowsProgramRoots(['Python313', 'Python312', 'Python311', 'Python310', 'Python'])
  ];
}

function condaEnvironmentRoots(envName) {
  return condaRootCandidates().flatMap((root) => [
    path.join(root, 'envs', envName),
    path.join(root, 'envs', envName.toLowerCase()),
    path.join(root, 'envs', envName.toUpperCase())
  ]);
}

function condaRootCandidates() {
  return [
    process.env.CONDA_PREFIX || '',
    process.env.MAMBA_ROOT_PREFIX || '',
    path.join(userHome(), 'miniconda3'),
    path.join(userHome(), 'mambaforge'),
    path.join(userHome(), 'miniforge3'),
    path.join(userHome(), 'anaconda3'),
    path.join(localAppData(), 'miniconda3'),
    path.join(localAppData(), 'mambaforge'),
    path.join(localAppData(), 'miniforge3'),
    path.join('C:\\', 'ProgramData', 'miniconda3'),
    path.join('C:\\', 'ProgramData', 'mambaforge'),
    path.join('C:\\', 'ProgramData', 'miniforge3'),
    path.join('C:\\', 'ProgramData', 'Anaconda3')
  ].filter(Boolean);
}

function windowsProgramRoots(names) {
  const roots = [
    process.env.ProgramFiles || '',
    process.env['ProgramFiles(x86)'] || '',
    process.env.ProgramW6432 || ''
  ].filter(Boolean);
  return roots.flatMap((root) => names.map((name) => path.join(root, name)));
}

function userHome() {
  return process.env.USERPROFILE || process.env.HOME || '';
}

function localAppData() {
  return process.env.LOCALAPPDATA || path.join(userHome(), 'AppData', 'Local');
}

function findReadableCandidate(candidates) {
  return findReadableCandidates(candidates)[0] || '';
}

function findReadableCandidates(candidates) {
  return uniquePaths(candidates)
    .map((candidate) => String(candidate || '').trim())
    .filter((candidate) => candidate && isReadableFile(candidate));
}

function uniquePaths(paths) {
  const seen = new Set();
  const unique = [];
  for (const value of paths) {
    const normalized = String(value || '').trim();
    if (!normalized) continue;
    const key = process.platform === 'win32' ? normalized.toLowerCase() : normalized;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(normalized);
  }
  return unique;
}

async function probePyscf(executable, argsPrefix) {
  const result = await runProcess(
    executable,
    [
      ...argsPrefix,
      '-c',
      'import pyscf; print(pyscf.__version__)'
    ],
    { timeoutMs: 20000 }
  );
  const output = `${result.stdout}\n${result.stderr}`.trim();
  return {
    available: result.exitCode === 0,
    version: result.exitCode === 0 ? extractVersion(output) || output.split(/\r?\n/u).at(-1) : undefined,
    message: outputTail(output)
  };
}

function pyscfJobScript() {
  return `
import json
import math
import sys
from pathlib import Path

from pyscf import dft, gto, scf
from pyscf.scf import hf

START = "CHEMVAULT_PYSCF_RESULT_START"
END = "CHEMVAULT_PYSCF_RESULT_END"

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
atoms = [(atom["element"], (float(atom["x"]), float(atom["y"]), float(atom["z"]))) for atom in payload["atoms"]]
method = str(payload.get("method") or "B3LYP").strip()
basis = str(payload.get("basisSet") or "6-31G").strip()
spin = int(payload.get("spin") or 0)
charge = int(payload.get("charge") or 0)

mol = gto.M(atom=atoms, unit="Angstrom", basis=basis, charge=charge, spin=spin, verbose=3)
method_upper = method.upper()
warnings = []

if method_upper in {"HF", "RHF", "UHF"}:
    mf = scf.UHF(mol) if spin else scf.RHF(mol)
else:
    mf = dft.UKS(mol) if spin else dft.RKS(mol)
    mf.xc = method

energy = float(mf.kernel())
dm = mf.make_rdm1()
if isinstance(dm, (tuple, list)):
    dm_total = dm[0] + dm[1]
else:
    try:
        dm_total = dm[0] + dm[1] if getattr(dm, "ndim", 0) == 3 else dm
    except Exception:
        dm_total = dm

dipole_vector = None
try:
    dipole = hf.dip_moment(mol, dm_total, unit="Debye", verbose=0)
    dipole_vector = [float(dipole[0]), float(dipole[1]), float(dipole[2])]
except Exception as exc:
    warnings.append(f"Dipole moment unavailable: {exc}")

charges = []
try:
    _populations, mulliken = mf.mulliken_pop(mol, dm_total, verbose=0)
    for index, value in enumerate(mulliken):
        charges.append({
            "index": index + 1,
            "element": mol.atom_symbol(index),
            "charge": float(value)
        })
except Exception as exc:
    warnings.append(f"Mulliken charges unavailable: {exc}")

if dipole_vector is None:
    dipole_result = None
else:
    dipole_result = {
        "x": dipole_vector[0],
        "y": dipole_vector[1],
        "z": dipole_vector[2],
        "total": math.sqrt(sum(component * component for component in dipole_vector))
    }

result = {
    "energyHartree": energy,
    "dipoleDebye": dipole_result,
    "charges": charges,
    "method": f"{method}/{basis}",
    "warnings": warnings
}

print(START)
print(json.dumps(result, ensure_ascii=True))
print(END)
`.trimStart();
}

function parsePyscfResult(output) {
  const match = output.match(/CHEMVAULT_PYSCF_RESULT_START\s*([\s\S]*?)\s*CHEMVAULT_PYSCF_RESULT_END/u);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1]);
    const dipole = parsed.dipoleDebye && typeof parsed.dipoleDebye === 'object'
      ? {
          x: Number(parsed.dipoleDebye.x),
          y: Number(parsed.dipoleDebye.y),
          z: Number(parsed.dipoleDebye.z),
          total: Number(parsed.dipoleDebye.total)
        }
      : null;
    return {
      energyHartree: Number.isFinite(Number(parsed.energyHartree)) ? Number(parsed.energyHartree) : null,
      dipoleDebye: dipole && Object.values(dipole).every(Number.isFinite) ? dipole : null,
      charges: Array.isArray(parsed.charges)
        ? parsed.charges
            .map((atom) => ({
              index: Number(atom.index),
              element: String(atom.element || '?'),
              charge: Number(atom.charge)
            }))
            .filter((atom) => Number.isFinite(atom.index) && Number.isFinite(atom.charge))
        : [],
      method: typeof parsed.method === 'string' ? parsed.method : '',
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map((warning) => String(warning)).filter(Boolean) : []
    };
  } catch {
    return null;
  }
}

function sanitizeQuantumToken(value) {
  return String(value || '')
    .replace(/[\r\n]/gu, ' ')
    .replace(/[<>|&;]/gu, '')
    .trim()
    .slice(0, 80);
}

function sanitizeRouteOptions(value) {
  return String(value || '')
    .replace(/[\r\n]/gu, ' ')
    .replace(/[<>|&;]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 160);
}

function isReadableFile(filePath) {
  try {
    return Boolean(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function runProcess(executable, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: processEnvWithEnglishOutput(options.env || process.env),
      windowsHide: true,
      shell: process.platform === 'win32' && /\.(cmd|bat)$/iu.test(executable)
    });
    const stdout = [];
    const stderr = [];
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      terminateChildProcess(child, true);
    }, options.timeoutMs || QUANTUM_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ exitCode: -1, stdout: '', stderr: error.message, timedOut });
    });
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({
        exitCode: exitCode ?? -1,
        stdout: decodeTextBuffer(Buffer.concat(stdout)),
        stderr: decodeTextBuffer(Buffer.concat(stderr)),
        timedOut
      });
    });
  });
}

function runProcessWithProgress(executable, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: processEnvWithEnglishOutput(options.env || process.env),
      windowsHide: true,
      shell: process.platform === 'win32' && /\.(cmd|bat)$/iu.test(executable)
    });
    const stdout = [];
    const stderr = [];
    let timedOut = false;
    let cancelled = false;
    let lastProgressAt = 0;
    const jobId = normalizeCalculationId(options.jobId);
    const timer = setTimeout(() => {
      timedOut = true;
      terminateChildProcess(child, true);
    }, options.timeoutMs || QUANTUM_TIMEOUT_MS);
    if (jobId) {
      activeQuantumProcesses.set(jobId, {
        cancel: () => {
          cancelled = true;
          terminateChildProcess(child, true);
        }
      });
    }

    function pushProgress() {
      if (typeof options.progress !== 'function') return;
      const now = Date.now();
      if (now - lastProgressAt < 500) return;
      lastProgressAt = now;
      options.progress(outputTail(`${decodeTextBuffer(Buffer.concat(stdout))}\n${decodeTextBuffer(Buffer.concat(stderr))}`));
    }

    child.stdout.on('data', (chunk) => {
      stdout.push(Buffer.from(chunk));
      pushProgress();
    });
    child.stderr.on('data', (chunk) => {
      stderr.push(Buffer.from(chunk));
      pushProgress();
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      if (jobId) activeQuantumProcesses.delete(jobId);
      const result = { cancelled, exitCode: -1, stdout: '', stderr: error.message, timedOut };
      if (typeof options.progress === 'function') options.progress(error.message);
      resolve(result);
    });
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      if (jobId) activeQuantumProcesses.delete(jobId);
      const result = {
        cancelled,
        exitCode: exitCode ?? -1,
        stdout: decodeTextBuffer(Buffer.concat(stdout)),
        stderr: [decodeTextBuffer(Buffer.concat(stderr)), cancelled ? 'Cancelled by ChemVault user.' : ''].filter(Boolean).join('\n'),
        timedOut
      };
      if (typeof options.progress === 'function') {
        options.progress(outputTail(`${result.stdout}\n${result.stderr}`));
      }
      resolve(result);
    });
  });
}

function terminateChildProcess(child, force = false) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32' && child.pid) {
    const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore'
    });
    killer.on('error', () => {
      try {
        child.kill();
      } catch {
        // The process may already have stopped between the status check and fallback.
      }
    });
    return;
  }

  try {
    child.kill(force ? 'SIGKILL' : 'SIGTERM');
  } catch {
    // The process may already have stopped between the status check and signal.
  }
}

function processEnvWithEnglishOutput(env) {
  return {
    ...env,
    LANG: 'en_US.UTF-8',
    LANGUAGE: 'en_US',
    LC_ALL: 'C',
    PIP_DISABLE_PIP_VERSION_CHECK: env?.PIP_DISABLE_PIP_VERSION_CHECK || '1',
    PYTHONIOENCODING: 'utf-8',
    PYTHONUTF8: '1'
  };
}

function cancelQuantumCalculation(calculationId) {
  const jobId = normalizeCalculationId(calculationId);
  if (!jobId) return { ok: false, message: 'Calculation id is required.' };
  const active = activeQuantumProcesses.get(jobId);
  if (!active) {
    return {
      ok: false,
      calculationId: jobId,
      message: 'No running calculation was found for this id.'
    };
  }

  active.cancel();
  return {
    ok: true,
    calculationId: jobId,
    message: 'Cancellation requested. ChemVault is stopping the engine process.'
  };
}

function normalizeCalculationId(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9_-]/gu, '')
    .slice(0, 80);
}

function emitCalculationProgress(onProgress, engine, phase, percent, message, output, startedAt) {
  if (typeof onProgress !== 'function') return;
  onProgress({
    engine,
    engineLabel: QUANTUM_ENGINE_LABELS[engine] || engine,
    phase,
    percent: Math.max(0, Math.min(100, Math.round(Number(percent) || 0))),
    message: message || 'Running quantum calculation.',
    elapsedMs: Number.isFinite(startedAt) ? Date.now() - startedAt : undefined,
    outputTail: output ? outputTail(output) : undefined
  });
}

function estimateProgress(startedAt, timeoutMs, min, max) {
  const elapsed = Date.now() - startedAt;
  const denominator = Math.max(30000, Number(timeoutMs) || QUANTUM_TIMEOUT_MS);
  const fraction = Math.min(0.98, elapsed / denominator);
  return min + (max - min) * fraction;
}

function emitInstallProgress(onProgress, engine, phase, percent, message, output, details = {}) {
  if (typeof onProgress !== 'function') return;
  onProgress({
    engine,
    engineLabel: QUANTUM_ENGINE_LABELS[engine] || engine,
    phase,
    percent: Math.max(0, Math.min(100, Number(percent) || 0)),
    message,
    attempt: details.attempt || undefined,
    command: details.command || undefined,
    cwd: details.cwd || undefined,
    diagnosis: details.diagnosis || undefined,
    operation: details.operation || undefined,
    outputTail: output || undefined,
    repairAction: details.repairAction || undefined,
    targetPath: details.targetPath || undefined
  });
}

function normalizeQuantumInput(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\r\n/g, '\n').trim();
  if (!normalized || Buffer.byteLength(normalized, 'utf8') > MAX_QUANTUM_INPUT_BYTES) return null;

  const lines = normalized.split('\n').filter((line) => line.trim());
  const atomCount = Number.parseInt(lines[0], 10);
  if (!Number.isFinite(atomCount) || atomCount <= 0 || lines.length < atomCount + 2) return null;
  return `${lines.slice(0, atomCount + 2).join('\n')}\n`;
}

async function prepareGaussianJob(workDir, xyz, options) {
  const atoms = parseXyzGeometry(xyz);
  const resources = gaussianResourceDefaults();
  const processorCount = boundedInteger(options.processorCount, resources.processors, 1, resources.availableProcessors);
  const memoryGb = boundedInteger(options.memoryGb, resources.memoryGb, 1, resources.memoryCapGb);
  const inputPath = path.join(workDir, 'chemvault.gjf');
  const outputPath = path.join(workDir, 'chemvault.log');
  const checkpointPath = path.join(workDir, 'chemvault.chk');
  const oldCheckpointPath = path.join(workDir, 'chemvault-old.chk');
  if (options.reuseCheckpoint) {
    await writeBase64File(oldCheckpointPath, options.checkpointBase64, 'A Gaussian checkpoint is required for continuation.');
    const checkpointStat = await fs.promises.stat(oldCheckpointPath);
    if (checkpointStat.size > MAX_GAUSSIAN_CHECKPOINT_BYTES) {
      throw new Error('The Gaussian continuation checkpoint exceeds the supported size limit.');
    }
  }
  const outputKeywords = gaussianOutputKeywords(options.outputDetail, options.routeOptions);
  const routeParts = [
    options.outputDetail === 'orbitals' ? '#p' : '#',
    `${options.method}/${options.basisSet}`,
    gaussianRouteKeywords(options.gaussianTask, options.calculationMode),
    outputKeywords,
    options.reuseCheckpoint ? 'Geom=AllCheck Guess=Read' : '',
    options.routeOptions
  ].filter(Boolean);
  const link0 = [
    `%NProcShared=${processorCount}`,
    `%Mem=${memoryGb}GB`,
    options.reuseCheckpoint ? '%OldChk=chemvault-old.chk' : '',
    '%chk=chemvault.chk',
  ].filter(Boolean);
  const content = options.reuseCheckpoint
    ? [...link0, routeParts.join(' '), '', ''].join('\n')
    : [
        ...link0,
        routeParts.join(' '),
        '',
        'ChemVault Model external Gaussian job',
        '',
        `${options.charge} ${options.multiplicity}`,
        ...atoms.map((atom) => `${atom.element} ${formatCoordinate(atom.x)} ${formatCoordinate(atom.y)} ${formatCoordinate(atom.z)}`),
        '',
        ''
      ].join('\n');

  await fs.promises.writeFile(inputPath, content, 'utf8');
  return { args: [inputPath], checkpointPath, inputContent: content, inputPath, oldCheckpointPath, outputPath };
}

function gaussianOutputKeywords(detail, routeOptions) {
  const route = String(routeOptions || '');
  const keywords = [];
  if (!/\bpop\s*=/iu.test(route)) {
    if (detail === 'charges') keywords.push('Pop=Regular');
    if (detail === 'orbitals') keywords.push('Pop=Full');
  }
  if (detail === 'orbitals' && !/\bgfinput\b/iu.test(route)) keywords.push('GFInput');
  if (detail === 'orbitals' && !/\bgfprint\b/iu.test(route)) keywords.push('GFPrint');
  return keywords.join(' ');
}

function gaussianResourceDefaults() {
  const availableProcessors = typeof os.availableParallelism === 'function'
    ? os.availableParallelism()
    : os.cpus().length;
  const automaticProcessors = Math.max(1, Math.min(8, availableProcessors - 1));
  const totalMemoryGb = Math.max(1, Math.floor(os.totalmem() / (1024 ** 3)));
  const memoryCapGb = Math.max(1, totalMemoryGb - 1);
  const automaticMemoryGb = Math.max(1, Math.min(16, Math.floor(totalMemoryGb * 0.5), memoryCapGb));

  return {
    availableProcessors,
    memoryCapGb,
    processors: boundedInteger(process.env.CHEMVAULT_GAUSSIAN_NPROC, automaticProcessors, 1, Math.max(1, availableProcessors)),
    memoryGb: boundedInteger(process.env.CHEMVAULT_GAUSSIAN_MEMORY_GB, automaticMemoryGb, 1, memoryCapGb)
  };
}

async function prepareOrcaJob(workDir, xyz, options) {
  const atoms = parseXyzGeometry(xyz);
  const inputPath = path.join(workDir, 'chemvault.inp');
  const outputPath = path.join(workDir, 'chemvault.out');
  const commandParts = [
    '!',
    options.method,
    options.basisSet,
    options.calculationMode === 'geometry-optimization' ? 'Opt' : 'SP',
    options.routeOptions
  ].filter(Boolean);
  const processorCount = Math.max(1, Number(options.processorCount) || 1);
  const maxCoreMb = Math.max(256, Math.floor((Math.max(1, Number(options.memoryGb) || 1) * 1024) / processorCount));
  const content = [
    commandParts.join(' '),
    `%pal nprocs ${processorCount} end`,
    `%maxcore ${maxCoreMb}`,
    `* xyz ${options.charge} ${options.multiplicity}`,
    ...atoms.map((atom) => `${atom.element} ${formatCoordinate(atom.x)} ${formatCoordinate(atom.y)} ${formatCoordinate(atom.z)}`),
    '*',
    ''
  ].join('\n');

  await fs.promises.writeFile(inputPath, content, 'utf8');
  return { args: [inputPath], outputPath };
}

function parseXyzGeometry(xyz) {
  const lines = xyz.split(/\r?\n/u).filter((line) => line.trim());
  const atomCount = Number.parseInt(lines[0], 10);
  return lines.slice(2, 2 + atomCount).map((line) => {
    const [element, rawX, rawY, rawZ] = line.trim().split(/\s+/u);
    return {
      element: element || '?',
      x: Number(rawX) || 0,
      y: Number(rawY) || 0,
      z: Number(rawZ) || 0
    };
  });
}

function formatCoordinate(value) {
  return Number.isFinite(value) ? value.toFixed(8) : '0.00000000';
}

function numbersFromLine(value) {
  return Array.from(String(value || '').matchAll(/[-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?/gu)).map((match) => Number(match[0])).filter(Number.isFinite);
}

function numberAfter(text, pattern) {
  const match = String(text || '').match(pattern);
  const value = match ? Number(match[1]) : null;
  return Number.isFinite(value) ? value : null;
}

function atomicSymbol(atomicNumber) {
  return ATOMIC_SYMBOLS[atomicNumber] || '';
}

async function readOptionalText(filePath) {
  try {
    return decodeTextBuffer(await fs.promises.readFile(filePath));
  } catch {
    return '';
  }
}

async function writeBase64File(filePath, contentBase64, missingMessage) {
  const text = String(contentBase64 || '').trim();
  if (!text) throw new Error(missingMessage || 'File data was empty.');
  await fs.promises.writeFile(filePath, Buffer.from(text, 'base64'));
}

async function readBridgeAttachment(filePath, mimeType) {
  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile() || stat.size > MAX_GAUSSIAN_BRIDGE_ATTACHMENT_BYTES) return null;
    const buffer = await fs.promises.readFile(filePath);
    return {
      fileName: path.basename(filePath),
      mimeType,
      byteLength: buffer.length,
      contentBase64: buffer.toString('base64')
    };
  } catch {
    return null;
  }
}

async function readOptionalBinaryAttachment(filePath, maxBytes) {
  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) return { reason: 'Gaussian checkpoint path was not a file.' };
    if (stat.size > maxBytes) {
      return {
        reason: `Gaussian checkpoint was ${(stat.size / 1024 / 1024).toFixed(1)} MB, above the ChemVault attachment limit of ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`
      };
    }
    const buffer = await fs.promises.readFile(filePath);
    return {
      attachment: {
        fileName: path.basename(filePath),
        contentBase64: buffer.toString('base64'),
        byteLength: buffer.length,
        mimeType: 'application/octet-stream'
      }
    };
  } catch {
    return { reason: 'Gaussian checkpoint file could not be read.' };
  }
}

async function collectGaussianFiles(job, outputText) {
  const files = {
    input: {
      fileName: path.basename(job.inputPath || 'chemvault.gjf'),
      contentText: job.inputContent || await readOptionalText(job.inputPath),
      mimeType: 'chemical/x-gaussian-input'
    },
    output: {
      fileName: 'chemvault.txt',
      contentText: outputText || await readOptionalText(job.outputPath),
      mimeType: 'text/plain'
    }
  };

  const checkpoint = await readOptionalBinaryAttachment(job.checkpointPath, MAX_GAUSSIAN_CHECKPOINT_BYTES);
  if (checkpoint.attachment) {
    files.checkpoint = checkpoint.attachment;
  } else if (checkpoint.reason) {
    files.checkpointUnavailableReason = checkpoint.reason;
  }

  return files;
}

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeCalculationMode(value) {
  return value === 'geometry-optimization' ? 'geometry-optimization' : 'single-point';
}

function sanitizeCubegenKind(value) {
  return String(value || 'density=scf')
    .replace(/[\r\n]/gu, '')
    .replace(/[^a-zA-Z0-9_=(),+\-.]/gu, '')
    .trim()
    .slice(0, 80) || 'density=scf';
}

function bridgeFileBaseName(value) {
  return String(value || 'chemvault_gaussian')
    .replace(/[^a-zA-Z0-9-_]/gu, '_')
    .replace(/_+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .slice(0, 80) || 'chemvault_gaussian';
}

function normalizeGaussianTask(value, calculationMode = 'single-point') {
  const normalized = String(value || '').trim();
  if (
    normalized === 'frequency' ||
    normalized === 'optimization-frequency' ||
    normalized === 'td-dft' ||
    normalized === 'nmr' ||
    normalized === 'solvent-model' ||
    normalized === 'transition-state' ||
    normalized === 'irc' ||
    normalized === 'stability' ||
    normalized === 'frontier-orbitals' ||
    normalized === 'nbo'
  ) {
    return normalized;
  }
  return calculationMode === 'geometry-optimization' ? 'geometry-optimization' : 'single-point';
}

function gaussianTaskLabelFor(task) {
  if (task === 'geometry-optimization') return 'Geometry optimization';
  if (task === 'frequency') return 'Frequency analysis';
  if (task === 'optimization-frequency') return 'Optimization + frequency';
  if (task === 'td-dft') return 'TD-DFT excited states';
  if (task === 'nmr') return 'NMR shielding';
  if (task === 'solvent-model') return 'Solvent model';
  if (task === 'transition-state') return 'Transition-state search';
  if (task === 'irc') return 'IRC pathway';
  if (task === 'stability') return 'Wavefunction stability';
  if (task === 'frontier-orbitals') return 'Frontier orbital analysis';
  if (task === 'nbo') return 'NBO bridge';
  return 'Single point';
}

function gaussianRouteKeywords(task, calculationMode = 'single-point') {
  const normalized = normalizeGaussianTask(task, calculationMode);
  if (normalized === 'geometry-optimization') return 'Opt';
  if (normalized === 'frequency') return 'Freq';
  if (normalized === 'optimization-frequency') return 'Opt Freq';
  if (normalized === 'td-dft') return 'TD(NStates=10)';
  if (normalized === 'nmr') return 'NMR=GIAO';
  if (normalized === 'solvent-model') return 'SP SCRF=(SMD,Solvent=Water)';
  if (normalized === 'transition-state') return 'Opt=(TS,CalcFC,NoEigenTest) Freq';
  if (normalized === 'irc') return 'IRC=(CalcFC,MaxPoints=20)';
  if (normalized === 'stability') return 'Stable=Opt';
  if (normalized === 'frontier-orbitals') return 'SP';
  if (normalized === 'nbo') return 'Pop=NBORead';
  return 'SP';
}

function extractVersion(output) {
  const versionLine = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => /xtb|\d+\.\d+/iu.test(line));
  return versionLine || undefined;
}

function parseEnergy(output) {
  const matches = Array.from(output.matchAll(/TOTAL\s+ENERGY\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/giu));
  const last = matches.at(-1);
  return last ? Number(last[1]) : null;
}

function parseDipole(output) {
  const lines = output.split(/\r?\n/u);
  let fallback = null;

  for (const line of lines) {
    const match = line.match(/^\s*(full|q\s+only)\s*:?\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/iu);
    if (!match) continue;

    const dipole = {
      x: Number(match[2]),
      y: Number(match[3]),
      z: Number(match[4]),
      total: Number(match[5])
    };
    if (/full/iu.test(match[1])) return dipole;
    fallback = dipole;
  }

  return fallback;
}

function parseGaussianEnergy(output) {
  return gaussianParsers.parseGaussianEnergy(output);
}

function parseGaussianDipole(output) {
  return gaussianParsers.parseGaussianDipole(output);
}

function parseGaussianCharges(output) {
  return gaussianParsers.parseGaussianCharges(output);
}

function parseGaussianPopulation(output) {
  return gaussianParsers.parseGaussianPopulation(output);
}

function parseGaussianFrontierOrbitals(output) {
  return gaussianParsers.parseGaussianFrontierOrbitals(output);
}

function parseGaussianFrequencySummary(output) {
  return gaussianParsers.parseGaussianFrequencySummary(output);
}

function parseGaussianThermochemistry(output) {
  return gaussianParsers.parseGaussianThermochemistry(output);
}

function parseGaussianOptimizedXyz(output) {
  return gaussianParsers.parseGaussianOptimizedXyz(output);
}

function parseGaussianExcitedStates(output) {
  return gaussianParsers.parseGaussianExcitedStates(output);
}

function parseGaussianNmrShielding(output) {
  return gaussianParsers.parseGaussianNmrShielding(output);
}

function parseOrcaEnergy(output) {
  const matches = Array.from(output.matchAll(/FINAL\s+SINGLE\s+POINT\s+ENERGY\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/giu));
  const last = matches.at(-1);
  return last ? Number(last[1]) : null;
}

function parseOrcaDipole(output) {
  const vectorMatches = Array.from(output.matchAll(/Total\s+Dipole\s+Moment\s*:?\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/giu));
  const magnitudeMatches = Array.from(output.matchAll(/Magnitude\s+\(Debye\)\s*:?\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/giu));
  const vector = vectorMatches.at(-1);
  const magnitude = magnitudeMatches.at(-1);

  if (vector) {
    const scale = 2.541746;
    const x = Number(vector[1]) * scale;
    const y = Number(vector[2]) * scale;
    const z = Number(vector[3]) * scale;
    return {
      x,
      y,
      z,
      total: magnitude ? Number(magnitude[1]) : Math.hypot(x, y, z)
    };
  }

  return magnitude
    ? {
        x: 0,
        y: 0,
        z: 0,
        total: Number(magnitude[1])
      }
    : null;
}

function parseOrcaCharges(output) {
  const section = output.match(/MULLIKEN\s+ATOMIC\s+CHARGES[\s\S]*?(?:Sum\s+of\s+atomic\s+charges|LOEWDIN|HIRSHFELD|DIPOLE|ORBITAL)/iu)?.[0] || '';
  const charges = [];
  for (const match of section.matchAll(/^\s*(\d+)\s+([A-Za-z]{1,2})\s*:?\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/gmu)) {
    charges.push({
      index: Number(match[1]) + 1,
      element: match[2],
      charge: Number(match[3])
    });
  }
  return charges;
}

async function readCharges(workDir, xyz) {
  const atoms = parseXyzAtoms(xyz);
  const chargeFiles = ['charges', 'charges.dat', 'xtb.charges'];

  for (const fileName of chargeFiles) {
    const filePath = path.join(workDir, fileName);
    if (!isReadableFile(filePath)) continue;

    const content = await fs.promises.readFile(filePath, 'utf8');
    const values = content
      .split(/\s+/u)
      .map((value) => Number(value))
      .filter(Number.isFinite);

    if (values.length >= atoms.length) {
      return atoms.map((atom, index) => ({
        index: index + 1,
        element: atom.element,
        charge: values[index]
      }));
    }
  }

  return [];
}

function parseXyzAtoms(xyz) {
  const lines = xyz.split(/\r?\n/u).filter((line) => line.trim());
  const atomCount = Number.parseInt(lines[0], 10);
  return lines.slice(2, 2 + atomCount).map((line) => {
    const [element] = line.trim().split(/\s+/u);
    return { element: element || '?' };
  });
}

function diagnosePyscfInstallerOutput(output) {
  const text = String(output || '').trim();
  if (!text) {
    return {
      code: 'waiting',
      summary: 'Waiting for installer output.',
      repairAction: 'The monitor will update this diagnosis when pip or Python returns output.',
      retryWithAnotherPython: false,
      terminal: false
    };
  }

  if (/No module named pip|ensurepip is disabled|No module named ensurepip|pip is not recognized/iu.test(text)) {
    return {
      code: 'pip-missing',
      summary: 'pip is missing or damaged in the Python environment.',
      repairAction: 'Bootstrapping pip with ensurepip, then upgrading wheel and setuptools.',
      retryWithAnotherPython: false,
      terminal: false
    };
  }

  if (/Microsoft Store|No Python at|App execution alias|was not found but can be installed/iu.test(text)) {
    return {
      code: 'store-python',
      summary: 'Windows returned the Microsoft Store Python alias instead of a real Python installation.',
      repairAction: 'Skipping this alias and trying another Python executable.',
      retryWithAnotherPython: true,
      terminal: false
    };
  }

  if (/No matching distribution found|Could not find a version that satisfies|Requires-Python|not a supported wheel on this platform/iu.test(text)) {
    return {
      code: 'no-compatible-wheel',
      summary: 'No compatible PySCF wheel was available for this Python version or platform.',
      repairAction: 'Trying another 64-bit Python 3.10-3.12 candidate when available.',
      retryWithAnotherPython: true,
      terminal: true
    };
  }

  if (/Microsoft Visual C\+\+|cl\.exe|Failed building wheel|Building wheel for .* failed|subprocess-exited-with-error|legacy-install-failure|CMake Error|ninja/iu.test(text)) {
    return {
      code: 'source-build-failed',
      summary: 'pip attempted a source build and the Windows compiler toolchain failed.',
      repairAction: 'Retrying with binary wheels only, then trying another Python candidate if needed.',
      retryWithAnotherPython: true,
      terminal: false
    };
  }

  if (/CERTIFICATE_VERIFY_FAILED|SSL:|TLSV1_ALERT|Read timed out|ConnectionReset|Temporary failure|NameResolutionError|ProxyError|Could not fetch URL|network is unreachable|timed out/iu.test(text)) {
    return {
      code: 'network',
      summary: 'The package download failed because of network, proxy, SSL, or timeout problems.',
      repairAction: 'Retrying with longer timeout, clean cache, and an alternate HTTPS package index.',
      retryWithAnotherPython: false,
      terminal: false
    };
  }

  if (/Access is denied|Permission denied|WinError 5|operation not permitted|Errno 13/iu.test(text)) {
    return {
      code: 'permission',
      summary: 'Windows blocked access to the Python environment or package cache.',
      repairAction: 'Recreating only the ChemVault managed environment and retrying in the user data folder.',
      retryWithAnotherPython: false,
      terminal: false
    };
  }

  if (/hashes do not match|THESE PACKAGES DO NOT MATCH THE HASHES|File is not a zip file|BadZipFile|invalid wheel|corrupt/iu.test(text)) {
    return {
      code: 'corrupt-download',
      summary: 'The downloaded package or cached wheel appears incomplete or corrupted.',
      repairAction: 'Clearing pip cache and retrying the package download.',
      retryWithAnotherPython: false,
      terminal: false
    };
  }

  if (/Successfully installed|Requirement already satisfied|Installing collected packages/iu.test(text)) {
    return {
      code: 'progress',
      summary: 'pip is installing packages normally.',
      repairAction: 'ChemVault will still verify PySCF import before marking the engine ready.',
      retryWithAnotherPython: false,
      terminal: false
    };
  }

  if (/Collecting|Downloading|Using cached|Preparing metadata|Installing build dependencies|Getting requirements/iu.test(text)) {
    return {
      code: 'download',
      summary: 'pip is resolving, downloading, or preparing package dependencies.',
      repairAction: 'The monitor is watching for wheel, network, and build failures.',
      retryWithAnotherPython: false,
      terminal: false
    };
  }

  if (/Traceback|Error|Failed|Could not/iu.test(text)) {
    return {
      code: 'generic-error',
      summary: 'The installer output contains an error that does not match a known automatic repair pattern.',
      repairAction: 'The monitor will continue with the next safe retry path if one is available.',
      retryWithAnotherPython: false,
      terminal: false
    };
  }

  return {
    code: 'informational',
    summary: 'The installer output is informational.',
    repairAction: 'ChemVault is waiting for the final process result before deciding the next action.',
    retryWithAnotherPython: false,
    terminal: false
  };
}

function shouldTryAnotherPythonForPyscf(diagnosis) {
  return Boolean(diagnosis?.retryWithAnotherPython);
}

function isTerminalPyscfInstallFailure(diagnosis) {
  return Boolean(diagnosis?.terminal && !diagnosis.retryWithAnotherPython);
}

function outputTail(output) {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(-80)
    .join('\n')
    .slice(-8000);
}

process.on('uncaughtException', (error) => {
  console.error(error);
});

process.on('unhandledRejection', (error) => {
  console.error(error);
});
