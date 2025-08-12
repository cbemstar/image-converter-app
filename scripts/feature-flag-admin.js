#!/usr/bin/env node

/**
 * Feature Flag Administration Script
 * Provides command-line utilities for managing feature flags
 */

const { createClient } = require('@supabase/supabase-js');

class FeatureFlagAdmin {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  /**
   * List all feature flags
   */
  async listFlags() {
    try {
      const { data, error } = await this.supabase
        .from('feature_flags')
        .select('*')
        .order('flag_name');

      if (error) throw error;

      console.log('\nFeature Flags:');
      console.log('==============');
      
      if (data.length === 0) {
        console.log('No feature flags found.');
        return;
      }

      data.forEach(flag => {
        console.log(`\n${flag.flag_name}:`);
        console.log(`  Enabled: ${flag.is_enabled}`);
        console.log(`  Rollout: ${flag.rollout_percentage}%`);
        console.log(`  Description: ${flag.description || 'N/A'}`);
        console.log(`  Target Users: ${flag.target_users?.length || 0} users`);
        console.log(`  Created: ${new Date(flag.created_at).toLocaleDateString()}`);
      });

    } catch (error) {
      console.error('Error listing flags:', error.message);
    }
  }

  /**
   * Create a new feature flag
   */
  async createFlag(flagName, options = {}) {
    try {
      const flagData = {
        flag_name: flagName,
        is_enabled: options.enabled || false,
        description: options.description || null,
        rollout_percentage: options.rollout || 0,
        target_users: options.targetUsers || []
      };

      const { data, error } = await this.supabase
        .from('feature_flags')
        .insert(flagData)
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Created feature flag: ${flagName}`);
      console.log(`   Enabled: ${data.is_enabled}`);
      console.log(`   Rollout: ${data.rollout_percentage}%`);

    } catch (error) {
      if (error.code === '23505') {
        console.error(`❌ Feature flag '${flagName}' already exists`);
      } else {
        console.error('Error creating flag:', error.message);
      }
    }
  }

  /**
   * Update an existing feature flag
   */
  async updateFlag(flagName, updates) {
    try {
      const { data, error } = await this.supabase
        .from('feature_flags')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('flag_name', flagName)
        .select()
        .single();

      if (error) throw error;

      if (!data) {
        console.error(`❌ Feature flag '${flagName}' not found`);
        return;
      }

      console.log(`✅ Updated feature flag: ${flagName}`);
      Object.entries(updates).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });

    } catch (error) {
      console.error('Error updating flag:', error.message);
    }
  }

  /**
   * Enable a feature flag
   */
  async enableFlag(flagName, rolloutPercentage = 100) {
    await this.updateFlag(flagName, {
      is_enabled: true,
      rollout_percentage: rolloutPercentage
    });
  }

  /**
   * Disable a feature flag
   */
  async disableFlag(flagName) {
    await this.updateFlag(flagName, {
      is_enabled: false,
      rollout_percentage: 0
    });
  }

  /**
   * Delete a feature flag
   */
  async deleteFlag(flagName) {
    try {
      const { error } = await this.supabase
        .from('feature_flags')
        .delete()
        .eq('flag_name', flagName);

      if (error) throw error;

      console.log(`✅ Deleted feature flag: ${flagName}`);

    } catch (error) {
      console.error('Error deleting flag:', error.message);
    }
  }

  /**
   * Add target users to a feature flag
   */
  async addTargetUsers(flagName, userIds) {
    try {
      // Get current flag
      const { data: flag, error: fetchError } = await this.supabase
        .from('feature_flags')
        .select('target_users')
        .eq('flag_name', flagName)
        .single();

      if (fetchError) throw fetchError;

      const currentUsers = flag.target_users || [];
      const newUsers = [...new Set([...currentUsers, ...userIds])];

      await this.updateFlag(flagName, {
        target_users: newUsers
      });

      console.log(`✅ Added ${userIds.length} target users to ${flagName}`);

    } catch (error) {
      console.error('Error adding target users:', error.message);
    }
  }

  /**
   * Remove target users from a feature flag
   */
  async removeTargetUsers(flagName, userIds) {
    try {
      // Get current flag
      const { data: flag, error: fetchError } = await this.supabase
        .from('feature_flags')
        .select('target_users')
        .eq('flag_name', flagName)
        .single();

      if (fetchError) throw fetchError;

      const currentUsers = flag.target_users || [];
      const newUsers = currentUsers.filter(id => !userIds.includes(id));

      await this.updateFlag(flagName, {
        target_users: newUsers
      });

      console.log(`✅ Removed ${userIds.length} target users from ${flagName}`);

    } catch (error) {
      console.error('Error removing target users:', error.message);
    }
  }

  /**
   * Get feature flag status for a specific user
   */
  async checkUserFlag(flagName, userId) {
    try {
      const { data, error } = await this.supabase
        .rpc('check_feature_flag', {
          flag_name: flagName,
          user_id: userId
        });

      if (error) throw error;

      console.log(`Feature flag '${flagName}' for user ${userId}: ${data ? 'ENABLED' : 'DISABLED'}`);

    } catch (error) {
      console.error('Error checking user flag:', error.message);
    }
  }

  /**
   * Initialize default feature flags
   */
  async initializeDefaults() {
    const defaultFlags = [
      {
        name: 'auth_enabled',
        enabled: true,
        description: 'Enable authentication system',
        rollout: 100
      },
      {
        name: 'billing_enabled',
        enabled: false,
        description: 'Enable billing and subscription features',
        rollout: 0
      },
      {
        name: 'conversion_metering',
        enabled: false,
        description: 'Enable conversion usage tracking',
        rollout: 0
      },
      {
        name: 'stripe_integration',
        enabled: false,
        description: 'Enable Stripe payment processing',
        rollout: 0
      }
    ];

    console.log('Initializing default feature flags...');

    for (const flag of defaultFlags) {
      await this.createFlag(flag.name, {
        enabled: flag.enabled,
        description: flag.description,
        rollout: flag.rollout
      });
    }

    console.log('✅ Default feature flags initialized');
  }
}

// CLI Interface
if (require.main === module) {
  const admin = new FeatureFlagAdmin();
  const command = process.argv[2];
  const flagName = process.argv[3];

  switch (command) {
    case 'list':
      admin.listFlags();
      break;

    case 'create':
      if (!flagName) {
        console.error('Please specify flag name');
        process.exit(1);
      }
      const description = process.argv[4];
      admin.createFlag(flagName, { description });
      break;

    case 'enable':
      if (!flagName) {
        console.error('Please specify flag name');
        process.exit(1);
      }
      const rollout = parseInt(process.argv[4]) || 100;
      admin.enableFlag(flagName, rollout);
      break;

    case 'disable':
      if (!flagName) {
        console.error('Please specify flag name');
        process.exit(1);
      }
      admin.disableFlag(flagName);
      break;

    case 'delete':
      if (!flagName) {
        console.error('Please specify flag name');
        process.exit(1);
      }
      admin.deleteFlag(flagName);
      break;

    case 'check':
      if (!flagName || !process.argv[4]) {
        console.error('Please specify flag name and user ID');
        process.exit(1);
      }
      admin.checkUserFlag(flagName, process.argv[4]);
      break;

    case 'init':
      admin.initializeDefaults();
      break;

    case 'target-add':
      if (!flagName || !process.argv[4]) {
        console.error('Please specify flag name and user IDs (comma-separated)');
        process.exit(1);
      }
      const addUsers = process.argv[4].split(',');
      admin.addTargetUsers(flagName, addUsers);
      break;

    case 'target-remove':
      if (!flagName || !process.argv[4]) {
        console.error('Please specify flag name and user IDs (comma-separated)');
        process.exit(1);
      }
      const removeUsers = process.argv[4].split(',');
      admin.removeTargetUsers(flagName, removeUsers);
      break;

    default:
      console.log(`
Feature Flag Administration

Usage:
  node feature-flag-admin.js <command> [options]

Commands:
  list                                    - List all feature flags
  create <name> [description]             - Create a new feature flag
  enable <name> [rollout%]                - Enable a feature flag (default 100%)
  disable <name>                          - Disable a feature flag
  delete <name>                           - Delete a feature flag
  check <name> <user-id>                  - Check flag status for specific user
  target-add <name> <user-ids>            - Add target users (comma-separated)
  target-remove <name> <user-ids>         - Remove target users (comma-separated)
  init                                    - Initialize default feature flags

Environment Variables:
  SUPABASE_URL                           - Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY              - Service role key

Examples:
  node feature-flag-admin.js list
  node feature-flag-admin.js create new_feature "Enable new feature"
  node feature-flag-admin.js enable billing_enabled 50
  node feature-flag-admin.js check auth_enabled user-123
      `);
  }
}

module.exports = FeatureFlagAdmin;