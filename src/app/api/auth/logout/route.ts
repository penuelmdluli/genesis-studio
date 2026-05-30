import { NextRequest, NextResponse } from "next/server";
import {
  validateSession,
  destroySession,
  getSessionCookieName,
  buildClearSessionCookie,
} from "@/lib/auth-custom/session";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(getSessionCookieName())?.value;
    if (token) {
      const session = await validateSession(token);
      if (session) {
        await destroySession(session.sessionId);
      }
    }

    const response = NextResponse.json({ ok: true });
    response.headers.set("Set-Cookie", buildClearSessionCookie());
    return response;
  } catch {
    const response = NextResponse.json({ ok: true });
    response.headers.set("Set-Cookie", buildClearSessionCookie());
    return response;
  }
}
