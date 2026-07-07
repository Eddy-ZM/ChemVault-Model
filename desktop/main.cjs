const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const APP_TITLE = 'ChemVault Model';
const DEFAULT_API_BASE = 'https://model.chemvault.science/api/chem';
const DEFAULT_USER_ORIGIN = 'https://user.chemvault.science';
const DEFAULT_START_PATH = '/molecule/';
const QUANTUM_TIMEOUT_MS = 180000;
const MAX_QUANTUM_INPUT_BYTES = 2 * 1024 * 1024;
const EXTERNAL_ENGINE_CONFIG_FILE = 'quantum-engines.json';
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
    routeOptions: 'Pop=Full'
  },
  orca: {
    engine: 'orca',
    executablePath: '',
    method: 'B3LYP',
    basisSet: 'def2-SVP',
    routeOptions: 'TightSCF'
  }
};

let mainWindow = null;
let staticServer = null;
const userCookieJar = new Map();

app.setName(APP_TITLE);

ipcMain.handle('quantum:engine-status', async (_event, engine) => getQuantumEngineStatus(engine));
ipcMain.handle('quantum:run', async (_event, request) => runQuantumCalculation(request));
ipcMain.handle('quantum:external-config:get', async (_event, engine) => getExternalQuantumConfig(engine));
ipcMain.handle('quantum:external-config:save', async (_event, config) => saveExternalQuantumConfig(config));
ipcMain.handle('quantum:select-executable', async (_event, engine) => selectQuantumEngineExecutable(engine));
ipcMain.handle('quantum:local-engines:list', async () => getLocalOpenSourceEngines());
ipcMain.handle('quantum:local-engine:install', async (_event, engine) => installLocalOpenSourceEngine(engine));
ipcMain.handle('quantum:local-engines:open-folder', async () => openLocalEngineFolder());

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

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: body.length > 0 && request.method !== 'GET' && request.method !== 'HEAD' ? body : undefined
  });

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

