export interface SchemaVersionInfo {
  version: string;               // Semantic version (e.g., "1.0.0")
  migrationRequired: boolean;    // Whether migration is needed
  compatibleVersions: string[];  // Backward compatible versions
}

export const CURRENT_SCHEMA_VERSION = "1.0.0";

// Schema migration interface
export interface SchemaMigration {
  fromVersion: string;
  toVersion: string;
  migrate: (data: any) => any;
  validate: (data: any) => boolean;
}