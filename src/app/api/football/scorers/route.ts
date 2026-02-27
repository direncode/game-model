import { NextResponse } from 'next/server';

const API_KEY = process.env.FOOTBALL_DATA_API_KEY || '';
const BASE_URL = 'https://api.football-data.org/v4';
const CACHE_DURATION = 3600000; // 1 hour

let cache: { data: unknown; timestamp: number } | null = null;

export async function GET() {
  if (!API_KEY) {
    return NextResponse.json({ success: false, error: 'No API key configured' }, { status: 503 });
  }

  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return NextResponse.json({ success: true, data: cache.data, cached: true });
  }

  try {
    const res = await fetch(`${BASE_URL}/competitions/PL/scorers?limit=10`, {
      headers: { 'X-Auth-Token': API_KEY },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: `API error: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    cache = { data: data.scorers || [], timestamp: Date.now() };
    return NextResponse.json({ success: true, data: data.scorers || [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
