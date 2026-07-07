const { app, BrowserWindow, ipcMain, shell } = require('electron');
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

let mainWindow = null;
let staticServer = null;
const userCookieJar = new Map();

app.setName(APP_TITLE);

ipcMain.handle('quantum:engine-status', async () => getQuantumEngineStatus());
ipcMain.handle('quantum:run', async (_event, request) => runQuantumCalculation(request));

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

async function getQuantumEngineStatus() {
  const engine = resolveXtbEngine();
  if (!engine) {
    return {
      available: false,
      engine: 'xTB',
      method: 'GFN2-xTB',
      message: 'xTB engine was not found. Install xTB, set CHEMVAULT_XTB_PATH, or bundle it under desktop/quantum/xtb before building.'
    };
  }

  const versionResult = await runProcess(engine.executable, ['--version'], { timeoutMs: 10000, env: buildXtbEnv(engine) });
  return {
    available: true,
    engine: 'xTB',
    method: 'GFN2-xTB',
    executable: engine.executable,
    source: engine.source,
    version: extractVersion(`${versionResult.stdout}\n${versionResult.stderr}`),
    message: 'xTB engine is ready.'
  };
}

async function runQuantumCalculation(request) {
  const startedAt = Date.now();
  const engine = resolveXtbEngine();
  const calculationMode = normalizeCalculationMode(request?.calculationMode);
  const baseResult = {
    ok: false,
    engine: 'xTB',
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
      engine: 'xTB',
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
