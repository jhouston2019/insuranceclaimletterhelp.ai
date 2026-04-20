import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Only block when an explicit marker says the user is unpaid.
 * Do not block on missing/error states (marketing and unknowns stay reachable).
 */
export function middleware(request: NextRequest) {
  const unpaid = request.nextUrl.searchParams.get("unpaid");
  if (unpaid === "1" || unpaid === "true") {
    return NextResponse.redirect(new URL("/pricing", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app", "/app/(.*)"],
};
