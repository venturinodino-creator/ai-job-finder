import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { handle } from "@/lib/api";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = bodySchema.parse(await req.json());
    const user = await db.user.findUnique({ where: { email: body.email } });

    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    await setSessionCookie(createSessionToken(user.id));
    return NextResponse.json({ id: user.id, email: user.email });
  });
}
