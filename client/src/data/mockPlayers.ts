import { ESPN_2026_PPR_SOURCE, type Player, type ProjectionStats } from "../types/draft";
import { DEFAULT_LEAGUE } from "../types/league";
import { applyLeagueProjections } from "../engine/scoring";
import { mergeMarketAdp } from "../engine/data/mergeUniverse";
import { SUPERFLEX_CONSENSUS_ADP } from "./superflexConsensusAdp";

type PlayerSeed = Omit<
  Player,
  "espnOverallRank" | "espnPositionalRank" | "espnAuctionValue" | "espnByeWeek" | "espnSource" | "sourceProjectedPoints" | "projectionSource"
>;

const BYES = [5, 6, 7, 8, 9, 10, 11, 12, 14];

function inferStats(seed: PlayerSeed): ProjectionStats | undefined {
  const rank = seed.positionalRank;
  if (seed.position === "QB") {
    const rushing = rank <= 4 || seed.name.includes("Daniels") || seed.name.includes("Murray");
    return {
      passYards: 4300 - (rank - 1) * 90,
      passTD: Math.max(16, 36 - (rank - 1) * 1.1),
      interceptions: rank <= 3 ? 9 : rank <= 8 ? 11 : 12 + (rank - 8),
      rushYards: rushing ? Math.max(280, 720 - rank * 50) : Math.max(40, 200 - rank * 6),
      rushTD: rushing ? Math.max(2, 9 - rank) : 2,
      fumbles: rank >= 15 ? 6 : 3,
    };
  }
  if (seed.position === "WR") {
    return {
      receptions: Math.max(40, 120 - rank * 3.2),
      receivingYards: Math.max(700, 1600 - rank * 38),
      receivingTD: Math.max(4, 14 - rank * 0.4),
      rushYards: rank <= 6 ? 40 : 0,
      returnYards: seed.name.includes("Hill") ? 280 : 0,
      returnTD: seed.name.includes("Hill") ? 1 : 0,
      fumbles: 1,
    };
  }
  if (seed.position === "RB") {
    return {
      rushYards: Math.max(500, 1400 - rank * 40),
      rushTD: Math.max(4, 13 - rank * 0.35),
      receptions: Math.max(20, 80 - rank * 2.4),
      receivingYards: Math.max(150, 650 - rank * 18),
      receivingTD: Math.max(1, 5 - rank * 0.15),
      fumbles: 2,
    };
  }
  if (seed.position === "TE") {
    return {
      receptions: Math.max(40, 110 - rank * 6),
      receivingYards: Math.max(500, 1200 - rank * 70),
      receivingTD: Math.max(3, 10 - rank * 0.6),
      fumbles: 1,
    };
  }
  return undefined;
}

function withEspn(seed: PlayerSeed, overallRank: number): Player {
  return {
    ...seed,
    stats: seed.stats ?? inferStats(seed),
    sourceProjectedPoints: seed.projectedPoints,
    projectionSource: "source",
    espnOverallRank: overallRank,
    espnPositionalRank: seed.positionalRank,
    expertOverallRank: overallRank,
    expertPositionalRank: seed.positionalRank,
    expertSource: "ESPN PPR",
    espnAuctionValue: Math.max(1, Math.round(70 - overallRank * 0.9)),
    espnByeWeek: BYES[(overallRank - 1) % BYES.length],
    espnSource: ESPN_2026_PPR_SOURCE,
    adp: undefined,
    positionalAdp: undefined,
    adpSource: undefined,
  };
}

