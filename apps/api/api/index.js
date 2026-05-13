const Module = require('module');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const dbPackagePath = path.join(__dirname, '../../../packages/db/dist/index.js');
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '@fireslot/db') return originalLoad(dbPackagePath, parent, isMain);
  return originalLoad(request, parent, isMain);
};

let serverPromise;
let prismaClient;

const downloadDirs = [
  path.join(__dirname, '../public/downloads'),
  path.join(process.cwd(), 'public/downloads'),
  path.join(__dirname, '../../../public/downloads'),
];

const bannerDirs = [
  path.join(__dirname, '../public/banners'),
  path.join(process.cwd(), 'public/banners'),
  path.join(__dirname, '../../../public/banners'),
  path.join(__dirname, '../../web/public/banners'),
];

const fastCache = new Map();
const fastPending = new Map();
const FAST_SOFT_TTL_MS = 10_000;
const FAST_HARD_TTL_MS = 60_000;

const APP_CONFIG_DEFAULTS = {
  MAINTENANCE_MODE: 'false',
  APP_MAINTENANCE_ENABLED: 'false',
  APP_MAINTENANCE_MESSAGE: 'FireSlot Nepal is updating. Please try again soon.',
  APP_ANNOUNCEMENT_ACTIVE: 'false',
  APP_ANNOUNCEMENT_TEXT: '',
  APP_ANNOUNCEMENT_COLOR: '#E53935',
  APP_FORCE_UPDATE_ENABLED: 'false',
  APP_MIN_ANDROID_VERSION: '1.0.0',
  APP_LATEST_VERSION: '1.0.0',
  APP_API_URL: '',
  APP_PUBLIC_WEB_URL: '',
  APP_DOWNLOAD_ENABLED: 'true',
  APP_SUPPORT_URL: '/support',
};

const TOURNAMENT_LIST_SELECT = {
  id: true,
  title: true,
  description: true,
  mode: true,
  map: true,
  type: true,
  entryFeeNpr: true,
  registrationFeeNpr: true,
  prizePoolNpr: true,
  perKillPrizeNpr: true,
  firstPrize: true,
  secondPrize: true,
  thirdPrize: true,
  fourthToTenthPrize: true,
  maxSlots: true,
  filledSlots: true,
  dateTime: true,
  status: true,
  killPrize: true,
  prizeStructure: true,
  perKillReward: true,
  booyahPrize: true,
  actualPlayers: true,
  roomLocked: true,
  roomLockedAt: true,
  createdAt: true,
  updatedAt: true,
};

const PLAYER_SELECT = {
  id: true,
  name: true,
  email: true,
  profile: {
    select: {
      ign: true,
      level: true,
      avatarUrl: true,
    },
  },
};

const CHALLENGE_LIST_SELECT = {
  id: true,
  challengeNumber: true,
  creatorId: true,
  opponentId: true,
  title: true,
  gameMode: true,
  entryFee: true,
  prizeToWinner: true,
  platformFee: true,
  status: true,
  brMap: true,
  brTeamMode: true,
  brWinCondition: true,
  brTargetKills: true,
  brBannedGuns: true,
  brHeadshotOnly: true,
  csTeamMode: true,
  csRounds: true,
  csCoins: true,
  csThrowable: true,
  csLoadout: true,
  csCompulsoryWeapon: true,
  csCompulsoryArmour: true,
  characterSkill: true,
  gunAttribute: true,
  headshotOnly: true,
  noEmulator: true,
  minLevel: true,
  maxHeadshotRate: true,
  povRequired: true,
  screenshotRequired: true,
  reportWindowMins: true,
  scheduledAt: true,
  startedAt: true,
  endedAt: true,
  winnerId: true,
  createdAt: true,
  updatedAt: true,
  creator: { select: PLAYER_SELECT },
};

function getPrisma() {
  if (prismaClient) return prismaClient;
  const db = require('@fireslot/db');
  prismaClient = db.prisma ?? new db.PrismaClient();
  return prismaClient;
}

function parseLimit(value, fallback, max) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
}

