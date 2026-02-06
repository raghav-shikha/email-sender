import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { requireUserIdFromRequest } from "@/lib/supabaseJwt";

export async function POST(req: Request) {
  const userId = await requireUserIdFromRequest(req);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBase) return NextResponse.json({ error: "Missing NEXT_PUBLIC_API_BASE_URL" }, { status: 500 });

  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) return NextResponse.json({ error: "Missing OAUTH_STATE_SECRET" }, { status: 500 });

  const state = await new SignJWT({ typ: "oauth_state", nonce: crypto.randomUUID() })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(secret));

  const url = `${apiBase.replace(/\/$/, "")}/oauth/google/start?state=${encodeURIComponent(state)}`;
  return NextResponse.json({ url });
}
