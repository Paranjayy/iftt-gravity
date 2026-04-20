#!/Users/paranjay/.bun/bin/bun

// @raycast.schemaVersion 1
// @raycast.title Infinite Archive
// @raycast.mode fullOutput
// @raycast.packageName Gravity
// @raycast.icon 📎
// @raycast.currentDirectoryPath /Users/paranjay/Developer/iftt/scripts

import { fetch } from "bun";

async function run() {
  try {
    const res = await fetch("http://localhost:3030/archive/list");
    if (!res.ok) throw new Error("Hub Offline");
    const items = await res.json();

    console.log("🪐 Gravity Archive | Infinite History\n");
    console.log("ID   | Source       | Content (Latest First)");
    console.log("-----|--------------|-----------------------");

    items.slice(0, 30).forEach((item: any) => {
      const pin = item.is_bookmarked ? "📌 " : "   ";
      const cleanLine = item.content.replace(/\n/g, " ").substring(0, 60);
      const app = (item.source_app || "Unknown").padEnd(12);
      console.log(`${pin}#${item.id.toString().padEnd(3)} | ${app} | ${cleanLine}...`);
    });
    
    console.log("\n💡 Use Raycast Extension for full fuzzy search & pinning!");
  } catch (e) {
    console.log("❌ Error: Gravity Hub API is offline. Run ./hub.sh");
  }
}

run();
