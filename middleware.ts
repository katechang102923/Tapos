import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin routes that require admin role
  const adminRoutes = ["/admin", "/admin/users", "/admin/stores"];

  // Check if accessing admin routes
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));

  if (isAdminRoute) {
    // For admin routes, we'll let the component handle the authentication
    // since we need to check Firebase Auth and user roles
    // The LoginGate component will handle the role checking
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};