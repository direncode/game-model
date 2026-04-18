"use client";

import { useState } from "react";
import Link from "next/link";
import { predictionsApi } from "@/lib/dunc/predictions-api";
import type { MatchPrediction, ModelStatus } from "@/lib/dunc/types";
import { MatchPredictionCard } from "@/components/dunc/predictions/MatchPredictionCard";
import { ModelStatusPanel } from "@/components/dunc/predictions/ModelStatusPanel";

const SAMPLE_MATCHES = [
  { home: "Arsenal", away: "Brighton", league: "Premier League" },
  { home: "Liverpool", away: "Chelsea", league: "Premier League" },
  { home: "Barcelona", away: "Real Madrid", league: "La Liga" },
  { home: "Bayern Munich", away: "Dortmund", league: "Bundesliga" },
  { home: "Man City", away: "Tottenham", league: "Premier League" },
];

export default function PredictionsPage() {
  const [predictions, setPredictions] = useState<MatchPrediction[]>([]);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom match
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [league, setLeague] = useState("Premier League");

  async function loadSamplePredictions() {
    setLoading(true);
    setError(null);
    try {
      const results: MatchPrediction[] = [];
      for (const match of SAMPLE_MATCHES) {
        const pred = await predictionsApi.analyze(match.home, match.away, match.league);
        results.push(pred);
      }
      setPredictions(results);
      const status = await predictionsApi.modelStatus();
      setModelStatus(status);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function analyzeCustom() {
    if (!homeTeam.trim() || !awayTeam.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const pred = await predictionsApi.analyze(homeTeam.trim(), awayTeam.trim(), league);
      setPredictions((prev) => [pred, ...prev]);
      if (!modelStatus) {
        const status = await predictionsApi.modelStatus();
        setModelStatus(status);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const status = await predictionsApi.refreshModel();
      setModelStatus(status as unknown as ModelStatus);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center justify-between px-6 h-14 border-b border-li-border">
        <div className="flex items-baseline gap-3">
          <Link href="/dunc" className="font-display text-xl tracking-tight hover:text-li-cyan transition-colors">
            D-U-N-C
          </Link>
          <span className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
            Match Predictions
          </span>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 max-w-7xl w-full mx-auto">
        {/* Hero */}
        <div className="mb-8">
          <div className="text-[10px] uppercase tracking-widest text-li-cyan font-mono mb-2">
            Triple-Layer Prediction Engine
          </div>
          <h1 className="font-display text-3xl md:text-4xl leading-tight tracking-tight">
            Bookmaker + Crowd Intelligence + ML
          </h1>
          <p className="text-sm text-li-text-secondary mt-2 max-w-2xl">
            Fusing bookmaker odds, Polymarket prediction market data, and a custom ML ensemble
            to analyze match probabilities. Claude interprets divergences between sources.
            This is an analytical research tool — not betting advice.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: Controls + Predictions */}
          <div className="lg:col-span-3 space-y-6">
            {/* Custom Analysis */}
            <div className="border border-li-border rounded-md p-4 bg-li-black-surface">
              <div className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono mb-3">
                Analyze a Match
              </div>
              <div className="flex flex-wrap gap-3">
                <input
                  value={homeTeam}
                  onChange={(e) => setHomeTeam(e.target.value)}
                  placeholder="Home team"
                  className="bg-li-black border border-li-border rounded-sm px-3 py-2 text-sm font-mono text-li-white focus:outline-none focus:border-li-cyan flex-1 min-w-[140px]"
                />
                <span className="text-li-text-muted self-center text-sm">vs</span>
                <input
                  value={awayTeam}
                  onChange={(e) => setAwayTeam(e.target.value)}
                  placeholder="Away team"
                  className="bg-li-black border border-li-border rounded-sm px-3 py-2 text-sm font-mono text-li-white focus:outline-none focus:border-li-cyan flex-1 min-w-[140px]"
                />
                <select
                  value={league}
                  onChange={(e) => setLeague(e.target.value)}
                  className="bg-li-black border border-li-border rounded-sm px-3 py-2 text-sm font-mono text-li-white focus:outline-none focus:border-li-cyan"
                >
                  <option>Premier League</option>
                  <option>La Liga</option>
                  <option>Bundesliga</option>
                  <option>Serie A</option>
                  <option>Ligue 1</option>
                </select>
                <button
                  type="button"
                  onClick={analyzeCustom}
                  disabled={loading || !homeTeam.trim() || !awayTeam.trim()}
                  className="px-5 py-2 bg-li-cyan text-li-black text-sm font-bold tracking-wide rounded-sm hover:bg-li-cyan/80 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Analyzing..." : "Analyze"}
                </button>
              </div>
            </div>

            {/* Quick Load */}
            {predictions.length === 0 && !loading && (
              <button
                type="button"
                onClick={loadSamplePredictions}
                className="w-full py-4 border border-dashed border-li-border rounded-md text-sm text-li-text-muted hover:border-li-cyan hover:text-li-cyan transition-colors font-mono"
              >
                Load sample predictions (EPL, La Liga, Bundesliga)
              </button>
            )}

            {error && (
              <div className="text-sm text-li-red font-mono border border-li-red/30 bg-li-red/5 rounded-md p-3">
                {error}
              </div>
            )}

            {loading && predictions.length === 0 && (
              <div className="text-center py-12 text-li-text-muted font-mono text-sm">
                Initializing prediction engine... (first run fetches historical data and trains the model)
              </div>
            )}

            {/* Prediction Cards */}
            <div className="space-y-4">
              {predictions.map((p) => (
                <MatchPredictionCard key={p.match_key} prediction={p} />
              ))}
            </div>
          </div>

          {/* Right: Model Status */}
          <div className="space-y-4">
            <ModelStatusPanel status={modelStatus} onRefresh={handleRefresh} refreshing={refreshing} />

            <div className="border border-li-border rounded-md p-4 bg-li-black-surface">
              <div className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono mb-3">
                About
              </div>
              <div className="text-xs text-li-text-secondary leading-relaxed space-y-2">
                <p>
                  Three probability layers fused into one analytical view.
                  Divergences between bookmaker, crowd, and ML predictions
                  reveal where sources disagree — the most interesting signal.
                </p>
                <p>
                  Model: XGBoost + Random Forest + Logistic Regression ensemble.
                  Data: 3-5 seasons across top European leagues.
                </p>
                <p className="text-li-text-muted italic">
                  Analytical research tool. Not betting advice.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
