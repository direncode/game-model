/**
 * Path resolution shared by store / encryption / audit.
 * Lives in its own module to avoid circular imports.
 */
import path from "node:path";

export function modelsRoot(): string {
  const candidates = [
    process.env.FORMED_MODELS_DIR,
    "/data/formed_models",
    path.resolve(process.cwd(), "..", "data", "formed_models"),
  ].filter(Boolean) as string[];
  return candidates[0]!;
}
