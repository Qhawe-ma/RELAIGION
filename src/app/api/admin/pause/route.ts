import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { ref, get, set, remove } from "firebase/database";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const DEFAULT_FOUNDING_DATE = new Date("2026-03-07T00:00:00Z").getTime();

// Pause stores the ms left in the current 24h window. Resume adds the paused
// duration onto foundingDate so the day clock continues from where it froze.
export async function POST(request: Request) {
  try {
    const { password, action } = await request.json();
    if (!ADMIN_PASSWORD) {
      return NextResponse.json(
        { success: false, error: "Server misconfiguration: ADMIN_PASSWORD not set." },
        { status: 500 },
      );
    }
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ success: false, error: "Invalid password." }, { status: 401 });
    }

    if (action === "pause") {
      const pausedAt = Date.now();
      const foundingSnap = await get(ref(db, "config/foundingDate"));
      const foundingDate: number = foundingSnap.exists()
        ? foundingSnap.val()
        : DEFAULT_FOUNDING_DATE;
      const msSinceFounding = Math.max(0, pausedAt - foundingDate);
      const dayDurationMs = 24 * 60 * 60 * 1000;
      const frozenRemainingMs = dayDurationMs - (msSinceFounding % dayDurationMs);

      await set(ref(db, "config/isDebateActive"), false);
      await set(ref(db, "config/pausedAt"), pausedAt);
      await set(ref(db, "config/frozenRemainingMs"), frozenRemainingMs);
      return NextResponse.json({ success: true, message: "Debate paused. Timer frozen." });
    }

    if (action === "resume") {
      const pausedAtSnap = await get(ref(db, "config/pausedAt"));
      const foundingSnap = await get(ref(db, "config/foundingDate"));

      if (pausedAtSnap.exists() && foundingSnap.exists()) {
        const pausedAt: number = pausedAtSnap.val();
        const foundingDate: number = foundingSnap.val();
        const pausedDurationMs = Date.now() - pausedAt;
        await set(ref(db, "config/foundingDate"), foundingDate + pausedDurationMs);
      } else if (pausedAtSnap.exists() && !foundingSnap.exists()) {
        const pausedAt: number = pausedAtSnap.val();
        const pausedDurationMs = Date.now() - pausedAt;
        await set(ref(db, "config/foundingDate"), DEFAULT_FOUNDING_DATE + pausedDurationMs);
      }

      await remove(ref(db, "config/pausedAt"));
      await remove(ref(db, "config/frozenRemainingMs"));
      await set(ref(db, "config/isDebateActive"), true);
      return NextResponse.json({ success: true, message: "Debate resumed. Timer restored." });
    }

    return NextResponse.json(
      { success: false, error: "Unknown action. Use 'pause' or 'resume'." },
      { status: 400 },
    );
  } catch (error: unknown) {
    console.error("Pause/resume error:", error);
    const message = error instanceof Error ? error.message : undefined;
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
