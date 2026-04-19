// Demo fixture data. Replaced by backend fetch once /v1/matches is wired.

export type Team = {
  id: string;
  name: string;
  short: string;
  crestBg: string;
  crestFg: string;
};

export type Match = {
  id: string;
  league: string;
  leagueShort: string;
  competition: string;
  venue?: string;
  kickoff: string; // HH:MM
  status: "scheduled" | "live" | "finished";
  minute?: number;
  score?: { home: number; away: number };
  home: Team;
  away: Team;
  odds?: { home: number; draw: number; away: number };
  fairProb?: { home: number; draw: number; away: number };
  hasJohnTake?: boolean;
};

export const MATCHES: Match[] = [
  {
    id: "demo-mun-lee",
    league: "Premier League",
    leagueShort: "PL",
    competition: "Premier League",
    venue: "Old Trafford",
    kickoff: "21:00",
    status: "scheduled",
    home: { id: "mun", name: "Manchester United", short: "MU", crestBg: "#DA291C", crestFg: "#ffffff" },
    away: { id: "lee", name: "Leeds United",      short: "LU", crestBg: "#FFCD00", crestFg: "#1D428A" },
    odds:      { home: 1.73, draw: 3.87, away: 4.95 },
    fairProb:  { home: 0.551, draw: 0.245, away: 0.204 },
    hasJohnTake: true,
  },
  {
    id: "che-tot",
    league: "Premier League",
    leagueShort: "PL",
    competition: "Premier League",
    kickoff: "19:30",
    status: "scheduled",
    home: { id: "che", name: "Chelsea",   short: "CHE", crestBg: "#034694", crestFg: "#ffffff" },
    away: { id: "tot", name: "Tottenham", short: "TOT", crestBg: "#ffffff", crestFg: "#132257" },
    odds: { home: 1.95, draw: 3.60, away: 3.80 },
  },
  {
    id: "sun-nor",
    league: "Championship",
    leagueShort: "CHP",
    competition: "Championship",
    kickoff: "20:00",
    status: "scheduled",
    home: { id: "sun", name: "Sunderland", short: "SUN", crestBg: "#E03A3E", crestFg: "#ffffff" },
    away: { id: "nor", name: "Norwich",    short: "NOR", crestBg: "#FFF200", crestFg: "#00A650" },
    odds: { home: 2.10, draw: 3.30, away: 3.40 },
  },
  {
    id: "liv-ars",
    league: "Premier League",
    leagueShort: "PL",
    competition: "Premier League",
    kickoff: "18:30",
    status: "live",
    minute: 69,
    score: { home: 2, away: 1 },
    home: { id: "liv", name: "Liverpool", short: "LIV", crestBg: "#C8102E", crestFg: "#ffffff" },
    away: { id: "ars", name: "Arsenal",   short: "ARS", crestBg: "#EF0107", crestFg: "#ffffff" },
  },
];

export function getMatch(id: string): Match | undefined {
  return MATCHES.find((m) => m.id === id);
}
