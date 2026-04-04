"use server";

import fs from "fs/promises";
import path from "path";

const CONFIG_PATH = path.join(process.cwd(), "config.json");

export async function getDashboardData() {
  try {
    const data = await fs.readFile(CONFIG_PATH, "utf-8");
    const config = JSON.parse(data);
    return config;
  } catch {
    return {};
  }
}
