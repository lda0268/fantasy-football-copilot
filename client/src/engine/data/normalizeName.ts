import { normalizePosition } from "./normalizePosition";

const SUFFIXES = /\b(jr|sr|ii|iii|iv|v)\b/g;

const TEAM_ALIASES: Record<string, string> = {
  jac: "jax",
  jax: "jax",
  wsh: "was",
  washington: "was",
  arz: "ari",
  gbp: "gb",
  gnb: "gb",
  kan: "kc",
  sfo: "sf",
  tam: "tb",
  nwe: "ne",
  nor: "no",
  sdg: "lac",
  oah: "lv",
  rai: "lv",
  lvr: "lv",
  lv: "lv",
};

const MASCOT_TO_TEAM: Record<string, string> = {
  cardinals: "ari",
  falcons: "atl",
  ravens: "bal",
  bills: "buf",
  panthers: "car",
  bears: "chi",
  bengals: "cin",
  browns: "cle",
  cowboys: "dal",
  broncos: "den",
  lions: "det",
  packers: "gb",
  texans: "hou",
  colts: "ind",
  jaguars: "jax",
  chiefs: "kc",
  raiders: "lv",
  chargers: "lac",
  rams: "lar",
  dolphins: "mia",
  vikings: "min",
  patriots: "ne",
  saints: "no",
  giants: "nyg",
  jets: "nyj",
  eagles: "phi",
  steelers: "pit",
  niner: "sf",
  niners: "sf",
  "49ers": "sf",
  seahawks: "sea",
  buccaneers: "tb",
  bucs: "tb",
  titans: "ten",
  commanders: "was",
};

const FIRST_NAME_ALIASES: Record<string, string[]> = {
  cam: ["cameron"],
  cameron: ["cam"],
  ken: ["kenneth"],
  kenny: ["kenneth"],
  kenneth: ["ken", "kenny"],
  chig: ["chigoziem"],
  chigoziem: ["chig"],
};

export function normalizePlayerName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/\./g, " ")
    .replace(SUFFIXES, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(d st|dst|defense)\b/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b([a-z])\s+(?=[a-z]\b)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function expandNormalizedNames(name: string): string[] {
  const normalized = normalizePlayerName(name);
  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length === 0) {
    return [];
  }

  const names = new Set<string>([normalized]);
  const aliases = FIRST_NAME_ALIASES[tokens[0]] ?? [];
  for (const alias of aliases) {
    names.add([alias, ...tokens.slice(1)].join(" ").trim());
  }
  return [...names];
}

export function normalizeTeam(team: string | undefined): string | undefined {
  if (!team) {
    return undefined;
  }
  const compact = team.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (compact === "uns" || compact === "fa") {
    return undefined;
  }
  return TEAM_ALIASES[compact] ?? compact;
}

export function defenseTeamKey(name: string, team?: string): string | undefined {
  const fromTeam = normalizeTeam(team);
  if (fromTeam) {
    return fromTeam;
  }

  const normalized = normalizePlayerName(name);
  const tokens = normalized.split(" ").filter(Boolean);
  const mascot = tokens[tokens.length - 1];
  return MASCOT_TO_TEAM[mascot] ?? MASCOT_TO_TEAM[tokens.join("")] ?? fromTeam;
}

export function identityKey(name: string, position: string, team?: string): string {
  const pos = normalizePosition(position) ?? position.toUpperCase();
  if (pos === "DEF") {
    const defenseTeam = defenseTeamKey(name, team) ?? normalizePlayerName(name);
    return `def|${defenseTeam}`;
  }
  return `${normalizePlayerName(name)}|${pos}`;
}

export function identityKeys(name: string, position: string, team?: string): string[] {
  const pos = normalizePosition(position) ?? position.toUpperCase();
  if (pos === "DEF") {
    return [identityKey(name, pos, team)];
  }
  return expandNormalizedNames(name).map((alias) => `${alias}|${pos}`);
}
