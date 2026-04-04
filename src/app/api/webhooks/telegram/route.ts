import { NextRequest, NextResponse } from 'next/server';
import { engine } from '@/lib/engine';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    console.log('Received Telegram Webhook:', payload);

    // 1. Map TG payload to a Trigger
    // 2. processTrigger(payload)
    // await engine.processTrigger({ ... });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
