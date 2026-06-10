import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { getConfig } from "./src/config.js";
import { JsonStore } from "./src/storage.js";
import { parseCookies, parseForm, readBody, redirect, send, signSession, verifySession } from "./src/http.js";
import { verifyLineSignature, downloadLineImage, replyLine, buildLineReply } from "./src/line.js";
import { analyzeLineText, analyzeSalesScreenshot } from "./src/openaiVision.js";
import {
  approveEntity,
  createAttendanceFromForm,
  createCompensationRule,
  createEventSchedule,
  createLineReport,
  createProject,
  createSalesPerson,
  createSalesReportFromForm,
  getDashboard,
  voidEntity
} from "./src/salesService.js";
import { GoogleSheetsClient } from "./src/googleSheets.js";
import {
  compensationRulesView,
  dashboardView,
  eventsView,
  loginView,
  projectsView,
  reportsView,
  reviewView,
  salesPeopleView
} from "./src/views.js";

const rootDir = process.cwd();
const config = getConfig(rootDir);
const store = new JsonStore(rootDir, { dataDir: config.dataDir, uploadDir: config.uploadDir });
await store.init();
const sheets = new GoogleSheetsClient(config, store);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, config.baseUrl);
    if (req.method === "GET" && url.pathname === "/health") return send(res, 200, "ok");
    if (req.method === "GET" && url.pathname.startsWith("/public/")) return servePublic(res, url.pathname);
    if (req.method === "GET" && url.pathname.startsWith("/uploads/")) return serveUpload(res, url.pathname);
    if (req.method === "POST" && url.pathname === "/api/line/webhook") return handleLineWebhook(req, res);

    const session = currentSession(req);
    if (req.method === "GET" && url.pathname === "/login") return send(res, 200, loginView(), htmlHeaders());
    if (req.method === "POST" && url.pathname === "/login") return handleLogin(req, res);
    if (req.method === "POST" && url.pathname === "/logout") return logout(res);
    if (!session) return redirect(res, "/login");
    if (!["owner", "manager"].includes(session.role)) return send(res, 403, "権限がありません", textHeaders());

    if (req.method === "GET" && url.pathname === "/") return redirect(res, "/admin");
    if (req.method === "GET" && url.pathname === "/admin") {
      return send(res, 200, dashboardView({ dashboard: await getDashboard(store), user: session.user }), htmlHeaders());
    }

    if (req.method === "GET" && url.pathname === "/admin/sales-people") {
      return send(res, 200, salesPeopleView({ db: await store.read(), user: session.user }), htmlHeaders());
    }
    if (req.method === "POST" && url.pathname === "/admin/sales-people") {
      await createSalesPerson({ store, form: parseForm(await readBody(req)), actor: session.user });
      return redirect(res, "/admin/sales-people");
    }

    if (req.method === "GET" && url.pathname === "/admin/compensation-rules") {
      return send(res, 200, compensationRulesView({ db: await store.read(), user: session.user }), htmlHeaders());
    }
    if (req.method === "POST" && url.pathname === "/admin/compensation-rules") {
      await createCompensationRule({ store, form: parseForm(await readBody(req)), actor: session.user });
      return redirect(res, "/admin/compensation-rules");
    }

    if (req.method === "GET" && url.pathname === "/admin/events") {
      return send(res, 200, eventsView({ db: await store.read(), user: session.user }), htmlHeaders());
    }
    if (req.method === "POST" && url.pathname === "/admin/events") {
      await createEventSchedule({ store, form: parseForm(await readBody(req)), actor: session.user });
      return redirect(res, "/admin/events");
    }

    if (req.method === "GET" && url.pathname === "/admin/reports") {
      return send(res, 200, reportsView({ db: await store.read(), user: session.user }), htmlHeaders());
    }
    if (req.method === "POST" && url.pathname === "/admin/reports/attendance") {
      await createAttendanceFromForm({ store, form: parseForm(await readBody(req)), actor: session.user });
      return redirect(res, "/admin/reports");
    }
    if (req.method === "POST" && url.pathname === "/admin/reports/sales") {
      await createSalesReportFromForm({ store, form: parseForm(await readBody(req)), actor: session.user });
      return redirect(res, "/admin/reports");
    }

    if (req.method === "GET" && url.pathname === "/admin/projects") {
      return send(res, 200, projectsView({ db: await store.read(), user: session.user }), htmlHeaders());
    }
    if (req.method === "POST" && url.pathname === "/admin/projects") {
      await createProject({ store, form: parseForm(await readBody(req)), actor: session.user });
      return redirect(res, "/admin/projects");
    }

    if (req.method === "GET" && url.pathname === "/admin/review") {
      return send(res, 200, reviewView({ dashboard: await getDashboard(store), user: session.user }), htmlHeaders());
    }

    const reviewMatch = url.pathname.match(/^\/admin\/review\/([^/]+)\/([^/]+)\/(approve|void)$/);
    if (req.method === "POST" && reviewMatch) {
      const [, table, id, action] = reviewMatch;
      if (action === "approve") {
        const row = await approveEntity({ store, table, id, actor: session.user });
        await sheets.syncApprovedRecord(table, row);
      } else {
        await voidEntity({ store, table, id, actor: session.user });
      }
      return redirect(res, "/admin/review");
    }

    return send(res, 404, "not found", textHeaders());
  } catch (error) {
    console.error(error);
    return send(res, 500, `Internal Server Error\n${error.message}`, textHeaders());
  }
});

