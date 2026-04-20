import { ArchiveDB } from "./db";
import fs from "fs";
import path from "path";

declare const Bun: any;

const PORT = 3031;
const VAULT_PATH = path.join(process.env.HOME || "", "Developer/iftt/prompt_vault.md");

console.log(`📎 Gravity Archive API: Waking up on port ${PORT}...`);

Bun.serve({
  port: PORT,
  async fetch(req: Request) {
    const url = new URL(req.url);
    
    // CORS headers
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Content-Type": "application/json"
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    try {
      // 1. List Items
      if (url.pathname === "/archive/list") {
        const items = ArchiveDB.list(50);
        return new Response(JSON.stringify(items), { headers });
      }

      // 2. Search Items
      if (url.pathname === "/archive/search") {
        const q = url.searchParams.get("q") || "";
        const items = ArchiveDB.search(q);
        return new Response(JSON.stringify(items), { headers });
      }

      // 3. Toggle Bookmark
      if (url.pathname.startsWith("/archive/bookmark/")) {
        const id = parseInt(url.pathname.split("/").pop() || "0");
        ArchiveDB.toggleBookmark(id);
        return new Response(JSON.stringify({ status: "ok" }), { headers });
      }

      // 4. Delete Item
      if (url.pathname.startsWith("/archive/delete/")) {
        const id = parseInt(url.pathname.split("/").pop() || "0");
        ArchiveDB.delete(id);
        return new Response(JSON.stringify({ status: "ok" }), { headers });
      }

      // 5. Promote to Vault
      if (url.pathname.startsWith("/archive/promote/")) {
        const id = parseInt(url.pathname.split("/").pop() || "0");
        const items = ArchiveDB.list(1000);
        const item = items.find(i => i.id === id);
        if (item) {
          const entry = `\n### 🪐 Promoted from Archive (${new Date().toLocaleDateString()})\nSource: \`${item.source_app}\`\n\n${item.content}\n\n---\n`;
          fs.appendFileSync(VAULT_PATH, entry);
          return new Response(JSON.stringify({ status: "promoted" }), { headers });
        }
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
      }

      return new Response(JSON.stringify({ error: "Invalid endpoint" }), { status: 404, headers });
    } catch (e) {
      console.error("Archive API Error:", e);
      return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers });
    }
  }
});
