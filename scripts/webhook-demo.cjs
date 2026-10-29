// Учебный сервер: цель мониторинга и приёмник webhook в одном процессе.
const { createServer } = require("node:http");

let targetStatus = 200;

const server = createServer(async (request, response) => {
  const route = `${request.method} ${request.url}`;

  if (route === "GET /target") {
    response.writeHead(targetStatus, { "Content-Type": "text/plain" });
    response.end(`Demo target: ${targetStatus}`);
    return;
  }

  if (route === "POST /up" || route === "POST /down") {
    targetStatus = route === "POST /up" ? 200 : 503;
    console.log(`Статус цели изменён на ${targetStatus}`);
    response.end(String(targetStatus));
    return;
  }

  if (route === "POST /webhook") {
    try {
      let body = "";
      for await (const chunk of request) {
        body += chunk;
      }
      const event = JSON.parse(body);
      console.log("Получен webhook:", JSON.stringify(event, null, 2));
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ received: true }));
    } catch {
      response.writeHead(400);
      response.end("Invalid JSON");
    }
    return;
  }

  response.writeHead(404);
  response.end("Not found");
});

server.listen(4000, "0.0.0.0", () => {
  console.log("Демонстрационный сервер: http://localhost:4000");
  console.log("GET /target; POST /up; POST /down; POST /webhook");
});
