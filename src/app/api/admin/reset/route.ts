import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { ref, remove, set } from "firebase/database";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    if (!ADMIN_PASSWORD) {
      return NextResponse.json(
        { success: false, error: "Server misconfiguration: ADMIN_PASSWORD not set." },
        { status: 500 },
      );
    }
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ success: false, error: "Invalid password." }, { status: 401 });
    }

    await remove(ref(db, "discussions"));
    await remove(ref(db, "commandments"));
    await remove(ref(db, "confessions"));

    await set(ref(db, "config/isDebateActive"), true);
    await set(ref(db, "config/foundingDate"), Date.now());

    return NextResponse.json({
      success: true,
      message: "All data wiped. Debate restarted from Day 1.",
    });
  } catch (error: unknown) {
    console.error("Reset error:", error);
    const message = error instanceof Error ? error.message : undefined;
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
