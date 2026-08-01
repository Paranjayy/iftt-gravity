import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // 1. Fetch status from local bot API
    const botRes = await fetch('http://127.0.0.1:3030/status', {
      cache: 'no-store',
      // /status can include a live-data refresh. Four seconds produced false
      // “Hub Offline” states while the local bot was healthy.
      signal: AbortSignal.timeout(15_000),
    });
    if (!botRes.ok) {
      throw new Error(`Hub status returned ${botRes.status}`);
    }
    const statusData = await botRes.json();

    // 2. Read house log for the latest activity
    const logPath = path.join(process.cwd(), 'house_log.md');
    let logs: string[] = [];
    if (fs.existsSync(logPath)) {
      logs = fs.readFileSync(logPath, 'utf-8').trim().split('\n').reverse().slice(0, 20);
    }

    return NextResponse.json({
      ...statusData,
      logs
    });
  } catch (error) {
    console.error('Gravity API Bridge Error:', error);
    return NextResponse.json({ error: 'Gravity Hub Offline' }, { status: 503 });
  }
}
