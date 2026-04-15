'use client';

import { Suspense } from 'react';
import { loadModuleComponent } from './loader';

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

function ErrorFallback({ componentName }: { componentName: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
      <p className="text-lg font-medium">Module not available</p>
      <p className="text-sm mt-1">
        Component &quot;{componentName}&quot; could not be loaded.
      </p>
    </div>
  );
}

interface ModuleShellProps {
  componentName: string;
}

/**
 * Generic wrapper that lazily loads and renders a module component by name.
 * Provides a loading spinner fallback while the chunk is fetched.
 */
export function ModuleShell({ componentName }: ModuleShellProps) {
  try {
    const Component = loadModuleComponent(componentName);
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <Component />
      </Suspense>
    );
  } catch {
    return <ErrorFallback componentName={componentName} />;
  }
}
