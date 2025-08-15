import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { connectToMongoDB } from "./db-mongo";
import { seedMongoDB } from "./seed-mongo";
import path from "path";
import fs from "fs";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Basic logging for serverless
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Global state for serverless
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

const initialize = async () => {
  if (isInitialized) return;
  
  if (initializationPromise) {
    await initializationPromise;
    return;
  }

  initializationPromise = (async () => {
    try {
      console.log("Initializing serverless function...");
      await connectToMongoDB();
      console.log("Database connected");
      
      await seedMongoDB();
      console.log("Database seeded");
      
      await registerRoutes(app);
      console.log("Routes registered");
      
      isInitialized = true;
    } catch (error) {
      console.error("Initialization failed:", error);
      initializationPromise = null;
      throw error;
    }
  })();

  await initializationPromise;
};

// Root route
app.get('/', async (req: Request, res: Response) => {
  try {
    res.json({
      message: "SurdarshanSarees API",
      status: "running",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Root route error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Serve static files for production
const serveStaticFiles = () => {
  const distPath = path.resolve(process.cwd(), "dist");
  
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    
    // SPA fallback
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      
      const indexPath = path.resolve(distPath, "public/index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        next();
      }
    });
  }
};

// Setup static serving for production
if (process.env.NODE_ENV === 'production') {
  serveStaticFiles();
}

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({ 
    message: "Internal server error",
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

// For local development
if (process.env.NODE_ENV !== "production") {
  const { setupVite } = await import("./vite.js");
  const { createServer } = await import("http");
  
  (async () => {
    const server = createServer(app);
    await initialize();
    await setupVite(app, server);
    
    const port = 5000;
    server.listen(port, () => {
      console.log(`Development server running on port ${port}`);
    });
  })();
}

// Export for Vercel - this is the critical part
export default async function handler(req: Request, res: Response) {
  try {
    await initialize();
    return app(req, res);
  } catch (error) {
    console.error("Handler error:", error);
    res.status(500).json({ message: "Server initialization failed" });
  }
}
