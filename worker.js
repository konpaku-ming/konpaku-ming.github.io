const VIEW_ROUTE = "/views";
const VIEW_BATCH_ROUTE = "/views/batch";
const COUNT_KEY = "count";
const MAX_PATH_LENGTH = 256;
const MAX_BATCH_PATHS = 50;
const DEFAULT_ALLOWED_ORIGINS = [
  "https://konpaku-ming.github.io",
  "http://localhost:1313",
  "http://127.0.0.1:1313",
];

export class ViewCounter {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    if (request.method === "GET") {
      const count = await this.getCount();
      return jsonResponse({ views: count });
    }

    if (request.method === "POST") {
      const count = await this.increment();
      return jsonResponse({ views: count });
    }

    return methodNotAllowedResponse();
  }

  async getCount() {
    return parseStoredCount(await this.state.storage.get(COUNT_KEY));
  }

  async increment() {
    let nextCount = 0;
    await this.state.storage.transaction(async (txn) => {
      const current = parseStoredCount(await txn.get(COUNT_KEY));
      nextCount = current + 1;
      await txn.put(COUNT_KEY, nextCount);
    });

    return nextCount;
  }
}

export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (!isAllowedOrigin(request, env)) {
      return jsonResponse({ error: "Forbidden origin" }, { status: 403, headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (url.pathname !== VIEW_ROUTE && url.pathname !== VIEW_BATCH_ROUTE) {
      return jsonResponse({ error: "Not found" }, { status: 404, headers: corsHeaders });
    }

    if (!env.VIEW_COUNTER) {
      return jsonResponse(
        { error: "Missing VIEW_COUNTER Durable Object binding" },
        { status: 500, headers: corsHeaders },
      );
    }

    if (url.pathname === VIEW_BATCH_ROUTE) {
      if (request.method !== "GET") {
        return methodNotAllowedResponse(corsHeaders, "GET, OPTIONS");
      }

      return handleBatchViewRequest(url, env, corsHeaders);
    }

    if (request.method !== "GET" && request.method !== "POST") {
      return methodNotAllowedResponse(corsHeaders);
    }

    const path = normalizePath(url.searchParams.get("path"));
    if (!path) {
      return jsonResponse(
        { error: "Invalid path" },
        { status: 400, headers: corsHeaders },
      );
    }

    const response = await fetchCounter(env, path, request.method);

    return withHeaders(response, corsHeaders);
  },
};

async function handleBatchViewRequest(url, env, corsHeaders) {
  const rawPaths = url.searchParams.getAll("path");
  const paths = [];
  const seen = new Set();

  if (!rawPaths.length) {
    return jsonResponse(
      { error: "Missing path" },
      { status: 400, headers: corsHeaders },
    );
  }

  for (const rawPath of rawPaths) {
    const path = normalizePath(rawPath);
    if (!path) {
      return jsonResponse(
        { error: "Invalid path" },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!seen.has(path)) {
      seen.add(path);
      paths.push(path);
    }

    if (paths.length > MAX_BATCH_PATHS) {
      return jsonResponse(
        { error: "Too many paths" },
        { status: 400, headers: corsHeaders },
      );
    }
  }

  try {
    const entries = await Promise.all(
      paths.map(async (path) => {
        const response = await fetchCounter(env, path, "GET");
        const data = await response.json();
        return [path, parseStoredCount(data.views)];
      }),
    );

    const views = {};
    for (const [path, count] of entries) {
      views[path] = count;
    }

    return jsonResponse({ views }, { headers: corsHeaders });
  } catch (error) {
    console.error("Views batch failed", error);
    return jsonResponse(
      { error: "Views batch failed" },
      { status: 500, headers: corsHeaders },
    );
  }
}

function fetchCounter(env, path, method) {
  const url = new URL("https://view-counter.internal/views");
  url.searchParams.set("path", path);

  const counterId = env.VIEW_COUNTER.idFromName(path);
  const counter = env.VIEW_COUNTER.get(counterId);
  return counter.fetch(new Request(url.toString(), { method }));
}

function normalizePath(rawPath) {
  if (typeof rawPath !== "string") return null;

  let path = rawPath.trim();
  if (!path || path.length > MAX_PATH_LENGTH) return null;
  if (!path.startsWith("/") || path.startsWith("//")) return null;

  path = path.split("#")[0].split("?")[0];
  if (!path || /[\u0000-\u001F\u007F]/.test(path)) return null;

  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

function parseStoredCount(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const count = Number.parseInt(value, 10);
    return Number.isFinite(count) && count >= 0 ? count : 0;
  }

  return 0;
}

function getAllowedOrigins(env) {
  if (typeof env.ALLOWED_ORIGINS === "string" && env.ALLOWED_ORIGINS.trim()) {
    return env.ALLOWED_ORIGINS
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  return DEFAULT_ALLOWED_ORIGINS;
}

function isAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;

  const allowedOrigins = getAllowedOrigins(env);
  return allowedOrigins.includes("*") || allowedOrigins.includes(origin);
}

function getCorsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = getAllowedOrigins(env);
  const allowAnyOrigin = allowedOrigins.includes("*");
  const allowOrigin = allowAnyOrigin
    ? "*"
    : origin && allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0];

  const headers = new Headers({
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  });

  if (!allowAnyOrigin) {
    headers.set("Vary", "Origin");
  }

  return headers;
}

function jsonResponse(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

function methodNotAllowedResponse(headers = new Headers(), allow = "GET, POST, OPTIONS") {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Allow", allow);
  return jsonResponse(
    { error: "Method not allowed" },
    { status: 405, headers: responseHeaders },
  );
}

function withHeaders(response, headers) {
  const mergedHeaders = new Headers(response.headers);
  headers.forEach((value, key) => {
    mergedHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: mergedHeaders,
  });
}
