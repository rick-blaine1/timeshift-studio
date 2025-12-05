import { ProjectSchema } from '@/types/schema/Project';
import { SchemaMigration, CURRENT_SCHEMA_VERSION } from '@/types/schema/SchemaVersion';

export class SchemaMigrator {
  private migrations: Map<string, SchemaMigration> = new Map();
  
  registerMigration(migration: SchemaMigration): void {
    const key = `${migration.fromVersion}->${migration.toVersion}`;
    this.migrations.set(key, migration);
  }
  
  async migrateProject(project: any): Promise<ProjectSchema> {
    const currentVersion = project.version || "0.1.0";
    
    if (currentVersion === CURRENT_SCHEMA_VERSION) {
      return project as ProjectSchema;
    }
    
    // Find migration path
    const migrationPath = this.findMigrationPath(currentVersion, CURRENT_SCHEMA_VERSION);
    
    // Apply migrations sequentially
    let migratedProject = project;
    for (const migration of migrationPath) {
      migratedProject = migration.migrate(migratedProject);
      
      if (!migration.validate(migratedProject)) {
        throw new Error(`Migration validation failed: ${migration.fromVersion} -> ${migration.toVersion}`);
      }
    }
    
    return migratedProject;
  }
  
  private findMigrationPath(from: string, to: string): SchemaMigration[] {
    // Implementation for finding optimal migration path
    // This would use graph traversal to find the shortest path
    return [];
  }
}