function parseNumber(value) {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getCorsOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return '*';

  const configured = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  if (!configured.length || configured.includes('*')) return origin;
  const normalized = origin.replace(/\/+$/, '');
  return configured.includes(normalized) ? origin : null;
}

function setCorsHeaders(req, res) {
  const origin = getCorsOrigin(req);
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, If-None-Match');
}

function sendJson(req, res, status, data, start, cacheControl) {
  setCorsHeaders(req, res);
  const requestId = req.headers['x-request-id'] || randomUUID();
  const responseTime = Date.now() - start;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Request-ID', requestId);
  res.setHeader('X-Response-Time', `${responseTime}ms`);
  if (cacheControl) res.setHeader('Cache-Control', cacheControl);
  if (req.method === 'HEAD') return res.end();

  res.end(JSON.stringify({
    success: status >= 200 && status < 400,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
      responseTime,
      fastPath: true,
    },
  }));
}

function stableSearchKey(url) {
  const params = [...url.searchParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return params ? `${url.pathname}?${params}` : url.pathname;
}

async function getFastCached(key, loader) {
  const now = Date.now();
  const cached = fastCache.get(key);
  if (cached && cached.hardExpiresAt > now) {
    if (cached.softExpiresAt <= now && !fastPending.has(key)) {
      const refresh = loader()
        .then((value) => setFastCache(key, value))
        .catch(() => undefined)
        .finally(() => fastPending.delete(key));
      fastPending.set(key, refresh);
    }
    return cached.value;
  }

  const pending = fastPending.get(key);
  if (pending) return pending;

  const promise = loader()
    .then((value) => setFastCache(key, value))
    .finally(() => fastPending.delete(key));
  fastPending.set(key, promise);
  return promise;
}

function setFastCache(key, value) {
  const now = Date.now();
  fastCache.set(key, {
    value,
    softExpiresAt: now + FAST_SOFT_TTL_MS,
    hardExpiresAt: now + FAST_HARD_TTL_MS,
  });
  if (fastCache.size > 200) fastCache.delete(fastCache.keys().next().value);
  return value;
}

function challengeRulesText(c) {
  const lines = [];
  if (c.gameMode === 'CS') {
    lines.push(`Team Mode: ${c.csTeamMode ?? '-'} | Rounds: ${c.csRounds} | Coins: ${c.csCoins}`);
    lines.push(
      `Throwable: ${c.csThrowable ? 'Yes' : 'No'} | Character Skill: ${c.characterSkill ? 'Yes' : 'No'} | Gun Attribute: ${c.gunAttribute ? 'Yes' : 'No'}`,
    );
    lines.push(`Headshot Only: ${c.headshotOnly ? 'Yes' : 'No'} | Loadout: ${c.csLoadout ? 'Yes' : 'No'}`);
    if (c.csCompulsoryWeapon && c.csCompulsoryWeapon !== 'NONE') lines.push(`Compulsory Weapon: ${c.csCompulsoryWeapon}`);
    if (c.csCompulsoryArmour && c.csCompulsoryArmour !== 'NONE') lines.push(`Compulsory Armour: ${c.csCompulsoryArmour}`);
  } else {
    lines.push(`Map: ${c.brMap ?? '-'} | Mode: ${c.brTeamMode ?? '-'} | Win: ${c.brWinCondition ?? '-'}`);
    if (c.brWinCondition === 'FIRST_TO_N_KILLS' && c.brTargetKills) lines.push(`Target: First to ${c.brTargetKills} kills`);
    if (c.brBannedGuns?.length) lines.push(`Banned Guns: ${c.brBannedGuns.join(', ')}`);
    if (c.brHeadshotOnly) lines.push('HEADSHOT ONLY MODE');
  }

  lines.push('-');
  if (c.noEmulator) lines.push('No emulator allowed');
  if (c.povRequired) lines.push('POV recording mandatory');
  if (c.screenshotRequired) lines.push('Screenshot required for result submission');
  lines.push(`Disputes must be raised within ${c.reportWindowMins} minutes`);
  lines.push('Hacker proof + recording = auto disqualification of hacker');
  if (c.minLevel > 0) lines.push(`Minimum Level: ${c.minLevel}`);
  if (c.maxHeadshotRate < 100) lines.push(`Max Headshot Rate: ${c.maxHeadshotRate}%`);
  return lines.join('\n');
}

async function loadFastTournaments(url) {
  const where = {};
  const mode = url.searchParams.get('mode');
  const status = url.searchParams.get('status');
  const type = url.searchParams.get('type');
  const minFee = parseNumber(url.searchParams.get('minFee'));
  const maxFee = parseNumber(url.searchParams.get('maxFee'));
  if (mode) where.mode = mode;
  if (status) where.status = status;
  if (type) where.type = type;
  if (minFee !== undefined || maxFee !== undefined) {
    where.entryFeeNpr = {};
    if (minFee !== undefined) where.entryFeeNpr.gte = minFee;
    if (maxFee !== undefined) where.entryFeeNpr.lte = maxFee;
  }

  return getPrisma().tournament.findMany({
    where,
    select: TOURNAMENT_LIST_SELECT,
    orderBy: { dateTime: 'asc' },
    take: parseLimit(url.searchParams.get('limit'), 100, 200),
  });
}

async function loadFastCategories() {
  const prisma = getPrisma();
  const top = await prisma.gameCategory.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      coverUrl: true,
      isActive: true,
      comingSoon: true,
      sortOrder: true,
    },
  });
  const activeIds = top.filter((t) => t.isActive).map((t) => t.id);
  const allChildren = activeIds.length
    ? await prisma.gameCategory.findMany({
        where: { parentId: { in: activeIds }, isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          parentId: true,
          name: true,
          slug: true,
          gameMode: true,
          description: true,
          sortOrder: true,
        },
      })
    : [];
  const childrenByParent = new Map();
  for (const child of allChildren) {
    const group = childrenByParent.get(child.parentId) ?? [];
    group.push({
      id: child.id,
      name: child.name,
      slug: child.slug,
      gameMode: child.gameMode,
      description: child.description,
      sortOrder: child.sortOrder,
    });
    childrenByParent.set(child.parentId, group);
  }

  return top.map((t) => ({
    ...t,
    children: t.isActive ? childrenByParent.get(t.id) ?? [] : [],
  }));
}

