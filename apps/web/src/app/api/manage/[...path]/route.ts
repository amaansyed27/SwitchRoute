import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function originAllowed(request: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

async function forward(request: NextRequest, path: string[]) {
  if (!originAllowed(request)) {
    return NextResponse.json({ error: { message: "Cross-origin management request rejected.", code: "authentication_error" } }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || !claims?.claims?.sub) {
    return NextResponse.json({ error: { message: "Authentication required.", code: "authentication_error" } }, { status: 401 });
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return NextResponse.json({ error: { message: "Authentication required.", code: "authentication_error" } }, { status: 401 });
  }

  const gateway = process.env.GATEWAY_URL ?? process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:8000";
  const target = new URL(`/manage/${path.join("/")}`, gateway);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value));
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.text();
  try {
    const upstream = await fetch(target, {
      method: request.method,
      body,
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { "Content-Type": request.headers.get("content-type") ?? "application/json" } : {}) },
    });
    const content = upstream.status === 204 ? null : await upstream.text();
    return new NextResponse(content, { status: upstream.status, headers: content ? { "Content-Type": upstream.headers.get("content-type") ?? "application/json" } : undefined });
  } catch {
    return NextResponse.json({ error: { message: "Gateway is unavailable.", code: "provider_unavailable" } }, { status: 503 });
  }
}

type Context = { params: Promise<{ path: string[] }> };
export async function GET(request: NextRequest, context: Context) { return forward(request, (await context.params).path); }
export async function POST(request: NextRequest, context: Context) { return forward(request, (await context.params).path); }
export async function PUT(request: NextRequest, context: Context) { return forward(request, (await context.params).path); }
export async function DELETE(request: NextRequest, context: Context) { return forward(request, (await context.params).path); }
