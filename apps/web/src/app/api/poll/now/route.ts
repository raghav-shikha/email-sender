import { NextResponse } from "next/server";

import { requireUserIdFromRequest } from "@/lib/supabaseJwt";

export async function POST(req: Request) {
  // Validate the Supabase access token (prevents anonymous polling).
  try {
    await requireUserIdFromRequest(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBase) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_API_BASE_URL" },
      { status: 500 },
    );
  }

  const auth = req.headers.get("authorization") ?? "";

  const resp = await fetch(`${apiBase.replace(/\/$/, "")}/poll/now`, {
    method: "POST",
    headers: {
      authorization: auth,
    },
  });

  const contentType = resp.headers.get("content-type") ?? "application/json";
  const body = await resp.text();

  return new NextResponse(body, {
    status: resp.status,
    headers: {
      "content-type": contentType,
    },
  });
}
