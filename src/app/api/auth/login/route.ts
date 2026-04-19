import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const CORRECT_PASSWORD = process.env.DASHBOARD_PASSWORD || process.env.GRAVITY_HUB_TOKEN || "admin";

  if (password === CORRECT_PASSWORD || password === process.env.GRAVITY_HUB_TOKEN) {
    const response = NextResponse.json({ success: true });
    
    // Set a secure, HTTP-only cookie
    response.cookies.set("gravity_auth", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    });
    
    return response;
  }

  return NextResponse.json({ success: false }, { status: 401 });
}
