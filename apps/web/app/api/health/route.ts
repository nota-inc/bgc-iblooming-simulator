import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "@bgc-alpha/web",
    timestamp: new Date().toISOString()
  });
}

