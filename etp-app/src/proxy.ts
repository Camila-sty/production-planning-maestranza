import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  if (process.env.DEV_AUTH === "true") {
    const session = request.cookies.get("dev-session");
    const { pathname } = request.nextUrl;
    const isPublic =
      pathname.startsWith("/auth") || pathname.startsWith("/api/auth/");
    if (!session && !isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
