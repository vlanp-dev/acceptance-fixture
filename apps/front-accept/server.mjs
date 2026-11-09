import http from "node:http";

const port = Number(process.env.PORT ?? 3000);
const api = process.env.PUBLIC_API_URL ?? "http://ms-accept:8080";

function send(response, status, contentType, body) {
  response.writeHead(status, { "content-type": contentType });
  response.end(body);
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.url === "/health") {
      return send(
        response,
        200,
        "application/json",
        JSON.stringify({ status: "ok", service: "front-accept" }),
      );
    }
    if (request.url === "/api") {
      const upstream = await fetch(`${api}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return send(
        response,
        upstream.ok ? 200 : 502,
        "application/json",
        JSON.stringify({
          api,
          upstreamStatus: upstream.status,
          upstreamBody: await upstream.text(),
        }),
      );
    }
    return send(
      response,
      200,
      "text/html; charset=utf-8",
      `<!doctype html><h1>front-accept</h1><p>API: ${api}</p><p><a href="/api">/api</a></p>`,
    );
  } catch {
    return send(
      response,
      503,
      "application/json",
      JSON.stringify({ status: "unavailable" }),
    );
  }
});

server.listen(port, "0.0.0.0");
