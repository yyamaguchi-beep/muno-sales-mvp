import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { getConfig } from "./src/config.js";
import { JsonStore } from "./src/storage.js";
import { readBody, parseCookies, parseForm, redirect, send, sendJson, signSession, verifySession } from "./src/http.js";
import { verifyLineSignature, downloadLineImage, replyLine, buildLineReply } from "./src/line.js";
import { analyzeSalesScreenshot } from "./src/openaiVision.js";
import { approveSale, getDashboard, registerManualSale, registerScreenshotSale, updateSale, voidSale } from "./src/salesService.js";
import { GoogleSheetsClient } from "./src/googleSheets.js";
import { dashboardView, editSaleView, loginView, newSaleView } from "./src/views.js";

const rootDir = process.cwd();
const config = getConfig(rootDir);
const store = new JsonStore(rootDir, { dataDir: config.dataDir, uploadDir: config.uploadDir });
await store.init();
const sheets = new GoogleSheetsClient(config, store);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, config.baseUrl || `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, { ok: true, service: "muno-sales-mvp", time: new Date().toISOString() });
    }
    if (req.method === "GET" && url.pathname.startsWith("/public/")) return servePublic(res, url.pathname);
    if (req.method === "POST" && url.pathname === "/api/line/webhook") return handleLineWebhook(req, res);

    const session = currentSession(req);
    if (req.method === "GET" && url.pathname === "/login") return send(res, 200, loginView(), htmlHeaders());
    if (req.method === "POST" && url.pathname === "/login") return handleLogin(req, res);
    if (req.method === "POST" && url.pathname === "/logout") return logout(res);

    if (!session) return redirect(res, "/login");
    if (!["owner", "manager"].includes(session.role)) return send(res, 403, "権限がありません", textHeaders());

    if (req.method === "GET" && url.pathname.startsWith("/uploads/")) return serveUpload(res, url.pathname);
    if (req.method === "GET" && url.pathname === "/") return redirect(res, "/admin");
    if (req.method === "GET" && url.pathname === "/admin") {
      return send(res, 200, dashboardView({ dashboard: await getDashboard(store), user: session.user }), htmlHeaders());
    }
    if (req.method === "GET" && url.pathname === "/admin/new") {
      return send(res, 200, newSaleView({ user: session.user }), htmlHeaders());
    }
    if (req.method === "POST" && url.pathname === "/admin/new") {
      const sale = await registerManualSale({ store, form: parseForm(await readBody(req)), actor: session.user });
      return redirect(res, `/admin/sales/${sale.id}`);
    }

    const saleMatch = url.pathname.match(/^\/admin\/sales\/([^/]+)$/);
    if (req.method === "GET" && saleMatch) {
      const db = await store.read();
      const sale = db.sales.find((item) => item.id === saleMatch[1] && item.active !== false);
      if (!sale) return send(res, 404, "not found", textHeaders());
      const products = db.productSales.filter((item) => item.sale_id === sale.id);
      return send(res, 200, editSaleView({ sale, products, user: session.user }), htmlHeaders());
    }

    const actionMatch = url.pathname.match(/^\/admin\/sales\/([^/]+)\/(update|approve|void)$/);
    if (req.method === "POST" && actionMatch) {
      const [, id, action] = actionMatch;
      if (action === "update") {
        await updateSale({ store, id, patch: parseForm(await readBody(req)), actor: session.user });
        return redirect(res, `/admin/sales/${id}`);
      }
      if (action === "approve") {
        await approveSale({ store, id, actor: session.user, sheets });
        return redirect(res, `/admin/sales/${id}`);
      }
      await voidSale({ store, id, actor: session.user });
      return redirect(res, "/admin");
    }

    return sendJson(res, 404, { ok: false, error: "Not Found" });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { ok: false, error: "Internal Server Error", detail: error.message });
  }
});

server.listen(config.port, () => {
  console.log(`müno sales MVP running on port ${config.port}`);
});

async function handleLineWebhook(req, res) {
  const rawBody = await readBody(req);
  const signature = req.headers["x-line-signature"];

  let body = {};
  try {
    body = rawBody.length ? JSON.parse(rawBody.toString("utf8")) : {};
  } catch {
    return sendJson(res, 400, { ok: false, error: "Invalid JSON body" });
  }

  if ((body.events || []).length === 0) return sendJson(res, 200, { ok: true, message: "Webhook verification received" });
  if (!verifyLineSignature(rawBody, signature, config.lineChannelSecret)) {
    return sendJson(res, 401, { ok: false, error: "Invalid LINE signature" });
  }

  for (const event of body.events || []) {
    if (event.type !== "message" || event.message?.type !== "image") continue;
    try {
      const image = await downloadLineImage(event.message.id, config);
      const upload = await store.saveUpload(image.buffer, image.extension);
      const sourceImageUrl = `${config.baseUrl}/uploads/${upload.fileName}`;
      const visionResult = await analyzeSalesScreenshot({ filePath: upload.filePath, contentType: image.contentType, config });
      const sale = await registerScreenshotSale({
        store,
        visionResult,
        sourceImageUrl,
        sourceLineUserId: event.source?.userId || ""
      });
      await replyLine(event.replyToken, buildLineReply(sale), config);
    } catch (error) {
      console.error(error);
      await replyLine(event.replyToken, `スクショ処理に失敗しました。\n管理者に確認してください。\n${error.message}`, config).catch(console.error);
    }
  }

  return sendJson(res, 200, { ok: true });
}

async function handleLogin(req, res) {
  const form = parseForm(await readBody(req));
  const user = config.users.find((item) => item.user === form.user && item.password === form.password);
  if (!user) return send(res, 401, loginView("ログインできません。IDとパスワードを確認してください。"), htmlHeaders());
  const token = signSession(`${user.user}|${user.role}`, config.sessionSecret);
  res.writeHead(303, {
    Location: "/admin",
    "Set-Cookie": `muno_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`
  });
  res.end();
}

function logout(res) {
  res.writeHead(303, {
    Location: "/login",
    "Set-Cookie": "muno_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
  });
  res.end();
}

function currentSession(req) {
  const value = verifySession(parseCookies(req).muno_session, config.sessionSecret);
  if (!value) return null;
  const [user, role = "staff"] = value.split("|");
  return { user, role };
}

async function servePublic(res, pathname) {
  const filePath = path.join(rootDir, "public", path.basename(pathname));
  const body = await fs.readFile(filePath);
  const type = filePath.endsWith(".css") ? "text/css; charset=utf-8" : "application/octet-stream";
  return send(res, 200, body, { "Content-Type": type });
}

async function serveUpload(res, pathname) {
  const filePath = path.join(store.uploadDir, path.basename(pathname));
  const body = await fs.readFile(filePath);
  const type = filePath.endsWith(".png") ? "image/png" : "image/jpeg";
  return send(res, 200, body, { "Content-Type": type, "Cache-Control": "private, max-age=3600" });
}

function htmlHeaders() {
  return { "Content-Type": "text/html; charset=utf-8" };
}

function textHeaders() {
  return { "Content-Type": "text/plain; charset=utf-8" };
}
