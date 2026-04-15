/**
 * Module registry — manages available and enabled modules on the client.
 */

import type { ModuleManifest } from './manifest';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

class ModuleRegistryClass {
  private modules: Map<string, ModuleManifest> = new Map();
  private enabledModules: Set<string> = new Set();
  private loaded = false;

  /**
   * Fetch all modules and their enabled state from the backend.
   */
  async loadFromAPI(): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/modules/`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Failed to load modules: ${res.status}`);

      const data: ModuleManifest[] = await res.json();
      this.modules.clear();
      this.enabledModules.clear();

      for (const m of data) {
        this.modules.set(m.id, m);
        if (m.enabled || m.isCore) {
          this.enabledModules.add(m.id);
        }
      }
      this.loaded = true;
    } catch (err) {
      console.error('[ModuleRegistry] Failed to load modules:', err);
    }
  }

  /**
   * Return all modules that are currently enabled.
   */
  getEnabled(): ModuleManifest[] {
    return Array.from(this.modules.values()).filter(
      (m) => m.isCore || this.enabledModules.has(m.id),
    );
  }

  /**
   * Return all registered modules regardless of state.
   */
  getAvailable(): ModuleManifest[] {
    return Array.from(this.modules.values());
  }

  /**
   * Check whether a specific module is enabled.
   */
  isEnabled(moduleId: string): boolean {
    const m = this.modules.get(moduleId);
    if (m?.isCore) return true;
    return this.enabledModules.has(moduleId);
  }

  /**
   * Look up a single module by id.
   */
  getModule(moduleId: string): ModuleManifest | undefined {
    return this.modules.get(moduleId);
  }

  /**
   * Enable a module via the backend API.
   */
  async enable(moduleId: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/modules/${moduleId}/enable`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;
      this.enabledModules.add(moduleId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Disable a module via the backend API.
   */
  async disable(moduleId: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/modules/${moduleId}/disable`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;
      this.enabledModules.delete(moduleId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Whether the registry has been populated at least once.
   */
  isLoaded(): boolean {
    return this.loaded;
  }
}

export const moduleRegistry = new ModuleRegistryClass();
