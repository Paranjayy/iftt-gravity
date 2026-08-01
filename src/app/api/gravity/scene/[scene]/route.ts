import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scene: string }> }
) {
  try {
    const { scene: rawScene } = await params;
    const scene = rawScene.toUpperCase();
    // Forward to local bot API
    const botRes = await fetch(`http://127.0.0.1:3030/scene/${scene}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const text = await botRes.text();

    return new NextResponse(text, { status: botRes.status });
  } catch (error) {
    console.error('Gravity Scene Bridge Error:', error);
    return NextResponse.json({ error: 'Gravity Hub Offline' }, { status: 503 });
  }
}
