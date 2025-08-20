// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const PROTECTED_PREFIXES = ["/dashboard", "/profile", "/settings"];
const AUTH_PAGES = ["/login", "/signup", "/onboarding"];

export async function middleware(req: NextRequest) {
  // Start a response we can mutate and return
  const res = NextResponse.next();

  // New cookie API for @supabase/ssr: use getAll/setAll
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // read cookies from the incoming request
        getAll() {
          return req.cookies.getAll().map(c => ({
            name: c.name,
            value: c.value,
          }));
        },
        // write cookies to the outgoing response
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh/read the session (this may set cookies — handled by setAll above)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const url = req.nextUrl.clone();
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => url.pathname === p || url.pathname.startsWith(p + "/")
  );
  const isAuthPage = AUTH_PAGES.includes(url.pathname);

  // Gate unauthenticated users
  if (isProtected && !session) {
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // Keep signed-in users off auth pages
  if (isAuthPage && session) {
    url.pathname = "/dashboard";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  // Important: return the same 'res' we mutated so the cookies are preserved
  return res;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/login",
    "/signup",
    "/onboarding",
  ],
};
