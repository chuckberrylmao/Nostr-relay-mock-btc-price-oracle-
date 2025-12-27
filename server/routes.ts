import type { Express } from "express";
import { type Server } from "http";
import { setupNostrRelay, getRelayInfo } from "./nostr-relay";
import { execSync } from "child_process";
import { existsSync, unlinkSync } from "fs";
import path from "path";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await Promise.resolve(setupNostrRelay(httpServer));

  app.get("/api/relay-info", (_req, res) => {
    res.setHeader("Content-Type", "application/nostr+json");
    res.json(getRelayInfo());
  });

  app.get("/health", (_req, res) => {
    res.send("ok");
  });

  app.get("/api/download-zip", (_req, res) => {
    const zipPath = path.join(process.cwd(), "btc-price-relay-download.zip");
    
    try {
      if (existsSync(zipPath)) {
        unlinkSync(zipPath);
      }
      
      const filesToInclude = [
        "server/",
        "client/src/",
        "client/index.html",
        "shared/",
        "package.json",
        "tsconfig.json",
        "vite.config.ts",
        "tailwind.config.ts",
        "drizzle.config.ts",
        "replit.md",
        "design_guidelines.md"
      ].join(" ");
      
      execSync(`zip -r btc-price-relay-download.zip ${filesToInclude} -x "*.log" -x "node_modules/*" -x ".git/*"`, {
        cwd: process.cwd(),
        stdio: "pipe"
      });
      
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", "attachment; filename=btc-price-relay.zip");
      res.sendFile(zipPath, (err) => {
        if (existsSync(zipPath)) {
          unlinkSync(zipPath);
        }
        if (err && !res.headersSent) {
          res.status(500).send("Error sending file");
        }
      });
    } catch (error) {
      console.error("ZIP creation error:", error);
      res.status(500).json({ error: "Failed to create ZIP file" });
    }
  });

  return httpServer;
}
