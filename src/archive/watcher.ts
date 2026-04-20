import { spawnSync } from "child_process";
import { ArchiveDB } from "./db";
import { join } from "path";
import { homedir } from "os";
import { mkdirSync, writeFileSync } from "fs";
import { Database } from "better-sqlite3";

const MEDIA_DIR = join(homedir(), ".gravity", "media");
const DB_PATH = join(homedir(), ".gravity", "archive.db");
mkdirSync(MEDIA_DIR, { recursive: true });

console.log("🪐 Gravity Archive Watcher: Starting God Mode...");

// 🕰️ Background Task: Auto-Cleanup (Once per day)
// Delete unpinned items older than 30 days
function runCleanup() {
  console.log("🧹 Running Archive Cleanup...");
  try {
    const db = new Database(DB_PATH);
    const result = db.prepare(`
      DELETE FROM archive 
      WHERE is_bookmarked = 0 
      AND created_at < datetime('now', '-30 days')
    `).run();
    console.log(`✅ Cleanup complete. Pruned ${result.changes} old items.`);
    db.close();
  } catch (e) {
    console.error("❌ Cleanup failed:", e);
  }
}

// Run on start + every 24 hours
runCleanup();
setInterval(runCleanup, 24 * 60 * 60 * 1000);

let lastContent = "";
let lastImageHash = "";

const getActiveApp = (): string => {
  try {
    const result = spawnSync("osascript", ["-e", 'tell application "System Events" to get name of first process whose frontmost is true'], { encoding: "utf-8" });
    return result.stdout.trim() || "Unknown";
  } catch {
    return "Unknown";
  }
};

const getClipboardText = (): string => {
  const result = spawnSync("pbpaste", { encoding: "utf-8" });
  return result.stdout.trim();
};

const checkAndSaveImage = () => {
  try {
    // Check if clipboard has image data
    const hasImage = spawnSync("osascript", ["-e", 'get clipboard info'], { encoding: "utf-8" }).stdout.includes("«class PNGf»") || 
                     spawnSync("osascript", ["-e", 'get clipboard info'], { encoding: "utf-8" }).stdout.includes("TIFF picture");
    
    if (hasImage) {
      const fileName = `img_${Date.now()}.png`;
      const filePath = join(MEDIA_DIR, fileName);
      
      // Use osascript to write image data to file
      const script = `set theFile to (POSIX file "${filePath}")
      try
        set theData to (get the clipboard as «class PNGf»)
        set theOpenedFile to (open for access theFile with write permission)
        write theData to theOpenedFile
        close access theOpenedFile
      on error
        return "error"
      end try`;
      
      spawnSync("osascript", ["-e", script]);
      
      const app = getActiveApp();
      ArchiveDB.add(`IMAGE:${fileName}`, "image", app);
      console.log(`🖼️ Image captured from ${app}: ${fileName}`);
      return true;
    }
  } catch (e) {
    // Silent fail for images
  }
  return false;
};

const cleanDOM = (html: string): string => {
  // Remove scripts, styles, and comments to save tokens
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const countTokens = (text: string): number => {
  // Rough "cl100k_base" estimation: (chars / 3.8) + (words / 0.7) / 2
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(text.length / 4 + words / 2);
};

const detectType = (content: string): { type: string, labels: string, cleanContent: string } => {
  let type = "text";
  let labels = [];
  let cleanContent = content;

  if (content.startsWith("http") || content.startsWith("www")) {
    type = "url";
  } else if (content.includes("mailto:") || /^\S+@\S+\.\S+$/.test(content)) {
    type = "email";
  } else if (content.includes("<div") || content.includes("<span") || content.includes("<html")) {
    type = "snippet";
    labels.push("DOM");
    cleanContent = cleanDOM(content);
  } else if (content.length > 500) {
    type = "snippet";
  }

  // Auto-Labeling
  if (content.trim().startsWith("{") || content.trim().startsWith("[")) labels.push("Data");
  if (content.length > 5000) labels.push("Huge");
  if (content.toLowerCase().includes("error") || content.toLowerCase().includes("warn")) labels.push("Logs");

  return { type, labels: labels.join(", "), cleanContent };
};

setInterval(() => {
  try {
    const currentText = getClipboardText();
    
    if (currentText && currentText !== lastContent) {
      const { type, labels, cleanContent } = detectType(currentText);
      const app = getActiveApp();
      const tokens = countTokens(cleanContent);
      
      console.log(`📎 New item [${type}] from ${app} ${labels ? `(${labels})` : ""} | 🪙 ${tokens} tokens`);
      
      ArchiveDB.add(cleanContent, type, app, labels, tokens);
      lastContent = currentText;
    }
  } catch (error) {
    console.error("❌ Watcher Error:", error);
  }
}, 1500); // Slightly slower polling to allow OS tasks
