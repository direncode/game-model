'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { ModuleManifest } from './manifest';
import { moduleRegistry } from './registry';

interface ModuleContextType {
  modules: ModuleManifest[];
  enabledModules: ModuleManifest[];
  loading: boolean;
  error: string | null;
  enableModule: (moduleId: string) => Promise<void>;
  disableModule: (moduleId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const ModuleContext = createContext<ModuleContextType>({
  modules: [],
  enabledModules: [],
  loading: true,
  error: null,
  enableModule: async () => {},
  disableModule: async () => {},
  refresh: async () => {},
});

export function ModuleProvider({ children }: { children: ReactNode }) {
  const [modules, setModules] = useState<ModuleManifest[]>([]);
  const [enabledModules, setEnabledModules] = useState<ModuleManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      await moduleRegistry.loadFromAPI();
      setModules(moduleRegistry.getAvailable());
      setEnabledModules(moduleRegistry.getEnabled());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load modules';
      setError(message);
      console.error('[ModuleProvider] refresh failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enableModule = useCallback(
    async (moduleId: string) => {
      const ok = await moduleRegistry.enable(moduleId);
      if (!ok) throw new Error(`Failed to enable module "${moduleId}"`);
      setModules(moduleRegistry.getAvailable());
      setEnabledModules(moduleRegistry.getEnabled());
    },
    [],
  );

  const disableModule = useCallback(
    async (moduleId: string) => {
      const ok = await moduleRegistry.disable(moduleId);
      if (!ok) throw new Error(`Failed to disable module "${moduleId}"`);
      setModules(moduleRegistry.getAvailable());
      setEnabledModules(moduleRegistry.getEnabled());
    },
    [],
  );

  return (
    <ModuleContext.Provider
      value={{
        modules,
        enabledModules,
        loading,
        error,
        enableModule,
        disableModule,
        refresh,
      }}
    >
      {children}
    </ModuleContext.Provider>
  );
}

export function useModules() {
  return useContext(ModuleContext);
}
