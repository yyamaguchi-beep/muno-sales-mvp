import http from "node:http";
import crypto from "node:crypto";

const PORT = process.env.PORT || 3000;

const APP_BASE_URL = process.env.APP_BASE_URL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const LINE_CHANNEL_SECRET = 00e0e6b87bebb180a0535568e8c26daa|| "";
const LINE_CHANNEL_ACCESS_TOKEN = 7ZfuEf8PyHn2o94hn8rrNzXlYUjLLXS+mBtbHch5YlUZRVFLCU5LCIkMn2UmiqQ65NVQ6oOtsc5jy0X/X/BusPPMzVurL5HMrL6X4N+qFfVOeesbCf5y7pmgbhn/v/B4enKxFYWan6tprDoVsgBhBAdB04t89/1O/w1cDnyilFU=|| "";

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

const reports = [];

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
            <style>
              body {
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                background: #f7f7f7;
                margin: 0;
                padding: 40px;
                color: #111;
              }
              .card {
                max-width: 760px;
                margin: 0 auto;
                background: #fff;
                border-radius: 16px;
                padding: 32px;
                box-shadow: 0 10px 30px rgba(0,0,0,.08);
              }
              h1 { margin-top: 0; }
              code {
                background: #eee;
                padding: 2px 6px;
                border-radius: 6px;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>muno-sales-mvp</h1>
              <p>Render deployment is running.</p>
              <p>Health check: <code>/health</code></p>
              <p>LINE Webhook: <code>/api/line/webhook</code></p>
              <p>APP_BASE_URL: <code>${APP_BASE_URL || "not set"}</code></p>
            </div>
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
            <style>
              body {
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                background: #f7f7f7;
                margin: 0;
                padding: 32px;
                color: #111;
              }
              .wrap {
                max-width: 960px;
                margin: 0 auto;
              }
              .card {
                background: #fff;
                border-radius: 16px;
                padding: 24px;
                box-shadow: 0 10px 30px rgba(0,0,0,.08);
                margin-bottom: 16px;
              }
              pre {
                white-space: pre-wrap;
                word-break: break-word;
                background: #f1f1f1;
                padding: 16px;
                border-radius: 12px;
              }
            </style>
          </head>
          <body>
            <div class="wrap">
              <h1>Sales Reports</h1>
              <div class="card">
                <p>保存件数：${reports.length}</p>
              </div>
              ${reports
                .map(
                  (r) => `
                  <div class="card">
                    <strong>${r.createdAt}</strong>
                    <pre>${JSON.stringify(r, null, 2)}</pre>
                  </div>
                `
                )
                .join("")}
            </div>
          </body>
        </html>
        `
      );
    }

    if (req.method === "POST" && url.pathname === "/api/line/webhook") {
      const rawBody = await readBody(req);
      const signature = req.headers["x-line-signature"];

      if (!verifyLineSignature(rawBody, signature)) {
        return sendJson(res, 401, {
          ok: false,
          error: "Invalid LINE signature",
        });
      }

      const bodyText = rawBody.toString("utf8");
      const payload = bodyText ? JSON.parse(bodyText) : {};
      const events = payload.events || [];

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

    if (req.method === "POST" && url.pathname === "/api/reports") {
      const rawBody = await readBody(req);
      const payload = rawBody.length ? JSON.parse(rawBody.toString("utf8")) : {};

      const report = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        source: "form",
        ...payload,
      };

      reports.push(report);

      return sendJson(res, 201, {
        ok: true,
        report,
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
