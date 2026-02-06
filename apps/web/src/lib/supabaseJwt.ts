import { createClient } from "@supabase/supabase-js";

export async function requireUserIdFromRequest(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth) throw new Error("Unauthorized");
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new Error("Unauthorized");

  const token = m[1];
  if (!token) throw new Error("Unauthorized");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new Error("Server missing Supabase env");

  // Validate the access token by asking Supabase Auth.
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized");
  return data.user.id;
}