server.listen(config.port, () => {
  console.log(`RIGELUS solar management running at http://localhost:${config.port}`);
});

async function handleLineWebhook(req, res) {
  const rawBody = await readBody(req);
  const signature = req.headers["x-line-signature"];
  if (!verifyLineSignature(rawBody, signature, config.lineChannelSecret)) return send(res, 401, "invalid signature", textHeaders());

  const body = JSON.parse(rawBody.toString("utf8"));
  for (const event of body.events || []) {
    if (event.type !== "message") continue;
    try {
      if (event.message?.type === "text") {
        const parseResult = await analyzeLineText({
          text: event.message.text,
          sourceLineUserId: event.source?.userId || "",
          config
        });
        const result = await createLineReport({ store, parseResult, sourceLineUserId: event.source?.userId || "" });
        await replyLine(event.replyToken, buildLineReply(result), config);
      }
      if (event.message?.type === "image") {
        const image = await downloadLineImage(event.message.id, config);
        const upload = await store.saveUpload(image.buffer, image.extension);
        const parseResult = await analyzeSalesScreenshot({ filePath: upload.filePath, contentType: image.contentType, config });
        parseResult.data.memo = `${parseResult.data.memo || ""}\n画像URL: ${config.baseUrl}/uploads/${upload.fileName}`.trim();
        const result = await createLineReport({ store, parseResult, sourceLineUserId: event.source?.userId || "" });
        await replyLine(event.replyToken, buildLineReply(result), config);
      }
    } catch (error) {
      console.error(error);
      await replyLine(event.replyToken, `報告の処理に失敗しました。\n管理者に確認してください。\n${error.message}`, config).catch((replyError) => console.error(replyError));
    }
  }
  return send(res, 200, "ok", textHeaders());
}

async function handleLogin(req, res) {
  const form = parseForm(await readBody(req));
  const user = config.users.find((item) => item.user === form.user && item.password === form.password);
  if (!user) return send(res, 401, loginView("ログインできません。IDとパスワードを確認してください。"), htmlHeaders());
  const token = signSession(`${user.user}|${user.role}`, config.sessionSecret);
  res.writeHead(303, {
    Location: "/admin",
    "Set-Cookie": `rigelus_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`
  });
  res.end();
}

function logout(res) {
  res.writeHead(303, {
    Location: "/login",
    "Set-Cookie": "rigelus_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
  });
  res.end();
}

function currentSession(req) {
  const cookies = parseCookies(req);
  const value = verifySession(cookies.rigelus_session, config.sessionSecret);
  if (!value) return null;
  const [user, role = "staff"] = value.split("|");
  return { user, role };
}

async function servePublic(res, pathname) {
  const fileName = path.basename(pathname);
  const filePath = path.join(rootDir, "public", fileName);
  const body = await fs.readFile(filePath);
  const type = fileName.endsWith(".css") ? "text/css; charset=utf-8" : "application/octet-stream";
  return send(res, 200, body, { "Content-Type": type });
}

async function serveUpload(res, pathname) {
  const fileName = path.basename(pathname);
  const filePath = path.join(store.uploadDir, fileName);
  const body = await fs.readFile(filePath);
  const type = fileName.endsWith(".png") ? "image/png" : "image/jpeg";
  return send(res, 200, body, { "Content-Type": type, "Cache-Control": "private, max-age=3600" });
}

function htmlHeaders() {
  return { "Content-Type": "text/html; charset=utf-8" };
}

function textHeaders() {
  return { "Content-Type": "text/plain; charset=utf-8" };
}
