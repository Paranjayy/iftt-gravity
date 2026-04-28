import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('http://localhost:3031/archive/export/json', { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Archive Sentry Offline' }, { status: 503 });
  }
}
