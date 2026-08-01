import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadEnv } from "./env.js";
import { openDb } from "./db.js";
import { migrate } from "./schema.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { extractBearer, parseAuthToken } from "./auth.js";
import { registerMxMastersRoutes } from "./routes/mx/masters.js";
import { registerMxRollsRoutes } from "./routes/mx/rolls.js";
import { registerMxPackingRoutes } from "./routes/mx/packing.js";
import { registerMxParcelRoutes } from "./routes/mx/parcels.js";
import { registerMxChallanRoutes } from "./routes/mx/challans.js";
import { registerMxSyncRoutes } from "./routes/mx/sync.js";
import { registerMxAnalyticsRoutes } from "./routes/mx/analytics.js";

const env = loadEnv(process.env);

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    transport:
      process.env.NODE_ENV === "production"
        ? undefined
        : {
            target: "pino-pretty",
            options: { colorize: true, translateTime: "HH:MM:ss" },
          },
  },
});

await app.register(cors, { origin: true });

function pathnameOnly(url: string): string {
  const q = url.indexOf("?");
  return q >= 0 ? url.slice(0, q) : url;
}

const db = openDb(env.DB_PATH);
migrate(db);

const authEnabled = Boolean(env.AUTH_SECRET?.trim());
if (authEnabled) {
  app.addHook("onRequest", async (req, reply) => {
    if (req.method === "OPTIONS") return;
    const path = pathnameOnly(req.url);
    if (path === "/health") return;
    if (path === "/auth/status" || path === "/auth/login" || path === "/auth/register-first") return;
    const token = extractBearer(req.headers.authorization);
    if (!token || !parseAuthToken(token, env.AUTH_SECRET)) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });
}

app.get("/health", async () => ({ ok: true, product: "maxwell" }));

await registerAuthRoutes(app, { db, env });
await registerMxMastersRoutes(app, { db });
await registerMxRollsRoutes(app, { db });
await registerMxPackingRoutes(app, { db });
await registerMxParcelRoutes(app, { db });
await registerMxChallanRoutes(app, { db });
await registerMxSyncRoutes(app, { db });
await registerMxAnalyticsRoutes(app, { db });

await app.listen({ port: env.PORT, host: env.HOST });
