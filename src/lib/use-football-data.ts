'use client';

import { useState, useEffect, useRef } from 'react';
import type { PLStanding, PLMatch, PLTeam } from './premier-league-api';

export interface TopScorer {
  player: { id: number; name: string; nationality: string };
  team: { id: number; name: string; shortName: string; crest: string };
  goals: number;
  assists: number | null;
  penalties: number | null;
}

export interface FootballData {
  standings: PLStanding[];
  homeTeam: PLTeam | null;
  awayTeam: PLTeam | null;
  homeForm: PLMatch[];
  awayForm: PLMatch[];
  scorers: TopScorer[];
  isLoading: boolean;
  error: string | null;
  apiStatus: {
    standings: boolean;
    teams: boolean;
    matches: boolean;
    scorers: boolean;
  };
}

export function useFootballData(): FootballData {
  const [standings, setStandings] = useState<PLStanding[]>([]);
  const [homeTeam, setHomeTeam] = useState<PLTeam | null>(null);
  const [awayTeam, setAwayTeam] = useState<PLTeam | null>(null);
  const [homeForm, setHomeForm] = useState<PLMatch[]>([]);
  const [awayForm, setAwayForm] = useState<PLMatch[]>([]);
  const [scorers, setScorers] = useState<TopScorer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState({
    standings: false,
    teams: false,
    matches: false,
    scorers: false,
  });
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    async function fetchAll() {
      const status = { standings: false, teams: false, matches: false, scorers: false };

      // Fetch all in parallel
      const [teamsRes, standingsRes, homeMatchesRes, awayMatchesRes, scorersRes] = await Promise.allSettled([
        fetch('/api/football/teams'),
        fetch('/api/football/standings'),
        fetch('/api/football/matches?teamId=65&status=FINISHED&limit=5'),
        fetch('/api/football/matches?teamId=66&status=FINISHED&limit=5'),
        fetch('/api/football/scorers'),
      ]);

      // Process teams
      if (teamsRes.status === 'fulfilled' && teamsRes.value.ok) {
        try {
          const json = await teamsRes.value.json();
          if (json.success && Array.isArray(json.data)) {
            const teams: PLTeam[] = json.data;
            const mci = teams.find((t: PLTeam) => t.id === 65) || null;
            const mun = teams.find((t: PLTeam) => t.id === 66) || null;
            setHomeTeam(mci);
            setAwayTeam(mun);
            status.teams = true;
          }
        } catch { /* ignore */ }
      }

      // Process standings
      if (standingsRes.status === 'fulfilled' && standingsRes.value.ok) {
        try {
          const json = await standingsRes.value.json();
          if (json.success && Array.isArray(json.data)) {
            setStandings(json.data);
            status.standings = true;
          }
        } catch { /* ignore */ }
      }

      // Process home matches
      if (homeMatchesRes.status === 'fulfilled' && homeMatchesRes.value.ok) {
        try {
          const json = await homeMatchesRes.value.json();
          if (json.success && Array.isArray(json.data)) {
            setHomeForm(json.data);
            status.matches = true;
          }
        } catch { /* ignore */ }
      }

      // Process away matches
      if (awayMatchesRes.status === 'fulfilled' && awayMatchesRes.value.ok) {
        try {
          const json = await awayMatchesRes.value.json();
          if (json.success && Array.isArray(json.data)) {
            setAwayForm(json.data);
            status.matches = true;
          }
        } catch { /* ignore */ }
      }

      // Process scorers
      if (scorersRes.status === 'fulfilled' && scorersRes.value.ok) {
        try {
          const json = await scorersRes.value.json();
          if (json.success && Array.isArray(json.data)) {
            setScorers(json.data);
            status.scorers = true;
          }
        } catch { /* ignore */ }
      }

      setApiStatus(status);
      const anySuccess = Object.values(status).some(Boolean);
      if (!anySuccess) {
        setError('Football-Data.org API unavailable — using fallback data');
      }
      setIsLoading(false);
    }

    fetchAll();
  }, []);

  return { standings, homeTeam, awayTeam, homeForm, awayForm, scorers, isLoading, error, apiStatus };
}

/** Compute form string from recent matches for a given team ID */
export function computeFormString(matches: PLMatch[], teamId: number): ('W' | 'D' | 'L')[] {
  return matches.slice(0, 5).map(m => {
    const isHome = m.homeTeam.id === teamId;
    const homeGoals = m.score?.fullTime?.home ?? 0;
    const awayGoals = m.score?.fullTime?.away ?? 0;
    if (isHome) {
      if (homeGoals > awayGoals) return 'W';
      if (homeGoals < awayGoals) return 'L';
      return 'D';
    } else {
      if (awayGoals > homeGoals) return 'W';
      if (awayGoals < homeGoals) return 'L';
      return 'D';
    }
  });
}
