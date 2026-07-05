const { app, BrowserWindow, shell } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const APP_TITLE = 'ChemVault Model';
const DEFAULT_API_BASE = 'https://model.chemvault.science/api/chem';
const DEFAULT_START_PATH = '/molecule/';

let mainWindow = null;
let staticServer = null;

app.setName(APP_TITLE);

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

process.on('uncaughtException', (error) => {
  console.error(error);
});

process.on('unhandledRejection', (error) => {
  console.error(error);
});
