import { ArchiveDB, ArchiveItem } from "./db";
import { spawnSync } from "child_process";

const args = Bun.argv.slice(2);
const cmd = args[0];

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

const formatItem = (item: ArchiveItem) => {
  const bookmark = item.is_bookmarked ? `${COLORS.yellow}★${COLORS.reset} ` : "  ";
  const type = `[${item.type.toUpperCase()}]`.padEnd(8);
  const date = new Date(item.created_at).toLocaleString();
  const content = item.content.replace(/\n/g, " ").substring(0, 60);
  
  return `${COLORS.dim}${item.id.toString().padStart(3)}${COLORS.reset} ${bookmark}${COLORS.cyan}${type}${COLORS.reset} ${COLORS.bright}${content}${COLORS.reset} ${COLORS.dim}(${date})${COLORS.reset}`;
};

const copyToClipboard = (content: string) => {
  const proc = Bun.spawn(["pbcopy"], {
    stdin: Buffer.from(content),
  });
  console.log(`✅ Copied to clipboard!`);
};

if (!cmd || cmd === "list") {
  console.log(`\n🪐 ${COLORS.bright}Gravity Archive - Latest Items${COLORS.reset}\n`);
  const items = ArchiveDB.list(20);
  items.forEach(item => console.log(formatItem(item)));
  console.log("");
} 
else if (cmd === "search") {
  const query = args.slice(1).join(" ");
  console.log(`\n🔍 ${COLORS.bright}Searching for: "${query}"${COLORS.reset}\n`);
  const items = ArchiveDB.search(query);
  items.forEach(item => console.log(formatItem(item)));
  console.log("");
}
else if (cmd === "bookmark") {
  const id = parseInt(args[1]);
  ArchiveDB.toggleBookmark(id);
  console.log(`⭐ Toggled bookmark for item ${id}`);
}
else if (cmd === "copy") {
  const id = parseInt(args[1]);
  const item = ArchiveDB.list(1000).find(i => i.id === id);
  if (item) {
    copyToClipboard(item.content);
  } else {
    console.log("❌ Item not found");
  }
}
else if (cmd === "export") {
  const file = args[1] || "archive_backup.json";
  const items = ArchiveDB.list(1000000);
  await Bun.write(file, JSON.stringify(items, null, 2));
  console.log(`✅ Exported ${items.length} items to ${file}`);
}
else if (cmd === "import") {
  const file = args[1];
  if (!file) {
    console.log("❌ Please specify a file to import");
    process.exit(1);
  }
  const items = await Bun.file(file).json();
  ArchiveDB.importItems(items);
  console.log(`✅ Imported ${items.length} items from ${file}`);
}
else if (cmd === "clear-all") {
  ArchiveDB.clearAll();
  console.log("🔥 All archive history has been purged.");
}
else {
  console.log(`
Usage:
  bun run archive list              Show latest items
  bun run archive search <query>    Search items
  bun run archive bookmark <id>     Toggle bookmark
  bun run archive copy <id>         Copy item back to clipboard
  bun run archive export [file]     Export history to JSON
  bun run archive import <file>     Import history from JSON
  bun run archive clear-all         Purge everything
  `);
}
