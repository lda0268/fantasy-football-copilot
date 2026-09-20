export const ROUTES = {
  dashboard: "/",
  team: "/team",
  waivers: "/waivers",
  startSit: "/start-sit",
  matchup: "/matchup",
  players: "/players",
  compare: "/compare",
  league: "/league",
  settings: "/settings",
  draft: "/draft",
} as const;

export type AppPath = (typeof ROUTES)[keyof typeof ROUTES];

export const NAV_ITEMS: Array<{ path: AppPath; label: string }> = [
  { path: ROUTES.dashboard, label: "Dashboard" },
  { path: ROUTES.team, label: "My Team" },
  { path: ROUTES.matchup, label: "Matchup" },
  { path: ROUTES.waivers, label: "Waiver Wire" },
  { path: ROUTES.startSit, label: "Start / Sit" },
  { path: ROUTES.players, label: "Players" },
  { path: ROUTES.compare, label: "Player Compare" },
  { path: ROUTES.league, label: "League" },
  { path: ROUTES.settings, label: "Settings" },
  { path: ROUTES.draft, label: "Draft Room" },
];

export function isAppPath(path: string): path is AppPath {
  return NAV_ITEMS.some((item) => item.path === path);
}