async function loadFastChallenges(url) {
  const where = { isPrivate: false };
  const gameMode = url.searchParams.get('gameMode');
  const status = url.searchParams.get('status');
  if (gameMode) where.gameMode = gameMode;
  where.status = status || 'OPEN';

  const items = await getPrisma().challenge.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: CHALLENGE_LIST_SELECT,
    take: parseLimit(url.searchParams.get('limit'), 50, 100),
  });
  return items.map((c) => ({ ...c, rulesText: challengeRulesText(c) }));
}

async function loadFastLatestRelease() {
  const r = await getPrisma().appRelease.findFirst({
    where: { isLatest: true },
    orderBy: { createdAt: 'desc' },
    select: {
      version: true,
      releaseNotes: true,
      filename: true,
      fileSizeBytes: true,
      sha256: true,
      publishedAt: true,
      testStatus: true,
    },
  });
  if (!r) return null;
  const cleanFilename = String(r.filename || '').replace(/^\/+/, '');
  const downloadUrl = cleanFilename.startsWith('http')
    ? cleanFilename
    : cleanFilename.startsWith('downloads/')
      ? `/${cleanFilename}`
      : `/downloads/${cleanFilename}`;
  return {
    version: r.version,
    releaseNotes: r.releaseNotes,
    downloadUrl,
    fileSizeBytes: r.fileSizeBytes,
    sha256: r.sha256,
    publishedAt: r.publishedAt,
    testStatus: r.testStatus,
  };
}

function normalizeDownloadPath(value) {
  if (!value) return null;
  const clean = String(value).trim().replace(/^\/+/, '').replace(/^(downloads\/)+/, '');
  return clean ? `/downloads/${clean}` : null;
}