const CORE: PlayerSeed[] = [
  { id: "p001", name: "Ja'Marr Chase", position: "WR", team: "CIN", adp: 1.2, projectedPoints: 310, positionalRank: 1 },
  { id: "p002", name: "Justin Jefferson", position: "WR", team: "MIN", adp: 2.1, projectedPoints: 305, positionalRank: 2 },
  { id: "p003", name: "Christian McCaffrey", position: "RB", team: "SF", adp: 3.0, projectedPoints: 298, positionalRank: 1 },
  { id: "p004", name: "Bijan Robinson", position: "RB", team: "ATL", adp: 4.3, projectedPoints: 285, positionalRank: 2 },
  { id: "p005", name: "CeeDee Lamb", position: "WR", team: "DAL", adp: 5.1, projectedPoints: 280, positionalRank: 3 },
  { id: "p006", name: "Saquon Barkley", position: "RB", team: "PHI", adp: 6.0, projectedPoints: 275, positionalRank: 3 },
  { id: "p007", name: "Tyreek Hill", position: "WR", team: "MIA", adp: 7.2, projectedPoints: 270, positionalRank: 4 },
  { id: "p008", name: "Amon-Ra St. Brown", position: "WR", team: "DET", adp: 8.1, projectedPoints: 265, positionalRank: 5 },
  { id: "p009", name: "Breece Hall", position: "RB", team: "NYJ", adp: 9.0, projectedPoints: 260, positionalRank: 4 },
  { id: "p010", name: "Travis Kelce", position: "TE", team: "KC", adp: 10.5, projectedPoints: 220, positionalRank: 1 },
  { id: "p011", name: "Josh Allen", position: "QB", team: "BUF", adp: 11.0, projectedPoints: 380, positionalRank: 1 },
  { id: "p012", name: "Nico Collins", position: "WR", team: "HOU", adp: 12.3, projectedPoints: 250, positionalRank: 6 },
  { id: "p013", name: "Jonathan Taylor", position: "RB", team: "IND", adp: 13.1, projectedPoints: 245, positionalRank: 5 },
  { id: "p014", name: "AJ Brown", position: "WR", team: "PHI", adp: 14.0, projectedPoints: 242, positionalRank: 7 },
  { id: "p015", name: "De'Von Achane", position: "RB", team: "MIA", adp: 15.2, projectedPoints: 240, positionalRank: 6 },
  { id: "p016", name: "Garrett Wilson", position: "WR", team: "NYJ", adp: 16.1, projectedPoints: 235, positionalRank: 8 },
  { id: "p017", name: "Lamar Jackson", position: "QB", team: "BAL", adp: 17.0, projectedPoints: 370, positionalRank: 2 },
  { id: "p018", name: "Jahmyr Gibbs", position: "RB", team: "DET", adp: 18.3, projectedPoints: 232, positionalRank: 7 },
  { id: "p019", name: "Drake London", position: "WR", team: "ATL", adp: 19.1, projectedPoints: 228, positionalRank: 9 },
  { id: "p020", name: "Travis Etienne", position: "RB", team: "JAX", adp: 20.0, projectedPoints: 225, positionalRank: 8 },
  { id: "p021", name: "Davante Adams", position: "WR", team: "NYJ", adp: 21.2, projectedPoints: 222, positionalRank: 10 },
  { id: "p022", name: "Kyren Williams", position: "RB", team: "LAR", adp: 22.1, projectedPoints: 220, positionalRank: 9 },
  { id: "p023", name: "Mark Andrews", position: "TE", team: "BAL", adp: 23.0, projectedPoints: 195, positionalRank: 2 },
  { id: "p024", name: "Jaylen Waddle", position: "WR", team: "MIA", adp: 24.3, projectedPoints: 215, positionalRank: 11 },
  { id: "p025", name: "Joe Burrow", position: "QB", team: "CIN", adp: 25.1, projectedPoints: 360, positionalRank: 3 },
  { id: "p026", name: "James Cook", position: "RB", team: "BUF", adp: 26.0, projectedPoints: 212, positionalRank: 10 },
  { id: "p027", name: "Chris Olave", position: "WR", team: "NO", adp: 27.2, projectedPoints: 210, positionalRank: 12 },
  { id: "p028", name: "Alvin Kamara", position: "RB", team: "NO", adp: 28.1, projectedPoints: 208, positionalRank: 11 },
  { id: "p029", name: "DK Metcalf", position: "WR", team: "SEA", adp: 29.0, projectedPoints: 205, positionalRank: 13 },
  { id: "p030", name: "Sam LaPorta", position: "TE", team: "DET", adp: 30.5, projectedPoints: 190, positionalRank: 3 },
  { id: "p031", name: "Jalen Hurts", position: "QB", team: "PHI", adp: 31.2, projectedPoints: 355, positionalRank: 4 },
  { id: "p032", name: "Isiah Pacheco", position: "RB", team: "KC", adp: 32.1, projectedPoints: 200, positionalRank: 12 },
  { id: "p033", name: "Tee Higgins", position: "WR", team: "CIN", adp: 33.0, projectedPoints: 198, positionalRank: 14 },
  { id: "p034", name: "Derrick Henry", position: "RB", team: "BAL", adp: 34.2, projectedPoints: 195, positionalRank: 13 },
  { id: "p035", name: "George Kittle", position: "TE", team: "SF", adp: 35.1, projectedPoints: 185, positionalRank: 4 },
  { id: "p036", name: "Mike Evans", position: "WR", team: "TB", adp: 36.0, projectedPoints: 192, positionalRank: 15 },
  { id: "p037", name: "Rachaad White", position: "RB", team: "TB", adp: 37.3, projectedPoints: 190, positionalRank: 14 },
  { id: "p038", name: "Stefon Diggs", position: "WR", team: "HOU", adp: 38.1, projectedPoints: 188, positionalRank: 16 },
  { id: "p039", name: "Tony Pollard", position: "RB", team: "TEN", adp: 39.0, projectedPoints: 185, positionalRank: 15 },
  { id: "p040", name: "Trey McBride", position: "TE", team: "ARI", adp: 40.5, projectedPoints: 180, positionalRank: 5 },
  { id: "p041", name: "Patrick Mahomes", position: "QB", team: "KC", adp: 41.2, projectedPoints: 340, positionalRank: 5 },
  { id: "p042", name: "David Montgomery", position: "RB", team: "DET", adp: 42.1, projectedPoints: 182, positionalRank: 16 },
  { id: "p043", name: "Brandon Aiyuk", position: "WR", team: "SF", adp: 43.0, projectedPoints: 180, positionalRank: 17 },
  { id: "p044", name: "Joe Mixon", position: "RB", team: "HOU", adp: 44.3, projectedPoints: 178, positionalRank: 17 },
  { id: "p045", name: "Cooper Kupp", position: "WR", team: "LAR", adp: 45.1, projectedPoints: 175, positionalRank: 18 },
  { id: "p046", name: "Jordan Addison", position: "WR", team: "MIN", adp: 46.0, projectedPoints: 172, positionalRank: 19 },
  { id: "p047", name: "Zamir White", position: "RB", team: "LV", adp: 47.2, projectedPoints: 170, positionalRank: 18 },
  { id: "p048", name: "Evan Engram", position: "TE", team: "JAX", adp: 48.1, projectedPoints: 170, positionalRank: 6 },
  { id: "p049", name: "Brock Purdy", position: "QB", team: "SF", adp: 49.0, projectedPoints: 330, positionalRank: 6 },
  { id: "p050", name: "Rashee Rice", position: "WR", team: "KC", adp: 50.3, projectedPoints: 168, positionalRank: 20 },
  { id: "p051", name: "Jayden Daniels", position: "QB", team: "WAS", adp: 51.1, projectedPoints: 325, positionalRank: 7 },
  { id: "p052", name: "Brian Robinson Jr.", position: "RB", team: "WAS", adp: 52.0, projectedPoints: 165, positionalRank: 19 },
  { id: "p053", name: "Jerry Jeudy", position: "WR", team: "CLE", adp: 53.2, projectedPoints: 162, positionalRank: 21 },
  { id: "p054", name: "David Njoku", position: "TE", team: "CLE", adp: 54.1, projectedPoints: 165, positionalRank: 7 },
  { id: "p055", name: "Caleb Williams", position: "QB", team: "CHI", adp: 55.0, projectedPoints: 320, positionalRank: 8 },
  { id: "p056", name: "D'Andre Swift", position: "RB", team: "CHI", adp: 56.3, projectedPoints: 160, positionalRank: 20 },
  { id: "p057", name: "Marvin Harrison Jr.", position: "WR", team: "ARI", adp: 57.1, projectedPoints: 158, positionalRank: 22 },
  { id: "p058", name: "Kyle Pitts", position: "TE", team: "ATL", adp: 58.0, projectedPoints: 160, positionalRank: 8 },
];

