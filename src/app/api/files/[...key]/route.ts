import { NextRequest, NextResponse } from "next/server";
import { ApiError, handle, requireUserId } from "@/lib/api";
import { getStorage } from "@/lib/storage";

// Local-storage CVs are keyed "<userId>/<file>" (see /api/cv POST), so
// ownership is enforced by checking the key's prefix against the session.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  return handle(async () => {
    const userId = await requireUserId();
    const { key } = await params;
    const decodedKey = key.map(decodeURIComponent).join("/");
    if (!decodedKey.startsWith(`${userId}/`)) {
      throw new ApiError(403, "Forbidden");
    }

    const buffer = await getStorage().get(decodedKey);
    // Buffer satisfies BodyInit at runtime; @types/node's generic Uint8Array
    // clashes with lib.dom's BodyInit in some TS/Node type combos.
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: { "Content-Type": "application/octet-stream" },
    });
  });
}
