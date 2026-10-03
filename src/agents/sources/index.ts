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
import { smartRecruitersAdapter } from "./smartrecruiters";
import { workableAdapter } from "./workable";
import { recruiteeAdapter } from "./recruitee";
import { weWorkRemotelyAdapter } from "./weworkremotely";
import { jobspressoAdapter } from "./jobspresso";
import { noDeskAdapter, realWorkFromAnywhereAdapter } from "./workFromHomeFeeds";
import { hackerNewsJobsAdapter } from "./hnjobs";
import { devItJobsAdapter } from "./devitjobs";
import { landingJobsAdapter } from "./landingjobs";
import { fourDayWeekAdapter } from "./fourdayweek";
import { workableJobsAdapter } from "./workableJobs";
import { allCompanyBoards, type CompanyBoard } from "./companyBoards";

// Aggregator boards: one adapter each, all public feeds (JSON APIs or RSS) without keys.
export const boardAdapters: JobSourceAdapter[] = [
  remotiveAdapter,
  arbeitnowAdapter,
  remoteokAdapter,
  jobicyAdapter,
  himalayasAdapter,
  workingNomadsAdapter,
  weWorkRemotelyAdapter,
  jobspressoAdapter,
  noDeskAdapter,
  realWorkFromAnywhereAdapter,
  hackerNewsJobsAdapter,
  devItJobsAdapter,
  landingJobsAdapter,
  fourDayWeekAdapter,
  workableJobsAdapter,
];

// Company career pages: one adapter per configured board (see companyBoards.ts
// for the defaults and the per-platform *_BOARDS overrides). Each shows up as its own JobSource row, so the Overview can
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
      case "smartrecruiters":
        return smartRecruitersAdapter(board);
      case "workable":
        return workableAdapter(board);
      case "recruitee":
        return recruiteeAdapter(board);
    }
  });
}

export const jobSourceAdapters: JobSourceAdapter[] = [...boardAdapters, ...companyBoardAdapters()];

export {
  remotiveAdapter,
  arbeitnowAdapter,
  remoteokAdapter,
  jobicyAdapter,
  himalayasAdapter,
  workingNomadsAdapter,
  weWorkRemotelyAdapter,
  jobspressoAdapter,
  noDeskAdapter,
  realWorkFromAnywhereAdapter,
  hackerNewsJobsAdapter,
  devItJobsAdapter,
  landingJobsAdapter,
  fourDayWeekAdapter,
  workableJobsAdapter,
};
export type { JobSourceAdapter, NormalizedJobPosting } from "./types";
