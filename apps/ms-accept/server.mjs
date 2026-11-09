import http from "node:http";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
});

const port = Number(process.env.PORT ?? 8080);

function send(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.url === "/health") {
      await pool.query("SELECT 1");
      return send(response, 200, { status: "ok", service: "ms-accept" });
    }
    if (request.url === "/db") {
      const result = await pool.query(
        "SELECT count(*)::int AS migrations FROM acceptance_migration",
      );
      return send(response, 200, {
        migrations: result.rows[0].migrations,
        now: new Date().toISOString(),
      });
    }
    if (request.url === "/secret") {
      return send(response, 200, {
        configured: Boolean(process.env.APP_SECRET),
      });
    }
    return send(response, 404, { error: "not_found" });
  } catch {
    return send(response, 500, { error: "unavailable" });
  }
});

server.listen(port, "0.0.0.0");
