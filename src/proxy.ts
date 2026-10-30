import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Next.js 16 renamed `middleware` to `proxy`. This is only the first line of
// defense (redirect anonymous users to /login). Real authorization happens on
// the server in every page, Server Action and tRPC procedure (server/authz.ts).
const PUBLIC_PATHS = ["/", "/login"];

export const proxy = auth((req) => {
  const { pathname, search } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!req.auth && !isPublic) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(url);
  }

  if (req.auth && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Skip Auth.js endpoints, tRPC (it returns 401 JSON itself) and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