const EXTRA_QBS: PlayerSeed[] = [
  { id: "p059", name: "Dak Prescott", position: "QB", team: "DAL", adp: 62, projectedPoints: 312, positionalRank: 9 },
  { id: "p060", name: "Justin Herbert", position: "QB", team: "LAC", adp: 68, projectedPoints: 305, positionalRank: 10 },
  { id: "p061", name: "Kyler Murray", position: "QB", team: "ARI", adp: 74, projectedPoints: 298, positionalRank: 11 },
  { id: "p062", name: "Baker Mayfield", position: "QB", team: "TB", adp: 80, projectedPoints: 292, positionalRank: 12 },
  { id: "p063", name: "Trevor Lawrence", position: "QB", team: "JAX", adp: 86, projectedPoints: 285, positionalRank: 13 },
  { id: "p064", name: "Jordan Love", position: "QB", team: "GB", adp: 92, projectedPoints: 278, positionalRank: 14 },
  { id: "p065", name: "Bo Nix", position: "QB", team: "DEN", adp: 98, projectedPoints: 272, positionalRank: 15 },
  { id: "p066", name: "C.J. Stroud", position: "QB", team: "HOU", adp: 104, projectedPoints: 266, positionalRank: 16 },
  { id: "p067", name: "Jared Goff", position: "QB", team: "DET", adp: 110, projectedPoints: 260, positionalRank: 17 },
  { id: "p068", name: "Tua Tagovailoa", position: "QB", team: "MIA", adp: 116, projectedPoints: 254, positionalRank: 18 },
  { id: "p069", name: "Drake Maye", position: "QB", team: "NE", adp: 122, projectedPoints: 248, positionalRank: 19 },
  { id: "p070", name: "Geno Smith", position: "QB", team: "SEA", adp: 128, projectedPoints: 242, positionalRank: 20 },
];

