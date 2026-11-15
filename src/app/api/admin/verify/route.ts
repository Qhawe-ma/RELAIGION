import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const correct = process.env.ADMIN_PASSWORD;
    if (!correct) {
      return NextResponse.json(
        { success: false, error: "ADMIN_PASSWORD is not set in environment." },
        { status: 500 },
      );
    }
    if (password !== correct) {
      return NextResponse.json({ success: false, error: "Wrong password." }, { status: 401 });
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : undefined;
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
