import type { JobSourceAdapter } from "./types";
import { remotiveAdapter } from "./remotive";
import { arbeitnowAdapter } from "./arbeitnow";
import { remoteokAdapter } from "./remoteok";
import { jobicyAdapter } from "./jobicy";
import { himalayasAdapter } from "./himalayas";
import { workingNomadsAdapter } from "./workingnomads";
import { greenhouseAdapter } from "./greenhouse";
import { leverAdapter } from "./lever";
import { ashbyAdapter } from "./ashby";
import { allCompanyBoards, type CompanyBoard } from "./companyBoards";

// Aggregator boards: one adapter each, all public JSON APIs without keys.
export const boardAdapters: JobSourceAdapter[] = [
  remotiveAdapter,
  arbeitnowAdapter,
  remoteokAdapter,
  jobicyAdapter,
  himalayasAdapter,
  workingNomadsAdapter,
];

// Company career pages: one adapter per configured board (see companyBoards.ts
// for the defaults and the GREENHOUSE_BOARDS / LEVER_BOARDS / ASHBY_BOARDS
// overrides). Each shows up as its own JobSource row, so the Overview can
// report per-company health and the feed can say "via Anthropic (Greenhouse)".
export function companyBoardAdapters(boards: CompanyBoard[] = allCompanyBoards()): JobSourceAdapter[] {
  return boards.map((board) => {
    switch (board.platform) {
      case "greenhouse":
        return greenhouseAdapter(board);
      case "lever":
        return leverAdapter(board);
      case "ashby":
        return ashbyAdapter(board);
    }
  });
}

export const jobSourceAdapters: JobSourceAdapter[] = [...boardAdapters, ...companyBoardAdapters()];

export { remotiveAdapter, arbeitnowAdapter, remoteokAdapter, jobicyAdapter, himalayasAdapter, workingNomadsAdapter };
export type { JobSourceAdapter, NormalizedJobPosting } from "./types";
