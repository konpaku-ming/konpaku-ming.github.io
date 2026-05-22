export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.searchParams.get("path");

    if (!path) {
      return new Response("Missing path", { status: 400 });
    }

    const key = `views:${path}`;

    if (request.method === "POST") {
      const current = await env.VIEWS.get(key);
      const count = current ? parseInt(current) + 1 : 1;
      await env.VIEWS.put(key, count.toString());
      return jsonResponse({ views: count });
    } else if (request.method === "GET") {
      const current = await env.VIEWS.get(key);
      const count = current ? parseInt(current) : 0;
      return jsonResponse({ views: count });
    } else {
      return new Response("Method not allowed", { status: 405 });
    }
  },
};

function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
