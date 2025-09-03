import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { config } from "./config";
import { setupSecurity, filterSensitiveData } from "./security";

const app = express();

// Setup security middleware (must be before body parsers)
setupSecurity(app);

// Request logging middleware with sensitive data filtering
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // Filter sensitive data before logging
      if (capturedJsonResponse && config.NODE_ENV !== 'production') {
        const filtered = filterSensitiveData(capturedJsonResponse);
        logLine += ` :: ${JSON.stringify(filtered)}`;
      }

      if (logLine.length > 120) {
        logLine = logLine.slice(0, 119) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (config.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Error handling middleware (must be after static files)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = config.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : err.message || "Internal Server Error";

    // Log error details (filtered)
    console.error('Error:', filterSensitiveData({
      status,
      message: err.message,
      stack: config.NODE_ENV !== 'production' ? err.stack : undefined,
    }));

    res.status(status).json({ message });
  });

  // Server configuration
  const port = parseInt(config.PORT, 10);
  server.listen(port, "0.0.0.0", () => {
    log(`🚀 Server running on port ${port} in ${config.NODE_ENV} mode`);
    
    if (config.NODE_ENV === 'development') {
      log(`📝 Environment variables loaded successfully`);
      log(`🔐 Security features enabled: Rate limiting, CORS, Helmet`);
    }
  });
})();