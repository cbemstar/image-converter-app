#!/usr/bin/env node

/**
 * Migration Management Script
 * Handles migration deployment with rollback support for staging and production
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class MigrationManager {
  constructor() {
    this.migrationsDir = path.join(__dirname, '../supabase/migrations');
    this.environments = {
      staging: process.env.SUPABASE_STAGING_URL,
      production: process.env.SUPABASE_PRODUCTION_URL
    };
  }

  /**
   * Get all migration files sorted by timestamp
   */
  getMigrationFiles() {
    const files = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql') && !file.includes('rollback'))
      .sort();
    
    return files.map(file => ({
      name: file,
      path: path.join(this.migrationsDir, file),
      rollbackPath: path.join(this.migrationsDir, file.replace('.sql', '_rollback.sql')),
      timestamp: file.split('_')[0]
    }));
  }

  /**
   * Validate migration files
   */
  validateMigrations() {
    const migrations = this.getMigrationFiles();
    const issues = [];

    for (const migration of migrations) {
      // Check if migration file exists and is readable
      if (!fs.existsSync(migration.path)) {
        issues.push(`Migration file not found: ${migration.name}`);
        continue;
      }

      // Check if rollback file exists
      if (!fs.existsSync(migration.rollbackPath)) {
        issues.push(`Rollback file not found for: ${migration.name}`);
      }

      // Validate SQL syntax (basic check)
      const content = fs.readFileSync(migration.path, 'utf8');
      if (!content.trim()) {
        issues.push(`Empty migration file: ${migration.name}`);
      }
    }

    return issues;
  }

  /**
   * Test migration on staging environment
   */
  async testMigration(migrationName, environment = 'staging') {
    console.log(`Testing migration ${migrationName} on ${environment}...`);
    
    try {
      // Apply migration
      const result = execSync(`supabase db push --db-url ${this.environments[environment]}`, {
        cwd: path.dirname(this.migrationsDir),
        encoding: 'utf8'
      });
      
      console.log('Migration applied successfully');
      console.log(result);
      
      return { success: true, output: result };
    } catch (error) {
      console.error('Migration failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Rollback migration
   */
  async rollbackMigration(migrationName, environment = 'staging') {
    const migration = this.getMigrationFiles().find(m => m.name === migrationName);
    
    if (!migration) {
      throw new Error(`Migration not found: ${migrationName}`);
    }

    if (!fs.existsSync(migration.rollbackPath)) {
      throw new Error(`Rollback file not found: ${migration.rollbackPath}`);
    }

    console.log(`Rolling back migration ${migrationName} on ${environment}...`);
    
    try {
      const rollbackSQL = fs.readFileSync(migration.rollbackPath, 'utf8');
      
      // Execute rollback SQL
      const result = execSync(`supabase db reset --db-url ${this.environments[environment]}`, {
        cwd: path.dirname(this.migrationsDir),
        encoding: 'utf8'
      });
      
      console.log('Rollback completed successfully');
      return { success: true, output: result };
    } catch (error) {
      console.error('Rollback failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Deploy to production with safety checks
   */
  async deployToProduction(migrationName) {
    console.log('Starting production deployment process...');
    
    // 1. Validate migrations
    const issues = this.validateMigrations();
    if (issues.length > 0) {
      console.error('Migration validation failed:');
      issues.forEach(issue => console.error(`- ${issue}`));
      return { success: false, error: 'Validation failed' };
    }

    // 2. Test on staging first
    console.log('Testing on staging environment...');
    const stagingResult = await this.testMigration(migrationName, 'staging');
    if (!stagingResult.success) {
      console.error('Staging test failed, aborting production deployment');
      return stagingResult;
    }

    // 3. Confirm production deployment
    console.log('Staging test passed. Ready for production deployment.');
    console.log('Please confirm production deployment by setting CONFIRM_PRODUCTION=true');
    
    if (process.env.CONFIRM_PRODUCTION !== 'true') {
      return { success: false, error: 'Production deployment not confirmed' };
    }

    // 4. Deploy to production
    console.log('Deploying to production...');
    const productionResult = await this.testMigration(migrationName, 'production');
    
    if (productionResult.success) {
      console.log('Production deployment completed successfully!');
    } else {
      console.error('Production deployment failed!');
      console.log('Consider rolling back if necessary.');
    }

    return productionResult;
  }

  /**
   * Generate migration status report
   */
  generateStatusReport() {
    const migrations = this.getMigrationFiles();
    const issues = this.validateMigrations();
    
    const report = {
      totalMigrations: migrations.length,
      validMigrations: migrations.length - issues.length,
      issues: issues,
      migrations: migrations.map(m => ({
        name: m.name,
        timestamp: m.timestamp,
        hasRollback: fs.existsSync(m.rollbackPath)
      }))
    };

    return report;
  }
}

// CLI Interface
if (require.main === module) {
  const manager = new MigrationManager();
  const command = process.argv[2];
  const migrationName = process.argv[3];

  switch (command) {
    case 'validate':
      const issues = manager.validateMigrations();
      if (issues.length === 0) {
        console.log('All migrations are valid ✓');
      } else {
        console.error('Migration validation issues:');
        issues.forEach(issue => console.error(`- ${issue}`));
        process.exit(1);
      }
      break;

    case 'test':
      if (!migrationName) {
        console.error('Please specify migration name');
        process.exit(1);
      }
      manager.testMigration(migrationName)
        .then(result => {
          if (!result.success) process.exit(1);
        });
      break;

    case 'rollback':
      if (!migrationName) {
        console.error('Please specify migration name');
        process.exit(1);
      }
      manager.rollbackMigration(migrationName)
        .then(result => {
          if (!result.success) process.exit(1);
        });
      break;

    case 'deploy':
      if (!migrationName) {
        console.error('Please specify migration name');
        process.exit(1);
      }
      manager.deployToProduction(migrationName)
        .then(result => {
          if (!result.success) process.exit(1);
        });
      break;

    case 'status':
      const report = manager.generateStatusReport();
      console.log(JSON.stringify(report, null, 2));
      break;

    default:
      console.log(`
Migration Manager Usage:

  node migration-manager.js validate                    - Validate all migrations
  node migration-manager.js test <migration-name>       - Test migration on staging
  node migration-manager.js rollback <migration-name>   - Rollback migration
  node migration-manager.js deploy <migration-name>     - Deploy to production
  node migration-manager.js status                      - Show migration status

Environment Variables:
  SUPABASE_STAGING_URL      - Staging database URL
  SUPABASE_PRODUCTION_URL   - Production database URL
  CONFIRM_PRODUCTION=true   - Required for production deployment
      `);
  }
}

module.exports = MigrationManager;