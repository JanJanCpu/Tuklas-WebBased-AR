import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { ZodError } from "zod";
import { authRouter } from "./routes/auth.js";
import { healthRouter } from "./routes/health.js";
import { modulesRouter } from "./routes/modules.js";
import { sectionsRouter } from "./routes/sections.js";
import { syncRouter } from "./routes/sync.js";

export function createApp() {
  const app = express();

  const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  // Vercel preview deployments of the frontend get a new URL on every push:
  // <project>-<9-char hash>-tuklasar.vercel.app or <project>-git-<branch>-tuklasar.vercel.app.
  const previewOrigin = /^https:\/\/tuklas-web-based-ar-frontend-(?:[a-z0-9]{9}|git-[a-z0-9-]+)-tuklasar\.vercel\.app$/;

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Allow non-browser requests (no Origin header) and any configured origin.
        if (!origin || allowedOrigins.includes(origin) || previewOrigin.test(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`Origin ${origin} is not allowed by CORS.`));
      },
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/sections", sectionsRouter);
  app.use("/api/modules", modulesRouter);
  app.use("/api/sync", syncRouter);

  app.use((_request, response) => {
    response.status(404).json({ error: "Route not found" });
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof ZodError) {
      response.status(400).json({ error: "Validation failed", details: error.flatten() });
      return;
    }

    console.error(error);
    response.status(500).json({ error: "Internal server error" });
  };

  app.use(errorHandler);

  return app;
}