function absoluteDownloadUrl(downloadUrl, apiUrl) {
  if (!downloadUrl) return null;
  if (/^https?:\/\//i.test(downloadUrl)) return downloadUrl;
  const pathOnly = normalizeDownloadPath(downloadUrl);
  if (!pathOnly) return null;
  const apiBase = cleanUrl(apiUrl)?.replace(/\/api$/, '');
  return apiBase ? `${apiBase}${pathOnly}` : pathOnly;
}

function cleanUrl(value) {
  return String(value ?? '').trim().replace(/\/+$/, '') || null;
}

function normalizeApiUrl(value) {
  const clean = cleanUrl(value);
  if (!clean) return null;
  return clean.endsWith('/api') ? clean : `${clean}/api`;
}

function isLocalUrl(value) {
  try {
    const host = new URL(normalizeApiUrl(value) || value).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
  } catch {
    return false;
  }
}

function inferApiUrl(req) {
  const host = cleanUrl(req.headers['x-forwarded-host'] || req.headers.host);
  if (!host) return null;
  const proto = cleanUrl(req.headers['x-forwarded-proto']) || 'https';
  return normalizeApiUrl(`${proto.split(',')[0]}://${host.split(',')[0]}`);
}

function inferWebUrl(req) {
  const origin = cleanUrl(req.headers.origin);
  if (origin) return origin;
  const referer = cleanUrl(req.headers.referer);
  if (!referer) return cleanUrl(process.env.NEXT_PUBLIC_APP_URL);
  try {
    return cleanUrl(new URL(referer).origin);
  } catch {
    return cleanUrl(process.env.NEXT_PUBLIC_APP_URL);
  }
}

async function loadFastAppConfig(req) {
  let configs = {};
  try {
    const systemRows = await getPrisma().systemConfig.findMany({
      where: { key: { in: Object.keys(APP_CONFIG_DEFAULTS) } },
      select: { key: true, value: true },
    });
    let appRows = [];
    try {
      appRows = await getPrisma().appConfig.findMany({
        where: { key: { in: Object.keys(APP_CONFIG_DEFAULTS) } },
        select: { key: true, value: true },
      });
    } catch {
      appRows = [];
    }
    configs = {
      ...Object.fromEntries(systemRows.map((row) => [row.key, row.value])),
      ...Object.fromEntries(appRows.map((row) => [row.key, row.value])),
    };
  } catch {
    configs = {};
  }

  const get = (key) => configs[key] ?? APP_CONFIG_DEFAULTS[key] ?? '';
  const bool = (key) => String(get(key)).toLowerCase() === 'true';
  const latest = await loadFastLatestRelease().catch(() => null);
  const configuredApi = cleanUrl(get('APP_API_URL')) || cleanUrl(process.env.NEXT_PUBLIC_API_URL);
  const inferredApi = inferApiUrl(req);
  const api = configuredApi && !isLocalUrl(configuredApi) ? normalizeApiUrl(configuredApi) : inferredApi || normalizeApiUrl(configuredApi);
  const configuredWeb = cleanUrl(get('APP_PUBLIC_WEB_URL')) || cleanUrl(process.env.NEXT_PUBLIC_APP_URL);
  const inferredWeb = inferWebUrl(req);
  const publicWeb = configuredWeb && !isLocalUrl(configuredWeb) ? configuredWeb : inferredWeb || configuredWeb;
  const downloadUrl = absoluteDownloadUrl(latest?.downloadUrl, api);
  return {
    maintenance: {
      enabled: bool('APP_MAINTENANCE_ENABLED') || bool('MAINTENANCE_MODE'),
      message: get('APP_MAINTENANCE_MESSAGE'),
    },
    announcement: {
      active: bool('APP_ANNOUNCEMENT_ACTIVE'),
      text: get('APP_ANNOUNCEMENT_TEXT'),
      color: get('APP_ANNOUNCEMENT_COLOR'),
    },
    update: {
      force: bool('APP_FORCE_UPDATE_ENABLED'),
      minAndroidVersion: get('APP_MIN_ANDROID_VERSION'),
      latestVersion: latest?.version ?? get('APP_LATEST_VERSION'),
      downloadEnabled: bool('APP_DOWNLOAD_ENABLED'),
      downloadUrl,
    },
    urls: {
      api,
      publicWeb,
      support: get('APP_SUPPORT_URL'),
    },
    native: {
      loadMode: process.env.CAPACITOR_SERVER_URL ? 'remote' : 'bundled',
    },
  };
}

async function handleFastPath(req, res, start) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res);
    res.statusCode = 204;
    res.end();
    return true;
  }

  const url = new URL(req.url ?? '/', 'http://localhost');
  const isRead = req.method === 'GET' || req.method === 'HEAD';
  if (!isRead) return false;

  if (url.pathname === '/api/health/live' || url.pathname === '/health/live') {
    sendJson(req, res, 200, { ok: true }, start, 'public, max-age=5');
    return true;
  }

  let loader;
  if (url.pathname === '/api/tournaments') loader = () => loadFastTournaments(url);
  else if (url.pathname === '/api/categories') loader = loadFastCategories;
  else if (url.pathname === '/api/challenges') loader = () => loadFastChallenges(url);
  else if (url.pathname === '/api/app/latest-release') loader = loadFastLatestRelease;
  else if (url.pathname === '/api/app/config') {
    const data = await loadFastAppConfig(req);
    sendJson(req, res, 200, data, start, 'no-store');
    return true;
  }
  else return false;

  const key = `fast:${stableSearchKey(url)}`;
  const data = await getFastCached(key, loader);
  sendJson(req, res, 200, data, start, 'public, s-maxage=10, stale-while-revalidate=60');
  return true;
}

