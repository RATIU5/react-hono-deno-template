// server.tsx
import "@std/dotenv/load";
import { Hono } from "hono";
import { renderToString } from "react-dom/server";
import { App } from "./components/App.tsx";

const app = new Hono();
const isDev = Deno.env.get("DENO_ENV") === "development";

// Cache for the bundled client code
let cachedClientCode: string | null = null;

if (isDev) {
  app.get("/hmr", (c) => {
    const { response, socket } = Deno.upgradeWebSocket(c.req.raw);
    socket.onopen = () => {
      console.log("HMR client connected");
    };
    return response;
  });

  // Serve the HMR client (dev only)
  app.get("/static/hmr-client.js", () => {
    return new Response(
      `
      const ws = new WebSocket(\`ws://\${window.location.host}/hmr\`);
      ws.onclose = () => {
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      };
    `,
      {
        headers: {
          "content-type": "application/javascript",
        },
      },
    );
  });
}

// Serve the client-side JS
app.get("/static/client.js", async () => {
  if (!cachedClientCode) {
    try {
      const process = new Deno.Command("deno", {
        args: ["run", "--check", "-A", "./client.tsx"],
        stdout: "piped",
      });

      const { stdout } = await process.output();
      cachedClientCode = new TextDecoder().decode(stdout);
    } catch (error) {
      console.error("Compilation error:", error);
      return new Response("Compilation error", { status: 500 });
    }
  }

  return new Response(cachedClientCode, {
    headers: {
      "content-type": "application/javascript",
    },
  });
});

// Index route with React SSR
app.get("/", (c) => {
  const html = renderToString(<App />);

  return c.html(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Hono + React</title>
      </head>
      <body>
        <div id="app">${html}</div>
        <script type="module" src="/static/client.js"></script>
        ${
          isDev
            ? '<script type="module" src="/static/hmr-client.js"></script>'
            : ""
        }
      </body>
    </html>
  `);
});

Deno.serve(app.fetch);
