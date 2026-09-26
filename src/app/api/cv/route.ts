import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { handle, requireUserId } from "@/lib/api";
import { parseCv } from "@/agents/cvParse";
import { reviewCv } from "@/agents/cvReview";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export async function GET() {
  return handle(async () => {
    const userId = await requireUserId();
    const cvs = await db.cv.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { review: { include: { issues: true } } },
    });
    return NextResponse.json({ cvs });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const userId = await requireUserId();

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field." }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 415 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "File too large (max 10MB)." }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storageKey = `${userId}/${nanoid()}-${file.name}`;
    await getStorage().put(storageKey, buffer);

    const cv = await db.cv.create({
      data: {
        userId,
        fileName: file.name,
        storageKey,
        mimeType: file.type,
        fileSizeBytes: file.size,
      },
    });

    // Parse + review inline for the scaffold. Move behind a queue (BullMQ,
    // Vercel Queues, ...) if you need this endpoint to respond immediately.
    await parseCv(cv.id);
    await reviewCv(cv.id);

    const withReview = await db.cv.findUniqueOrThrow({
      where: { id: cv.id },
      include: { review: { include: { issues: true } } },
    });

    return NextResponse.json({ cv: withReview }, { status: 201 });
  });
}