async function runQuantumCalculation(request) {
  const engineKind = normalizeEngineKind(request?.engine);
  if (isCommercialEngineKind(engineKind)) {
    return runExternalQuantumCalculation(engineKind, request);
  }

  if (engineKind === 'pyscf') {
    return runPyscfCalculation(request);
  }

  const startedAt = Date.now();
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
    outputTail: ''
  };

  if (!engine) {
    return {
      ...baseResult,
      elapsedMs: Date.now() - startedAt,
      error: 'xTB engine was not found. Install xTB, set CHEMVAULT_XTB_PATH, or bundle it under desktop/quantum/xtb before building.'
    };
  }

  const xyz = normalizeQuantumInput(request?.xyz);
  if (!xyz) {
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
    await fs.promises.writeFile(inputPath, xyz, 'utf8');
    const args = buildXtbArgs(inputPath, charge, unpairedElectrons, calculationMode);
    const processResult = await runProcess(
      engine.executable,
      args,
      {
        cwd: workDir,
        timeoutMs,
        env: buildXtbEnv(engine)
      }
    );
    const output = `${processResult.stdout}\n${processResult.stderr}`.trim();
    const charges = await readCharges(workDir, xyz);
    const energyHartree = parseEnergy(output);
    const dipoleDebye = parseDipole(output);
    const warnings = [];

    if (processResult.timedOut) warnings.push('xTB calculation timed out before completion.');
    if (energyHartree === null) warnings.push('Total energy was not found in xTB output.');
    if (!dipoleDebye) warnings.push('Dipole moment was not found in xTB output.');
    if (charges.length === 0) warnings.push('Partial charges file was not produced by xTB.');

    return {
      ok: processResult.exitCode === 0,
      engine: 'xtb',
      engineLabel: QUANTUM_ENGINE_LABELS.xtb,
      method: 'GFN2-xTB',
      calculationMode,
      energyHartree,
      dipoleDebye,
      charges,
      chargeModel: 'xTB population analysis',
      elapsedMs: Date.now() - startedAt,
      warnings,
      outputTail: outputTail(output),
      error: processResult.exitCode === 0 ? undefined : `xTB exited with code ${processResult.exitCode}.`
    };
  } catch (error) {
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
      message: `${engineLabel} executable is not configured. Select a licensed local installation before running this engine.`
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

async function runExternalQuantumCalculation(engineKind, request) {
  const startedAt = Date.now();
  const config = await getExternalQuantumConfig(engineKind);
  const engineLabel = QUANTUM_ENGINE_LABELS[engineKind] || 'External engine';
  const calculationMode = normalizeCalculationMode(request?.calculationMode);
  const method = sanitizeQuantumToken(request?.method) || config.method;
  const basisSet = sanitizeQuantumToken(request?.basisSet) || config.basisSet;
  const routeOptions = sanitizeRouteOptions(request?.routeOptions || config.routeOptions || '');
  const methodLabel = externalMethodLabel({ ...config, method, basisSet });
  const baseResult = {
    ok: false,
    engine: engineKind,
    engineLabel,
    method: methodLabel,
    calculationMode,
    energyHartree: null,
    dipoleDebye: null,
    charges: [],
    chargeModel: `${engineLabel} Mulliken population analysis`,
    elapsedMs: 0,
    warnings: [],
    outputTail: ''
  };

  if (!config.executablePath || !isReadableFile(config.executablePath)) {
    return {
      ...baseResult,
      elapsedMs: Date.now() - startedAt,
      error: `${engineLabel} executable is not configured or cannot be read.`
    };
  }

  const xyz = normalizeQuantumInput(request?.xyz);
  if (!xyz) {
    return {
      ...baseResult,
      elapsedMs: Date.now() - startedAt,
      error: 'A valid 3D XYZ structure is required before running an external quantum engine.'
    };
  }

  const charge = boundedInteger(request?.charge, 0, -20, 20);
  const unpairedElectrons = boundedInteger(request?.unpairedElectrons, 0, 0, 20);
  const multiplicity = unpairedElectrons + 1;
  const timeoutMs = boundedInteger(request?.timeoutMs, calculationMode === 'geometry-optimization' ? 900000 : 300000, 30000, 3600000);
  const workDir = await fs.promises.mkdtemp(path.join(app.getPath('temp'), `chemvault-${engineKind}-`));

  try {
    const job = engineKind === 'gaussian'
      ? await prepareGaussianJob(workDir, xyz, { charge, multiplicity, method, basisSet, routeOptions, calculationMode })
      : await prepareOrcaJob(workDir, xyz, { charge, multiplicity, method, basisSet, routeOptions, calculationMode });
    const processResult = await runProcess(config.executablePath, job.args, {
      cwd: workDir,
      timeoutMs,
      env: {
        ...process.env,
        PATH: [path.dirname(config.executablePath), process.env.PATH || ''].join(path.delimiter)
      }
    });
    const fileOutput = await readOptionalText(job.outputPath);
    const output = [processResult.stdout, processResult.stderr, fileOutput].filter(Boolean).join('\n').trim();
    const energyHartree = engineKind === 'gaussian' ? parseGaussianEnergy(output) : parseOrcaEnergy(output);
    const dipoleDebye = engineKind === 'gaussian' ? parseGaussianDipole(output) : parseOrcaDipole(output);
    const charges = engineKind === 'gaussian' ? parseGaussianCharges(output) : parseOrcaCharges(output);
    const warnings = [];

    if (processResult.timedOut) warnings.push(`${engineLabel} calculation timed out before completion.`);
    if (energyHartree === null) warnings.push('Total energy was not found in the external engine output.');
    if (!dipoleDebye) warnings.push('Dipole moment was not found in the external engine output.');
    if (charges.length === 0) warnings.push('Mulliken charges were not found in the external engine output.');

    return {
      ok: processResult.exitCode === 0,
      engine: engineKind,
      engineLabel,
      method: methodLabel,
      calculationMode,
      energyHartree,
      dipoleDebye,
      charges,
      chargeModel: `${engineLabel} Mulliken population analysis`,
      elapsedMs: Date.now() - startedAt,
      warnings,
      outputTail: outputTail(output),
      error: processResult.exitCode === 0 ? undefined : `${engineLabel} exited with code ${processResult.exitCode}.`
    };
  } catch (error) {
    return {
      ...baseResult,
      elapsedMs: Date.now() - startedAt,
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

async function getPsi4Status() {
  const template = LOCAL_OPEN_SOURCE_ENGINES.psi4;
  const executable = findPathExecutable(process.platform === 'win32' ? ['psi4.exe', 'psi4.bat', 'psi4.cmd'] : ['psi4']);
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
    installMode: 'detected',
    executable,
    installPath: path.dirname(executable),
    version: extractVersion(output),
    message: versionResult.exitCode === 0
      ? 'Psi4 was detected on PATH. Direct Psi4 job execution is reserved for the external engine bridge.'
      : 'Psi4 executable was found, but the version probe failed.'
  };
}

async function installLocalOpenSourceEngine(engineValue) {
  const engine = normalizeLocalOpenSourceEngineKind(engineValue);
  if (engine === 'pyscf') {
    return installPyscfEngine();
  }

  const status = engine === 'xtb' ? await getXtbLocalStatus() : await getPsi4Status();
  const engineLabel = QUANTUM_ENGINE_LABELS[engine];
  return {
    ok: false,
    engine,
    engineLabel,
    status,
    outputTail: '',
    error: `${engineLabel} requires a manual system installation. ${LOCAL_OPEN_SOURCE_ENGINES[engine].installCommand}`
  };
}

async function installPyscfEngine() {
  const engine = 'pyscf';
  const engineLabel = QUANTUM_ENGINE_LABELS.pyscf;
  const python = await resolveSystemPython();
  const venvDir = path.join(localEnginesRoot(), 'pyscf');
  const managedPython = pyscfPythonExecutable();
  const outputParts = [];

  if (!python) {
    const status = await getPyscfStatus();
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

  if (!isReadableFile(managedPython)) {
    const createResult = await runProcess(python.executable, [...python.argsPrefix, '-m', 'venv', venvDir], {
      timeoutMs: 180000
    });
    outputParts.push(createResult.stdout, createResult.stderr);
    if (createResult.exitCode !== 0) {
      const status = await getPyscfStatus();
      return {
        ok: false,
        engine,
        engineLabel,
        status,
        outputTail: outputTail(outputParts.join('\n')),
        error: 'Could not create the managed Python environment for PySCF.'
      };
    }
  }

  const pipUpgrade = await runProcess(managedPython, ['-m', 'pip', 'install', '--upgrade', 'pip', 'wheel', 'setuptools'], {
    timeoutMs: 600000
  });
  outputParts.push(pipUpgrade.stdout, pipUpgrade.stderr);

  const installResult = await runProcess(managedPython, ['-m', 'pip', 'install', '--upgrade', 'pyscf'], {
    timeoutMs: 1200000
  });
  outputParts.push(installResult.stdout, installResult.stderr);

  const status = await getPyscfStatus();
  return {
    ok: installResult.exitCode === 0 && status.available,
    engine,
    engineLabel,
    status,
    outputTail: outputTail(outputParts.join('\n')),
    error: installResult.exitCode === 0 && status.available
      ? undefined
      : 'PySCF installation did not complete. Check the installer output and Python compatibility.'
  };
}

async function openLocalEngineFolder() {
  const root = localEnginesRoot();
  await fs.promises.mkdir(root, { recursive: true });
  const error = await shell.openPath(root);
  return { ok: !error, path: root, error: error || undefined };
}

async function runPyscfCalculation(request) {
  const startedAt = Date.now();
  const calculationMode = normalizeCalculationMode(request?.calculationMode);
  const method = sanitizeQuantumToken(request?.method) || 'B3LYP';
  const basisSet = sanitizeQuantumToken(request?.basisSet) || '6-31G';
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
    outputTail: ''
  };

  if (calculationMode !== 'single-point') {
    return {
      ...baseResult,
      elapsedMs: Date.now() - startedAt,
      error: 'The managed PySCF runner currently supports single-point DFT/HF analysis. Use xTB or an external engine for geometry optimization.'
    };
  }

  const pyscfCommand = await resolvePyscfPythonCommand();
  if (!pyscfCommand?.probe.available) {
    return {
      ...baseResult,
      elapsedMs: Date.now() - startedAt,
      error: 'PySCF is not installed. Install it from the Local Open-Source Engine Manager before running this engine.'
    };
  }

  const xyz = normalizeQuantumInput(request?.xyz);
  if (!xyz) {
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

    const processResult = await runProcess(pyscfCommand.executable, [...pyscfCommand.argsPrefix, scriptPath, inputPath], {
      cwd: workDir,
      timeoutMs,
      env: {
        ...process.env,
        PYTHONUTF8: '1'
      }
    });
    const output = `${processResult.stdout}\n${processResult.stderr}`.trim();
    const parsed = parsePyscfResult(output);
    const warnings = [...(parsed?.warnings || [])];

    if (processResult.timedOut) warnings.push('PySCF calculation timed out before completion.');
    if (!parsed) warnings.push('PySCF result JSON was not found in the calculation output.');
    if (parsed && parsed.energyHartree === null) warnings.push('Total energy was not found in the PySCF output.');
    if (parsed && !parsed.dipoleDebye) warnings.push('Dipole moment was not returned by PySCF.');
    if (parsed && parsed.charges.length === 0) warnings.push('Mulliken charges were not returned by PySCF.');

    return {
      ok: processResult.exitCode === 0 && Boolean(parsed),
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
      error: processResult.exitCode === 0 && parsed ? undefined : `PySCF exited with code ${processResult.exitCode}.`
    };
  } catch (error) {
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
  const candidates = [
    envCandidate,
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
  return String(process.env.PATH || '')
    .split(path.delimiter)
    .flatMap((directory) => names.map((name) => ({ executable: path.join(directory, name), root: directory, source: 'path' })));
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
  return normalizeExternalEngineConfig({
    ...DEFAULT_EXTERNAL_ENGINE_CONFIG[engine],
    ...(configs[engine] || {})
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

function localEnginesRoot() {
  return path.join(app.getPath('userData'), 'engines');
}

function pyscfPythonExecutable() {
  return process.platform === 'win32'
    ? path.join(localEnginesRoot(), 'pyscf', 'Scripts', 'python.exe')
    : path.join(localEnginesRoot(), 'pyscf', 'bin', 'python');
}

function normalizeExternalEngineConfig(value) {
  const engine = normalizeExternalEngineKind(value?.engine);
  const defaults = DEFAULT_EXTERNAL_ENGINE_CONFIG[engine];
  return {
    engine,
    executablePath: String(value?.executablePath || '').trim(),
    method: sanitizeQuantumToken(value?.method) || defaults.method,
    basisSet: sanitizeQuantumToken(value?.basisSet) || defaults.basisSet,
    routeOptions: sanitizeRouteOptions(value?.routeOptions || defaults.routeOptions || '')
  };
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
  return found;
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

mol = gto.M(atom=atoms, unit="Angstrom", basis=basis, charge=charge, spin=spin, verbose=0)
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
      env: options.env || process.env,
      windowsHide: true,
      shell: process.platform === 'win32' && /\.(cmd|bat)$/iu.test(executable)
    });
    const stdout = [];
    const stderr = [];
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
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
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        timedOut
      });
    });
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
  const inputPath = path.join(workDir, 'chemvault.gjf');
  const outputPath = path.join(workDir, 'chemvault.log');
  const routeParts = [
    '#p',
    `${options.method}/${options.basisSet}`,
    options.calculationMode === 'geometry-optimization' ? 'Opt' : 'SP',
    options.routeOptions
  ].filter(Boolean);
  const content = [
    '%chk=chemvault.chk',
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
  return { args: [inputPath], outputPath };
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
  const content = [
    commandParts.join(' '),
    '%pal nprocs 4 end',
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

async function readOptionalText(filePath) {
  try {
    return await fs.promises.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeCalculationMode(value) {
  return value === 'geometry-optimization' ? 'geometry-optimization' : 'single-point';
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
  const matches = Array.from(output.matchAll(/SCF\s+Done:\s+E\([^)]+\)\s+=\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/giu));
  const last = matches.at(-1);
  return last ? Number(last[1]) : null;
}

function parseGaussianDipole(output) {
  const matches = Array.from(output.matchAll(/X=\s*([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)\s+Y=\s*([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)\s+Z=\s*([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)\s+Tot=\s*([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/giu));
  const last = matches.at(-1);
  return last
    ? {
        x: Number(last[1]),
        y: Number(last[2]),
        z: Number(last[3]),
        total: Number(last[4])
      }
    : null;
}

function parseGaussianCharges(output) {
  const section = output.match(/Mulliken\s+charges:[\s\S]*?(?:Sum\s+of\s+Mulliken\s+charges|Dipole moment|Quadrupole moment|Job cpu time)/iu)?.[0] || '';
  const charges = [];
  for (const match of section.matchAll(/^\s*(\d+)\s+([A-Za-z]{1,2})\s+([-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?)/gmu)) {
    charges.push({
      index: Number(match[1]),
      element: match[2],
      charge: Number(match[3])
    });
  }
  return charges;
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
