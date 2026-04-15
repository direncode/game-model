/**
 * Dynamic module component loader — maps component names to lazy imports.
 */

import { lazy, type ComponentType } from 'react';

type LazyLoader = () => Promise<{ default: ComponentType<any> }>;

/**
 * Map of component names (from module manifests) to their lazy-import
 * factory functions.  Add new entries here as new verticals are built.
 */
const MODULE_COMPONENTS: Record<string, LazyLoader> = {
  // Core engine
  BTUTOverview:          () => import('@/app/btut/page'),
  FlowEngineOverview:    () => import('@/app/flow-engine/page'),
  EngineDashboard:       () => import('@/app/engine/page'),

  // Structural discovery
  TCDOverview:           () => import('@/app/tcd-jepa/page'),

  // Finance (alias for engine)
  FinanceDashboard:      () => import('@/app/engine/page'),

  // DUNC sports
  DUNCDashboard:         () => import('@/app/dunc/page'),

  // Data estate
  DataEstateDashboard:   () => import('@/app/data-estate/page'),

  // Data layer
  DataLayerDashboard:    () => import('@/app/data-layer/page'),

  // Franklin
  FranklinDashboard:     () => import('@/app/franklin/page'),

  // Search
  SearchOverview:        () => import('@/app/search/page'),

  // Alerts
  AlertsDashboard:       () => import('@/app/alerts/page'),

  // Settings
  SettingsOverview:      () => import('@/app/settings/page'),

  // Admin
  AdminDashboard:        () => import('@/app/admin/page'),

  // Datasets
  DatasetsDashboard:     () => import('@/app/datasets/page'),
};

/**
 * A placeholder component displayed when a module's component has not
 * been implemented yet.
 */
const ComingSoonPlaceholder: LazyLoader = () =>
  Promise.resolve({
    default: function ComingSoon() {
      return null; // Rendered via ModuleShell fallback
    } as unknown as ComponentType<any>,
  });

/**
 * Return a React.lazy component for the given manifest component name.
 * If the component is not registered, returns a "Coming soon" placeholder
 * instead of throwing.
 */
export function loadModuleComponent(componentName: string): React.LazyExoticComponent<ComponentType<any>> {
  const loader = MODULE_COMPONENTS[componentName];
  if (!loader) {
    console.warn(
      `[ModuleLoader] Unknown component: "${componentName}". ` +
      `Register it in frontend/lib/modules/loader.ts.`,
    );
    return lazy(ComingSoonPlaceholder);
  }
  return lazy(loader);
}

/**
 * Check whether a component name has a registered loader.
 */
export function hasModuleComponent(componentName: string): boolean {
  return componentName in MODULE_COMPONENTS;
}