function serveDownload(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (!url.pathname.startsWith('/downloads/')) return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;

  let filename;
  try {
    filename = decodeURIComponent(url.pathname.slice('/downloads/'.length));
  } catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'Invalid download path' }));
    return true;
  }
  filename = filename.replace(/^(downloads\/)+/, "");

  if (!/^[A-Za-z0-9._-]+$/.test(filename) || filename.includes('..')) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'Invalid download path' }));
    return true;
  }

  const filePath = downloadDirs
    .map((dir) => path.join(dir, filename))
    .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());

  if (!filePath) return false;

  const stat = fs.statSync(filePath);
  res.statusCode = 200;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Content-Type',
    filename.endsWith('.apk') ? 'application/vnd.android.package-archive' : 'application/octet-stream',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'HEAD') {
    res.end();
    return true;
  }

  fs.createReadStream(filePath).pipe(res);
  return true;
}

function serveBanner(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (!url.pathname.startsWith('/banners/')) return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;

  let filename;
  try {
    filename = decodeURIComponent(url.pathname.slice('/banners/'.length));
  } catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'Invalid banner path' }));
    return true;
  }

  if (!/^[A-Za-z0-9._-]+$/.test(filename) || filename.includes('..')) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'Invalid banner path' }));
    return true;
  }

  const filePath = bannerDirs
    .map((dir) => path.join(dir, filename))
    .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());

  if (!filePath) return false;

  const stat = fs.statSync(filePath);
  const ext = path.extname(filename).toLowerCase();
  const type =
    ext === '.svg'
      ? 'image/svg+xml'
      : ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : 'image/jpeg';
  res.statusCode = 200;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');

  if (req.method === 'HEAD') {
    res.end();
    return true;
  }

  fs.createReadStream(filePath).pipe(res);
  return true;
}

async function getServer() {
  if (serverPromise) return serverPromise;
  serverPromise = (async () => {
    const { createApp } = require('../dist/main');
    const app = await createApp();
    await app.init();
    return app.getHttpAdapter().getInstance();
  })();
  return serverPromise;
}

module.exports = async function handler(req, res) {
  const start = Date.now();
  try {
    if (serveDownload(req, res)) return;
    if (serveBanner(req, res)) return;

    try {
      if (await handleFastPath(req, res, start)) return;
    } catch (err) {
      console.warn('Fast path skipped:', err?.message ?? err);
    }

    const server = await getServer();
    return server(req, res);
  } catch (err) {
    console.error('API bootstrap failed:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'API bootstrap failed', error: String(err?.message ?? err) }));
  }
};
