import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUserIdFromRequest } from "@/lib/supabaseJwt";

export async function POST(req: Request) {
  try {
    const userId = await requireUserIdFromRequest(req);
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { endpoint } = (await req.json()) as { endpoint?: string };
    if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: "Server missing Supabase env" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", endpoint);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 500 });
  }
}

function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\\s+(.+)$/i);
  return m?.[1] ?? null;
}
