/**
 * Module system — public API.
 */

export type {
  ModuleView,
  ModuleAction,
  ModuleEntityType,
  ModuleManifest,
} from './manifest';

export { moduleRegistry } from './registry';
export { loadModuleComponent, hasModuleComponent } from './loader';
export { ModuleShell } from './ModuleShell';
export { ModuleProvider, useModules } from './ModuleContext';
