import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSessionToken, hashPassword, setSessionCookie } from "@/lib/auth";
import { handle } from "@/lib/api";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = bodySchema.parse(await req.json());

    const existing = await db.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const user = await db.user.create({
      data: {
        email: body.email,
        passwordHash: await hashPassword(body.password),
        name: body.name,
      },
    });

    await setSessionCookie(createSessionToken(user.id));
    return NextResponse.json({ id: user.id, email: user.email });
  });
}
