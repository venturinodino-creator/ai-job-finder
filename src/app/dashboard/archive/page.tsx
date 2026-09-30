import { permanentRedirect } from "next/navigation";

/** The archive moved under Jobs; old links and bookmarks land on the new address. */
export default function ArchiveRedirect() {
  permanentRedirect("/dashboard/jobs/archive");
}
