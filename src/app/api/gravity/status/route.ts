import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // 1. Fetch status from local bot API
    const botRes = await fetch('http://localhost:3030/status', { cache: 'no-store' });
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
