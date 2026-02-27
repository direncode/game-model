import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.FOOTBALL_DATA_API_KEY || '';
const BASE_URL = 'https://api.football-data.org/v4';
const CACHE_DURATION = 1800000; // 30 minutes

const matchCache = new Map<string, { data: unknown; timestamp: number }>();

export async function GET(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ success: false, error: 'No API key configured' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get('teamId');
  const status = searchParams.get('status') || 'FINISHED';
  const limit = searchParams.get('limit') || '5';

  const cacheKey = `${teamId}-${status}-${limit}`;
  const cached = matchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return NextResponse.json({ success: true, data: cached.data, cached: true });
  }

  try {
    const endpoint = teamId
      ? `${BASE_URL}/teams/${teamId}/matches?status=${status}&limit=${limit}`
      : `${BASE_URL}/competitions/PL/matches?status=${status}`;

    const res = await fetch(endpoint, {
      headers: { 'X-Auth-Token': API_KEY },
      next: { revalidate: 1800 },
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: `API error: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    const matches = data.matches || [];
    matchCache.set(cacheKey, { data: matches, timestamp: Date.now() });
    return NextResponse.json({ success: true, data: matches });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
