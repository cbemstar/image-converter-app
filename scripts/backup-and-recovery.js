#!/usr/bin/env node

/**
 * Backup and Disaster Recovery Script
 * 
 * This script handles backup creation, validation, and disaster recovery procedures
 * for the production environment, including database backups, configuration backups,
 * and recovery testing.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class BackupAndRecovery {
  constructor(options = {}) {
    this.projectRoot = path.join(__dirname, '..');
    this.backupDir = options.backupDir || path.join(this.projectRoot, 'backups');
    this.environment = options.environment || 'production';
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    this.ensureBackupDirectory();
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      this.log(`Created backup directory: ${this.backupDir}`);
    }
  }

  execCommand(command, options = {}) {
    try {
      const result = execSync(command, {
        cwd: this.projectRoot,
        encoding: 'utf8',
        ...options
      });
      return result;
    } catch (error) {
      throw new Error(`Command failed: ${command}\n${error.message}`);
    }
  }

  generateChecksum(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }

  async backupDatabase() {
    this.log('Creating database backup...');
    
    try {
      const backupFileName = `database-backup-${this.timestamp}.sql`;
      const backupPath = path.join(this.backupDir, backupFileName);
      
      // Export database schema and data
      const dumpCommand = `supabase db dump --data-only > "${backupPath}"`;
      this.execCommand(dumpCommand);
      
      // Create schema-only backup
      const schemaFileName = `database-schema-${this.timestamp}.sql`;
      const schemaPath = path.join(this.backupDir, schemaFileName);
      const schemaCommand = `supabase db dump --schema-only > "${schemaPath}"`;
      this.execCommand(schemaCommand);
      
      // Generate checksums
      const dataChecksum = this.generateChecksum(backupPath);
      const schemaChecksum = this.generateChecksum(schemaPath);
      
      const backupInfo = {
        type: 'database',
        timestamp: this.timestamp,
        files: {
          data: {
            path: backupPath,
            size: fs.statSync(backupPath).size,
            checksum: dataChecksum
          },
          schema: {
            path: schemaPath,
            size: fs.statSync(schemaPath).size,
            checksum: schemaChecksum
          }
        }
      };
      
      this.log(`Database backup created: ${backupFileName}`);
      this.log(`Schema backup created: ${schemaFileName}`);
      
      return backupInfo;
      
    } catch (error) {
      throw new Error(`Database backup failed: ${error.message}`);
    }
  }

  async backupEdgeFunctions() {
    this.log('Creating Edge Functions backup...');
    
    try {
      const functionsDir = path.join(this.projectRoot, 'supabase', 'functions');
      
      if (!fs.existsSync(functionsDir)) {
        this.log('No Edge Functions directory found, skipping...', 'warn');
        return null;
      }
      
      const backupFileName = `edge-functions-${this.timestamp}.tar.gz`;
      const backupPath = path.join(this.backupDir, backupFileName);
      
      // Create compressed archive of functions
      const tarCommand = `tar -czf "${backupPath}" -C "${path.dirname(functionsDir)}" functions`;
      this.execCommand(tarCommand);
      
      const checksum = this.generateChecksum(backupPath);
      
      const backupInfo = {
        type: 'edge-functions',
        timestamp: this.timestamp,
        file: {
          path: backupPath,
          size: fs.statSync(backupPath).size,
          checksum
        }
      };
      
      this.log(`Edge Functions backup created: ${backupFileName}`);
      return backupInfo;
      
    } catch (error) {
      throw new Error(`Edge Functions backup failed: ${error.message}`);
    }
  }

  async backupConfiguration() {
    this.log('Creating configuration backup...');
    
    try {
      const configFiles = [
        'supabase/config.toml',
        'supabase/config.production.toml',
        'vercel.json',
        'package.json',
        '.env.production.example'
      ];
      
      const configBackup = {
        timestamp: this.timestamp,
        environment: this.environment,
        files: {}
      };
      
      for (const configFile of configFiles) {
        const filePath = path.join(this.projectRoot, configFile);
        
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          const checksum = crypto.createHash('sha256').update(content).digest('hex');
          
          configBackup.files[configFile] = {
            content,
            checksum,
            size: content.length
          };
        }
      }
      
      const backupFileName = `configuration-${this.timestamp}.json`;
      const backupPath = path.join(this.backupDir, backupFileName);
      
      fs.writeFileSync(backupPath, JSON.stringify(configBackup, null, 2));
      
      const backupInfo = {
        type: 'configuration',
        timestamp: this.timestamp,
        file: {
          path: backupPath,
          size: fs.statSync(backupPath).size,
          checksum: this.generateChecksum(backupPath)
        },
        filesIncluded: Object.keys(configBackup.files).length
      };
      
      this.log(`Configuration backup created: ${backupFileName}`);
      this.log(`Files included: ${backupInfo.filesIncluded}`);
      
      return backupInfo;
      
    } catch (error) {
      throw new Error(`Configuration backup failed: ${error.message}`);
    }
  }

  async backupStorageBuckets() {
    this.log('Creating storage buckets backup...');
    
    try {
      // Note: This is a placeholder for storage backup logic
      // In a real implementation, you would:
      // 1. List all storage buckets
      // 2. Download all files from each bucket
      // 3. Create compressed archives
      // 4. Generate checksums
      
      this.log('Storage backup configuration:', 'info');
      this.log('• Implement bucket listing and file download', 'info');
      this.log('• Create compressed archives for each bucket', 'info');
      this.log('• Generate checksums for integrity verification', 'info');
      this.log('• Consider using cloud storage sync tools', 'info');
      
      const backupInfo = {
        type: 'storage',
        timestamp: this.timestamp,
        status: 'placeholder',
        message: 'Storage backup implementation needed'
      };
      
      return backupInfo;
      
    } catch (error) {
      throw new Error(`Storage backup failed: ${error.message}`);
    }
  }

  async createFullBackup() {
    this.log('Starting full backup process...');
    
    const backupManifest = {
      timestamp: this.timestamp,
      environment: this.environment,
      backups: [],
      summary: {
        totalSize: 0,
        filesCreated: 0,
        duration: 0
      }
    };
    
    const startTime = Date.now();
    
    try {
      // Database backup
      const dbBackup = await this.backupDatabase();
      if (dbBackup) {
        backupManifest.backups.push(dbBackup);
        backupManifest.summary.totalSize += dbBackup.files.data.size + dbBackup.files.schema.size;
        backupManifest.summary.filesCreated += 2;
      }
      
      // Edge Functions backup
      const functionsBackup = await this.backupEdgeFunctions();
      if (functionsBackup) {
        backupManifest.backups.push(functionsBackup);
        backupManifest.summary.totalSize += functionsBackup.file.size;
        backupManifest.summary.filesCreated += 1;
      }
      
      // Configuration backup
      const configBackup = await this.backupConfiguration();
      if (configBackup) {
        backupManifest.backups.push(configBackup);
        backupManifest.summary.totalSize += configBackup.file.size;
        backupManifest.summary.filesCreated += 1;
      }
      
      // Storage backup
      const storageBackup = await this.backupStorageBuckets();
      if (storageBackup) {
        backupManifest.backups.push(storageBackup);
      }
      
      backupManifest.summary.duration = Date.now() - startTime;
      
      // Save backup manifest
      const manifestPath = path.join(this.backupDir, `backup-manifest-${this.timestamp}.json`);
      fs.writeFileSync(manifestPath, JSON.stringify(backupManifest, null, 2));
      
      this.log('Full backup completed successfully!');
      this.log(`Total size: ${Math.round(backupManifest.summary.totalSize / 1024 / 1024)} MB`);
      this.log(`Files created: ${backupManifest.summary.filesCreated}`);
      this.log(`Duration: ${Math.round(backupManifest.summary.duration / 1000)}s`);
      this.log(`Manifest saved: ${manifestPath}`);
      
      return backupManifest;
      
    } catch (error) {
      throw new Error(`Full backup failed: ${error.message}`);
    }
  }

  async validateBackup(manifestPath) {
    this.log('Validating backup integrity...');
    
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const validationResults = [];
      
      for (const backup of manifest.backups) {
        if (backup.type === 'database') {
          // Validate database backup files
          for (const [type, fileInfo] of Object.entries(backup.files)) {
            if (fs.existsSync(fileInfo.path)) {
              const currentChecksum = this.generateChecksum(fileInfo.path);
              const isValid = currentChecksum === fileInfo.checksum;
              
              validationResults.push({
                type: `database-${type}`,
                file: fileInfo.path,
                valid: isValid,
                expectedChecksum: fileInfo.checksum,
                actualChecksum: currentChecksum
              });
              
              this.log(`Database ${type} backup: ${isValid ? 'Valid' : 'Invalid'}`, isValid ? 'info' : 'error');
            } else {
              validationResults.push({
                type: `database-${type}`,
                file: fileInfo.path,
                valid: false,
                error: 'File not found'
              });
              
              this.log(`Database ${type} backup: File not found`, 'error');
            }
          }
        } else if (backup.file) {
          // Validate single file backups
          if (fs.existsSync(backup.file.path)) {
            const currentChecksum = this.generateChecksum(backup.file.path);
            const isValid = currentChecksum === backup.file.checksum;
            
            validationResults.push({
              type: backup.type,
              file: backup.file.path,
              valid: isValid,
              expectedChecksum: backup.file.checksum,
              actualChecksum: currentChecksum
            });
            
            this.log(`${backup.type} backup: ${isValid ? 'Valid' : 'Invalid'}`, isValid ? 'info' : 'error');
          } else {
            validationResults.push({
              type: backup.type,
              file: backup.file.path,
              valid: false,
              error: 'File not found'
            });
            
            this.log(`${backup.type} backup: File not found`, 'error');
          }
        }
      }
      
      const allValid = validationResults.every(result => result.valid);
      
      this.log(`Backup validation ${allValid ? 'passed' : 'failed'}`, allValid ? 'info' : 'error');
      
      return {
        valid: allValid,
        results: validationResults
      };
      
    } catch (error) {
      throw new Error(`Backup validation failed: ${error.message}`);
    }
  }

  async createRecoveryPlan() {
    this.log('Creating disaster recovery plan...');
    
    const recoveryPlan = `# Disaster Recovery Plan

## Overview
This document outlines the disaster recovery procedures for the Image Converter application.

## Recovery Time Objectives (RTO)
- **Database Recovery**: 30 minutes
- **Application Recovery**: 15 minutes
- **Full System Recovery**: 1 hour

## Recovery Point Objectives (RPO)
- **Database**: 1 hour (automated backups)
- **Configuration**: 24 hours (daily backups)
- **User Files**: 4 hours (continuous sync)

## Recovery Procedures

### 1. Database Recovery

#### Prerequisites
- Access to Supabase project
- Database backup files
- Service role key

#### Steps
1. Identify the latest valid database backup
2. Restore database from backup:
   \`\`\`bash
   supabase db reset --db-url "postgresql://..." --linked
   psql -h hostname -U username -d database < backup-file.sql
   \`\`\`
3. Verify data integrity
4. Update application configuration if needed

### 2. Edge Functions Recovery

#### Prerequisites
- Edge Functions backup archive
- Supabase CLI access

#### Steps
1. Extract Edge Functions backup:
   \`\`\`bash
   tar -xzf edge-functions-backup.tar.gz
   \`\`\`
2. Deploy functions:
   \`\`\`bash
   supabase functions deploy
   \`\`\`
3. Test function endpoints

### 3. Application Recovery

#### Prerequisites
- Application source code
- Environment variables
- Hosting platform access

#### Steps
1. Deploy application from source:
   \`\`\`bash
   npm run deploy:production
   \`\`\`
2. Configure environment variables
3. Verify application functionality

### 4. Configuration Recovery

#### Prerequisites
- Configuration backup file
- Access to hosting platform

#### Steps
1. Restore configuration files from backup
2. Update environment variables
3. Restart services if needed

## Testing Recovery Procedures

### Monthly Recovery Tests
- [ ] Test database restore from backup
- [ ] Verify Edge Functions deployment
- [ ] Test application deployment
- [ ] Validate monitoring and alerting

### Quarterly Full Recovery Tests
- [ ] Complete system recovery simulation
- [ ] Performance validation
- [ ] User acceptance testing
- [ ] Documentation updates

## Emergency Contacts
- **Primary**: [Your contact information]
- **Secondary**: [Backup contact information]
- **Supabase Support**: support@supabase.io
- **Hosting Provider**: [Your hosting provider support]

## Recovery Checklist

### Immediate Response (0-15 minutes)
- [ ] Assess the scope of the incident
- [ ] Notify stakeholders
- [ ] Activate recovery team
- [ ] Begin recovery procedures

### Short-term Recovery (15-60 minutes)
- [ ] Restore critical services
- [ ] Verify data integrity
- [ ] Test core functionality
- [ ] Monitor system health

### Post-Recovery (1+ hours)
- [ ] Conduct post-incident review
- [ ] Update recovery procedures
- [ ] Communicate with users
- [ ] Document lessons learned

## Backup Schedule
- **Database**: Every 6 hours (automated)
- **Configuration**: Daily at 2 AM UTC
- **Full System**: Weekly on Sundays
- **Testing**: Monthly recovery drills

Generated: ${new Date().toISOString()}
Environment: ${this.environment}
`;

    const planPath = path.join(this.backupDir, 'DISASTER_RECOVERY_PLAN.md');
    fs.writeFileSync(planPath, recoveryPlan);
    
    this.log(`Recovery plan created: ${planPath}`);
    return planPath;
  }

  async run(action = 'backup') {
    try {
      switch (action) {
        case 'backup':
          return await this.createFullBackup();
          
        case 'validate':
          const manifestFiles = fs.readdirSync(this.backupDir)
            .filter(file => file.startsWith('backup-manifest-'))
            .sort()
            .reverse();
          
          if (manifestFiles.length === 0) {
            throw new Error('No backup manifests found');
          }
          
          const latestManifest = path.join(this.backupDir, manifestFiles[0]);
          return await this.validateBackup(latestManifest);
          
        case 'recovery-plan':
          return await this.createRecoveryPlan();
          
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      
    } catch (error) {
      this.log(`Operation failed: ${error.message}`, 'error');
      throw error;
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const action = args[0] || 'backup';
  
  const options = {};
  args.slice(1).forEach(arg => {
    if (arg.startsWith('--backup-dir=')) {
      options.backupDir = arg.split('=')[1];
    } else if (arg.startsWith('--environment=')) {
      options.environment = arg.split('=')[1];
    }
  });
  
  const backupSystem = new BackupAndRecovery(options);
  
  backupSystem.run(action).then(result => {
    console.log('✅ Operation completed successfully');
    if (result && typeof result === 'object') {
      console.log('📊 Result summary:', JSON.stringify(result.summary || result, null, 2));
    }
  }).catch(error => {
    console.error('💥 Operation failed:', error.message);
    process.exit(1);
  });
}

module.exports = BackupAndRecovery;