import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login).*)"],
};

export async function proxy(request: NextRequest) {
  // DASHBOARD_PASSWORD를 설정하지 않으면 로그인 없이 누구나 링크로 접근 가능.
  if (!process.env.DASHBOARD_PASSWORD) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const authed = await verifySessionToken(token);

  if (!authed) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
