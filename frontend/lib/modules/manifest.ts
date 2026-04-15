/**
 * Module manifest types — mirrors the backend ModuleManifest schema.
 */

export interface ModuleView {
  id: string;
  component: string;
  route: string;
  label: string;
  icon: string;
}

export interface ModuleAction {
  id: string;
  label: string;
  endpoint: string;
  method: string;
  requiresConfirmation?: boolean;
}

export interface ModuleEntityType {
  name: string;
  color: string;
  primaryField: string;
  secondaryField?: string;
  icon?: string;
}

export interface ModuleManifest {
  id: string;
  version: string;
  displayName: string;
  description: string;
  icon: string;
  adapterType?: string;
  views: ModuleView[];
  entityTypes: ModuleEntityType[];
  actions: ModuleAction[];
  narratives?: Record<string, string>;
  requiredPermissions?: string[];
  minClearance?: string;
  isCore: boolean;
  billable: boolean;
  tier: string;
  enabled?: boolean;
}
