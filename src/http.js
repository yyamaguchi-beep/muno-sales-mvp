export function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(data));
}

export function ok(res, data = {}) {
  return sendJson(res, 200, data);
}

export function created(res, data = {}) {
  return sendJson(res, 201, data);
}

export function badRequest(res, message = "Bad Request") {
  return sendJson(res, 400, {
    error: message,
  });
}

export function unauthorized(res, message = "Unauthorized") {
  return sendJson(res, 401, {
    error: message,
  });
}

export function notFound(res, message = "Not Found") {
  return sendJson(res, 404, {
    error: message,
  });
}

export function methodNotAllowed(res, message = "Method Not Allowed") {
  return sendJson(res, 405, {
    error: message,
  });
}

export function serverError(res, error) {
  return sendJson(res, 500, {
    error: "Internal Server Error",
    detail: error?.message || String(error),
  });
}

export async function readBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

export async function readJson(req) {
  const body = await readBody(req);

  if (!body) {
    return {};
  }

  return JSON.parse(body);
}

export function getPath(req) {
  const url = new URL(req.url, "http://localhost");
  return url.pathname;
}

export function getQuery(req) {
  const url = new URL(req.url, "http://localhost");
  return Object.fromEntries(url.searchParams.entries());
}
