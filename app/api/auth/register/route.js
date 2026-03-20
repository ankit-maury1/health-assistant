export async function POST(req) {
  void req;
  return new Response(JSON.stringify({ error: "Email/password signup is disabled. Please continue with Google." }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}
