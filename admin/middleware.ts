import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth0 } from "./auth0";
export async function middleware(request: NextRequest) {
  const configured = Boolean(process.env.AUTH0_DOMAIN && process.env.AUTH0_SECRET && !process.env.AUTH0_DOMAIN.startsWith("your-"));
  return configured ? await auth0.middleware(request) : NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"] };
