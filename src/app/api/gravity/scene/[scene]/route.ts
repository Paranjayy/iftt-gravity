import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scene: string }> }
) {
  try {
    const { scene: rawScene } = await params;
    const scene = rawScene.toUpperCase();
    // Forward to local bot API
    const botRes = await fetch(`http://localhost:3030/scene/${scene}`, { cache: 'no-store' });
    const text = await botRes.text();

    return new NextResponse(text, { status: 200 });
  } catch (error) {
    console.error('Gravity Scene Bridge Error:', error);
    return NextResponse.json({ error: 'Gravity Hub Offline' }, { status: 503 });
  }
}
