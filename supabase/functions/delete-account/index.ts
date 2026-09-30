// 한 해 가계부 · 계정 삭제 서버 함수 (Supabase Edge Function)
// 로그인한 사용자 본인의 계정과 데이터만 지워요. 삭제 대상은 토큰에서만 정해져요.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);
function corsHeaders(origin: string): Record<string, string> {
  const allow = ALLOWED.length === 0 ? "*" : (ALLOWED.includes(origin) ? origin : ALLOWED[0]);
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const reply = (body: unknown, status: number, h: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...h, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const h = corsHeaders(req.headers.get("Origin") ?? "");
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return reply({ error: "method" }, 405, h);

  const auth = req.headers.get("Authorization");
  if (!auth) return reply({ error: "auth" }, 401, h);
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return reply({ error: "auth" }, 401, h);

  // 관리자 키는 서버 환경변수에만 있어요 (Supabase가 자동으로 넣어줘요)
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // docs, ai_usage 는 auth.users 삭제 시 함께 지워지도록(on delete cascade) 되어 있어요
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) { console.error("delete failed"); return reply({ error: "server" }, 500, h); }
  console.log("account deleted", user.id);
  return reply({ ok: true }, 200, h);
});
