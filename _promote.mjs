const REF = "jtdcivneerokhknmfhqe";
const TOKEN = process.env.SBP_TOKEN;
async function q(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return { status: res.status, body: await res.text() };
}

console.log("update:", await q("update public.profiles set role='admin', updated_at=now() where email='moin.in@gmail.com';"));
console.log("verify:", await q("select email, name, role, status from public.profiles order by created_at;"));
