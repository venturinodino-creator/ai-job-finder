// Static achievement catalog. `check` reads a small stats snapshot (built in
// gamification.ts from real counts) and decides whether the achievement is
// met — it never touches the database itself, so it's easy to unit test.
export interface AchievementStats {
  profileCount: number;
  cvCount: number;
  topCvScore: number;
  tailoredCount: number;
  appliedCount: number;
  viewedCount: number;
  longestStreak: number;
}

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  sortOrder: number;
  check: (stats: AchievementStats) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: "first-profile",
    name: "Mission Briefing",
    description: "Set up your first search profile.",
    icon: "🧭",
    points: 10,
    sortOrder: 1,
    check: (s) => s.profileCount >= 1,
  },
  {
    key: "first-cv",
    name: "On the Record",
    description: "Upload your first CV.",
    icon: "📄",
    points: 10,
    sortOrder: 2,
    check: (s) => s.cvCount >= 1,
  },
  {
    key: "cv-strong",
    name: "Sharpshooter",
    description: "Get a CV review score of 80 or higher.",
    icon: "🎯",
    points: 25,
    sortOrder: 3,
    check: (s) => s.topCvScore >= 80,
  },
  {
    key: "first-tailor",
    name: "Custom Fit",
    description: "Tailor your CV to a specific job for the first time.",
    icon: "✂️",
    points: 15,
    sortOrder: 4,
    check: (s) => s.tailoredCount >= 1,
  },
  {
    key: "five-tailors",
    name: "Tailor-Made",
    description: "Tailor your CV for 5 different jobs.",
    icon: "🧵",
    points: 30,
    sortOrder: 5,
    check: (s) => s.tailoredCount >= 5,
  },
  {
    key: "first-apply",
    name: "Signal Sent",
    description: "Mark your first job as applied.",
    icon: "📡",
    points: 15,
    sortOrder: 6,
    check: (s) => s.appliedCount >= 1,
  },
  {
    key: "ten-applied",
    name: "In the Field",
    description: "Mark 10 jobs as applied.",
    icon: "🚀",
    points: 40,
    sortOrder: 7,
    check: (s) => s.appliedCount >= 10,
  },
  {
    key: "explorer-25",
    name: "Wide Scan",
    description: "Open 25 different job postings.",
    icon: "🔭",
    points: 20,
    sortOrder: 8,
    check: (s) => s.viewedCount >= 25,
  },
  {
    key: "streak-3",
    name: "Locked On",
    description: "Check in 3 days in a row.",
    icon: "🔥",
    points: 15,
    sortOrder: 9,
    check: (s) => s.longestStreak >= 3,
  },
  {
    key: "streak-7",
    name: "Radar Lock",
    description: "Check in 7 days in a row.",
    icon: "📶",
    points: 35,
    sortOrder: 10,
    check: (s) => s.longestStreak >= 7,
  },
];