const KICKERS: PlayerSeed[] = [
  { id: "p071", name: "Justin Tucker", position: "K", team: "BAL", adp: 140, projectedPoints: 145, positionalRank: 1 },
  { id: "p072", name: "Harrison Butker", position: "K", team: "KC", adp: 148, projectedPoints: 140, positionalRank: 2 },
];

const DEFENSES: PlayerSeed[] = [
  { id: "p073", name: "Ravens D/ST", position: "DEF", team: "BAL", adp: 136, projectedPoints: 150, positionalRank: 1 },
  { id: "p074", name: "49ers D/ST", position: "DEF", team: "SF", adp: 144, projectedPoints: 142, positionalRank: 2 },
];

const ALL_SEEDS: PlayerSeed[] = [...CORE, ...EXTRA_QBS, ...KICKERS, ...DEFENSES];

const projected = applyLeagueProjections(
  ALL_SEEDS
    .map((seed) => ({ seed, order: seed.adp ?? seed.positionalRank }))
    .sort((a, b) => a.order - b.order)
    .map((item, index) => withEspn(item.seed, index + 1)),
  DEFAULT_LEAGUE,
);

export const MOCK_PLAYERS: Player[] = mergeMarketAdp(projected, SUPERFLEX_CONSENSUS_ADP).players;
