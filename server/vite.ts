import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        // Don't exit in production
        if (process.env.NODE_ENV !== 'production') {
          process.exit(1);
        }
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // Skip API routes
    if (url.startsWith('/api')) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // Check if template exists
      if (!fs.existsSync(clientTemplate)) {
        log(`Template not found: ${clientTemplate}`, "vite");
        return next();
      }

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      log(`Vite error: ${(e as Error).message}`, "vite");
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // Fix: Use 'dist' instead of 'public'
  const distPath = path.resolve(import.meta.dirname, "..", "dist");
  
  log(`Serving static files from: ${distPath}`, "static");

  if (!fs.existsSync(distPath)) {
    log(`Build directory not found: ${distPath}`, "static");
    
    // For Vercel, try alternative paths
    const alternativePaths = [
      path.resolve("dist"),
      path.resolve("./dist"),
      path.resolve(process.cwd(), "dist")
    ];
    
    let foundPath = null;
    for (const altPath of alternativePaths) {
      if (fs.existsSync(altPath)) {
        foundPath = altPath;
        break;
      }
    }
    
    if (foundPath) {
      log(`Using alternative path: ${foundPath}`, "static");
      app.use(express.static(foundPath));
      
      app.use("*", (req, res, next) => {
        // Skip API routes
        if (req.path.startsWith('/api')) {
          return next();
        }
        
        const indexPath = path.resolve(foundPath, "index.html");
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).json({ message: "Frontend not found" });
        }
      });
      return;
    }
    
    // Fallback: serve a basic message
    app.use("*", (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      
      res.status(200).json({ 
        message: "SurdarshanSarees API is running",
        note: "Frontend build not found. Build the client first with 'npm run build'",
        api: "Available at /api/*"
      });
    });
    return;
  }

  // Serve static files
  app.use(express.static(distPath));

  // SPA fallback - serve index.html for non-API routes
  app.use("*", (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api')) {
      return next();
    }
    
    const indexPath = path.resolve(distPath, "index.html");
    
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      log(`index.html not found at: ${indexPath}`, "static");
      res.status(404).json({ message: "Frontend not available" });
    }
  });
}
