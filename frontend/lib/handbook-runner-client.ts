export type RunStep = {
  verb: string;
  duration_ms: number;
  summary: string;
};

export type RunSuccess = {
  ok: true;
  compile_ms: number;
  run_ms: number;
  steps: RunStep[];
  artifact_preview: string;
};

export type RunDiagnostic = {
  line: number;
  col: number;
  token: string;
  message: string;
  hint: string;
};

export type RunError = {
  ok: false;
  category: "type" | "syntax" | "name" | "runtime" | "import";
  diagnostic: RunDiagnostic;
};

export type RunResult = RunSuccess | RunError;

export type RunUnavailable = {
  ok: false;
  category: "unavailable";
  message: string;
};

export async function runSnippet(
  source: string,
  corpus: string,
  signal?: AbortSignal,
): Promise<RunResult | RunUnavailable> {
  try {
    const response = await fetch("/api/handbook/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, corpus }),
      signal,
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After") ?? "60";
      return {
        ok: false,
        category: "unavailable",
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      };
    }
    if (response.status === 503) {
      return {
        ok: false,
        category: "unavailable",
        message: "Runner unavailable. Copy the snippet and run in the REPL.",
      };
    }
    return (await response.json()) as RunResult;
  } catch (e) {
    return {
      ok: false,
      category: "unavailable",
      message: `Network error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
