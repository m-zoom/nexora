import { apiUrl } from "@/lib/api";

// The browser starts a call through here, so it never needs the API's address.
export async function POST() {
  try {
    const res = await fetch(`${apiUrl()}/api/call/session`, { method: "POST", cache: "no-store" });
    return new Response(await res.text(), {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return Response.json({ detail: "The shop assistant is unreachable." }, { status: 502 });
  }
}
