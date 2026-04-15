'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useModules } from '@/lib/modules/ModuleContext';
import { ModuleShell } from '@/lib/modules/ModuleShell';
import { hasModuleComponent } from '@/lib/modules/loader';

function ModuleNotFound({ moduleId }: { moduleId: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <h2 className="text-2xl font-semibold text-li-text-primary mb-2">
        Module Not Found
      </h2>
      <p className="text-li-text-secondary max-w-md">
        The module &quot;{moduleId}&quot; does not exist or is not available in
        the current registry.
      </p>
    </div>
  );
}

function ModuleDisabled({
  moduleId,
  displayName,
  onEnable,
  enabling,
}: {
  moduleId: string;
  displayName: string;
  onEnable: () => void;
  enabling: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <h2 className="text-2xl font-semibold text-li-text-primary mb-2">
        {displayName}
      </h2>
      <p className="text-li-text-secondary max-w-md mb-6">
        This module is not currently enabled. Enable it to access its features.
      </p>
      <button
        onClick={onEnable}
        disabled={enabling}
        className="px-6 py-2 rounded-lg bg-li-primary text-white font-medium hover:bg-li-primary/90 transition-colors disabled:opacity-50"
      >
        {enabling ? 'Enabling...' : 'Enable Module'}
      </button>
    </div>
  );
}

function ComingSoon({ displayName }: { displayName: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <h2 className="text-2xl font-semibold text-li-text-primary mb-2">
        {displayName}
      </h2>
      <p className="text-li-text-secondary max-w-md">
        This module is enabled but its interface is still under development.
        Check back soon.
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-li-primary" />
    </div>
  );
}

export default function ModulePage() {
  const params = useParams();
  const moduleId = params.moduleId as string;
  const { modules, enabledModules, loading, enableModule } = useModules();
  const [enabling, setEnabling] = React.useState(false);

  if (loading) {
    return <LoadingSkeleton />;
  }

  // Find the module in the full list
  const manifest = modules.find((m) => m.id === moduleId);
  if (!manifest) {
    return <ModuleNotFound moduleId={moduleId} />;
  }

  // Check if enabled
  const isEnabled = enabledModules.some((m) => m.id === moduleId);
  if (!isEnabled) {
    const handleEnable = async () => {
      setEnabling(true);
      try {
        await enableModule(moduleId);
      } catch {
        // Error is logged in the context provider
      } finally {
        setEnabling(false);
      }
    };
    return (
      <ModuleDisabled
        moduleId={moduleId}
        displayName={manifest.displayName}
        onEnable={handleEnable}
        enabling={enabling}
      />
    );
  }

  // Find the default view component
  const defaultView = manifest.views[0];
  if (!defaultView || !hasModuleComponent(defaultView.component)) {
    return <ComingSoon displayName={manifest.displayName} />;
  }

  return <ModuleShell componentName={defaultView.component} />;
}
