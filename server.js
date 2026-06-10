import http from "node:http";
import crypto from "node:crypto";

const PORT = process.env.PORT || 3000;
const APP_BASE_URL = process.env.APP_BASE_URL || "";
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || "";
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";

const reports = [];

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(data));
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
  });
  res.end(html);
}

async function readBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

function verifyLineSignature(rawBody, signature) {
  if (!LINE_CHANNEL_SECRET) return true;
  if (!signature) return false;

  const hash = crypto
    .createHmac("sha256", LINE_CHANNEL_SECRET)
    .update(rawBody)
    .digest("base64");

  return hash === signature;
}

async function replyLine(replyToken, text) {
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    console.log("LINE_CHANNEL_ACCESS_TOKEN is not set.");
    return;
  }

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "text",
          text,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("LINE reply error:", response.status, errorText);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/") {
      return sendHtml(
        res,
        200,
        `
        <!doctype html>
        <html lang="ja">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>muno-sales-mvp</title>
          </head>
          <body style="font-family: sans-serif; padding: 40px;">
            <h1>muno-sales-mvp</h1>
            <p>Render deployment is running.</p>
            <p>Health check: /health</p>
            <p>LINE Webhook: /api/line/webhook</p>
            <p>APP_BASE_URL: ${APP_BASE_URL || "not set"}</p>
          </body>
        </html>
        `
      );
    }

    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, {
        ok: true,
        service: "muno-sales-mvp",
        time: new Date().toISOString(),
      });
    }

    if (req.method === "GET" && url.pathname === "/admin") {
      return sendHtml(
        res,
        200,
        `
        <!doctype html>
        <html lang="ja">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Sales Reports</title>
          </head>
          <body style="font-family: sans-serif; padding: 40px;">
            <h1>Sales Reports</h1>
            <p>保存件数：${reports.length}</p>
            ${reports
              .map(
                (report) => `
                  <div style="border:1px solid #ddd; padding:16px; margin:16px 0;">
                    <strong>${report.createdAt}</strong>
                    <pre>${JSON.stringify(report, null, 2)}</pre>
                  </div>
                `
              )
              .join("")}
          </body>
        </html>
        `
      );
    }

    if (req.method === "POST" && url.pathname === "/api/line/webhook") {
      const rawBody = await readBody(req);
      const signature = req.headers["x-line-signature"];

      let payload = {};

      try {
        payload = rawBody.length ? JSON.parse(rawBody.toString("utf8")) : {};
      } catch (error) {
        console.error("Invalid JSON body:", error);
        return sendJson(res, 400, {
          ok: false,
          error: "Invalid JSON body",
        });
      }

      const events = payload.events || [];

      if (events.length === 0) {
        return sendJson(res, 200, {
          ok: true,
          message: "Webhook verification received",
        });
      }

      if (!verifyLineSignature(rawBody, signature)) {
        return sendJson(res, 401, {
          ok: false,
          error: "Invalid LINE signature",
        });
      }

      for (const event of events) {
        if (event.type === "message" && event.message?.type === "text") {
          const text = event.message.text;

          const report = {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            source: "line",
            userId: event.source?.userId || null,
            text,
          };

          reports.push(report);

          if (event.replyToken) {
            await replyLine(
              event.replyToken,
              `報告を受け付けました。\n\n内容：${text}`
            );
          }
        }
      }

      return sendJson(res, 200, {
        ok: true,
      });
    }

    return sendJson(res, 404, {
      ok: false,
      error: "Not Found",
    });
  } catch (error) {
    console.error(error);

    return sendJson(res, 500, {
      ok: false,
      error: "Internal Server Error",
      detail: error.message,
    });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
