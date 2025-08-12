/**
 * Account Linking System
 * Handles account linking detection and merge logic for users with same email
 */

import { createClient } from './supabase-client.js';
import { useAuth } from './hooks/useAuth.js';

class AccountLinking {
  constructor() {
    this.supabase = createClient();
    this.useAuth = useAuth();
    this.linkingInProgress = false;
    this.pendingLinks = new Map();
    
    this.initialize();
  }

  /**
   * Initialize account linking system
   */
  initialize() {
    // Subscribe to auth state changes to detect linking opportunities
    this.useAuth.subscribe((state) => {
      this.handleAuthStateChange(state);
    });

    // Check for existing linking opportunities on load
    this.checkExistingLinkingOpportunities();
  }

  /**
   * Handle authentication state changes
   */
  handleAuthStateChange(state) {
    if (state.isAuthenticated && state.user && !this.linkingInProgress) {
      this.detectAccountLinkingOpportunity(state.user);
    }
  }

  /**
   * Check for existing linking opportunities
   */
  async checkExistingLinkingOpportunities() {
    const user = this.useAuth.getUser();
    if (user) {
      await this.detectAccountLinkingOpportunity(user);
    }
  }

  /**
   * Detect if account linking is possible
   */
  async detectAccountLinkingOpportunity(user) {
    try {
      if (!user.email) return;

      console.log('AccountLinking: Checking for linking opportunities for:', user.email);

      // Check if user has multiple identities
      const identities = user.identities || [];
      const emailIdentity = identities.find(id => id.provider === 'email');
      const oauthIdentities = identities.filter(id => id.provider !== 'email');

      // If user has both email and OAuth identities, they're already linked
      if (emailIdentity && oauthIdentities.length > 0) {
        console.log('AccountLinking: User already has linked accounts');
        return;
      }

      // Check for potential linking opportunities
      await this.checkForLinkableAccounts(user);

    } catch (error) {
      console.error('Error detecting account linking opportunity:', error);
    }
  }

  /**
   * Check for accounts that can be linked
   */
  async checkForLinkableAccounts(user) {
    try {
      // This would typically query the database for other accounts with the same email
      // For now, we'll simulate this check
      
      const email = user.email;
      const currentProvider = this.getCurrentProvider(user);
      
      console.log(`AccountLinking: Checking for linkable accounts for ${email} (current provider: ${currentProvider})`);

      // In a real implementation, you would:
      // 1. Query the profiles table for other users with the same email
      // 2. Check if they have different authentication providers
      // 3. Offer to link the accounts

      // For now, we'll check if there are signs of multiple auth methods
      const hasMultipleAuthMethods = this.detectMultipleAuthMethods(user);
      
      if (hasMultipleAuthMethods) {
        await this.offerAccountLinking(user, email);
      }

    } catch (error) {
      console.error('Error checking for linkable accounts:', error);
    }
  }

  /**
   * Get current authentication provider
   */
  getCurrentProvider(user) {
    if (!user.identities || user.identities.length === 0) {
      return 'unknown';
    }

    // Return the most recent identity provider
    const sortedIdentities = user.identities.sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );

    return sortedIdentities[0].provider;
  }

  /**
   * Detect if user has multiple authentication methods
   */
  detectMultipleAuthMethods(user) {
    if (!user.identities) return false;

    const providers = new Set(user.identities.map(id => id.provider));
    return providers.size > 1;
  }

  /**
   * Offer account linking to user
   */
  async offerAccountLinking(user, email) {
    try {
      console.log('AccountLinking: Offering account linking for:', email);

      // Check if user has already been offered linking for this session
      const linkingKey = `${user.id}-${email}`;
      if (this.pendingLinks.has(linkingKey)) {
        return;
      }

      // Mark as pending to avoid duplicate offers
      this.pendingLinks.set(linkingKey, {
        userId: user.id,
        email,
        timestamp: Date.now()
      });

      // Show linking offer to user
      this.showLinkingOffer(user, email);

    } catch (error) {
      console.error('Error offering account linking:', error);
    }
  }

  /**
   * Show account linking offer to user
   */
  showLinkingOffer(user, email) {
    const currentProvider = this.getCurrentProvider(user);
    const otherProviders = this.getOtherProviders(user);

    const message = `
      We detected that you may have signed in with ${email} using different methods.
      Would you like to link your accounts for easier access?
      
      Current: ${this.getProviderDisplayName(currentProvider)}
      ${otherProviders.length > 0 ? `Other methods: ${otherProviders.map(p => this.getProviderDisplayName(p)).join(', ')}` : ''}
    `;

    if (confirm(message)) {
      this.initiateLinking(user, email);
    } else {
      // User declined, don't ask again this session
      console.log('AccountLinking: User declined linking offer');
    }
  }

  /**
   * Get other authentication providers for the user
   */
  getOtherProviders(user) {
    if (!user.identities) return [];

    const currentProvider = this.getCurrentProvider(user);
    return user.identities
      .map(id => id.provider)
      .filter(provider => provider !== currentProvider);
  }

  /**
   * Get display name for provider
   */
  getProviderDisplayName(provider) {
    const displayNames = {
      'email': 'Email/Password',
      'google': 'Google',
      'github': 'GitHub',
      'facebook': 'Facebook',
      'twitter': 'Twitter'
    };

    return displayNames[provider] || provider;
  }

  /**
   * Initiate account linking process
   */
  async initiateLinking(user, email) {
    try {
      this.linkingInProgress = true;
      console.log('AccountLinking: Initiating linking process for:', email);

      // Show linking progress
      this.showMessage('Linking accounts...', 'info');

      // In a real implementation, this would:
      // 1. Verify the user owns both accounts
      // 2. Merge user data and preferences
      // 3. Update the database to link the accounts
      // 4. Preserve usage data and plan status

      // For now, we'll simulate the linking process
      await this.simulateLinkingProcess(user, email);

      this.showMessage('Accounts linked successfully!', 'success');
      
    } catch (error) {
      console.error('Error initiating account linking:', error);
      this.showMessage('Failed to link accounts. Please try again.', 'error');
    } finally {
      this.linkingInProgress = false;
    }
  }

  /**
   * Simulate account linking process
   */
  async simulateLinkingProcess(user, email) {
    // Simulate API calls and data merging
    await new Promise(resolve => setTimeout(resolve, 2000));

    // In a real implementation, you would:
    // 1. Call Supabase Auth API to link identities
    // 2. Merge user profiles in the database
    // 3. Preserve usage data and subscription status
    // 4. Update any related records

    console.log('AccountLinking: Simulated linking process completed');
  }

  /**
   * Link OAuth identity to existing account
   */
  async linkOAuthIdentity(provider, options = {}) {
    try {
      if (this.linkingInProgress) {
        throw new Error('Account linking already in progress');
      }

      this.linkingInProgress = true;
      console.log(`AccountLinking: Linking ${provider} identity`);

      // Store current user info for post-link verification
      const currentUser = this.useAuth.getUser();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      // Initiate OAuth linking
      const { data, error } = await this.supabase.auth.linkIdentity({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth.html?linking=true`,
          ...options
        }
      });

      if (error) throw error;

      return {
        success: true,
        data,
        message: `${this.getProviderDisplayName(provider)} account will be linked after authentication`
      };

    } catch (error) {
      console.error(`Error linking ${provider} identity:`, error);
      throw error;
    } finally {
      this.linkingInProgress = false;
    }
  }

  /**
   * Unlink identity from account
   */
  async unlinkIdentity(identityId) {
    try {
      console.log('AccountLinking: Unlinking identity:', identityId);

      const { data, error } = await this.supabase.auth.unlinkIdentity({
        identity_id: identityId
      });

      if (error) throw error;

      this.showMessage('Account unlinked successfully', 'success');

      return {
        success: true,
        data,
        message: 'Identity unlinked successfully'
      };

    } catch (error) {
      console.error('Error unlinking identity:', error);
      this.showMessage('Failed to unlink account. Please try again.', 'error');
      throw error;
    }
  }

  /**
   * Get linked identities for current user
   */
  getLinkedIdentities() {
    const user = this.useAuth.getUser();
    if (!user || !user.identities) {
      return [];
    }

    return user.identities.map(identity => ({
      id: identity.id,
      provider: identity.provider,
      email: identity.email,
      displayName: this.getProviderDisplayName(identity.provider),
      createdAt: identity.created_at,
      lastSignIn: identity.last_sign_in_at
    }));
  }

  /**
   * Check if account has multiple linked identities
   */
  hasMultipleIdentities() {
    const identities = this.getLinkedIdentities();
    return identities.length > 1;
  }

  /**
   * Get primary identity (usually email or the first one)
   */
  getPrimaryIdentity() {
    const identities = this.getLinkedIdentities();
    
    // Prefer email identity as primary
    const emailIdentity = identities.find(id => id.provider === 'email');
    if (emailIdentity) {
      return emailIdentity;
    }

    // Otherwise, return the oldest identity
    return identities.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
  }

  /**
   * Merge user data from multiple accounts
   */
  async mergeUserData(sourceUserId, targetUserId) {
    try {
      console.log('AccountLinking: Merging user data from', sourceUserId, 'to', targetUserId);

      // In a real implementation, this would:
      // 1. Merge user profiles
      // 2. Transfer usage records
      // 3. Preserve subscription status
      // 4. Update file ownership
      // 5. Merge preferences

      // This would typically be done server-side for security
      const mergeResult = await this.callMergeAPI(sourceUserId, targetUserId);

      return mergeResult;

    } catch (error) {
      console.error('Error merging user data:', error);
      throw error;
    }
  }

  /**
   * Call server-side merge API (placeholder)
   */
  async callMergeAPI(sourceUserId, targetUserId) {
    // This would call a secure server-side function
    // For now, we'll simulate the API call
    
    console.log('AccountLinking: Calling merge API (simulated)');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      mergedRecords: {
        profiles: 1,
        usageRecords: 5,
        files: 10,
        preferences: 1
      }
    };
  }

  /**
   * Handle post-linking cleanup
   */
  async handlePostLinkingCleanup(linkedUser) {
    try {
      console.log('AccountLinking: Handling post-linking cleanup');

      // Clear any pending linking offers
      this.pendingLinks.clear();

      // Update user profile with linked status
      await this.updateLinkedStatus(linkedUser);

      // Refresh user data
      const { data: { session }, error } = await this.supabase.auth.refreshSession();
      if (error) {
        console.error('Error refreshing session after linking:', error);
      }

    } catch (error) {
      console.error('Error in post-linking cleanup:', error);
    }
  }

  /**
   * Update user profile with linked status
   */
  async updateLinkedStatus(user) {
    try {
      // This would update the user profile in the database
      // to indicate that accounts have been linked
      
      console.log('AccountLinking: Updating linked status for user:', user.id);
      
      // Placeholder for database update
      // await this.supabase
      //   .from('profiles')
      //   .update({ 
      //     has_linked_accounts: true,
      //     linked_at: new Date().toISOString()
      //   })
      //   .eq('id', user.id);

    } catch (error) {
      console.error('Error updating linked status:', error);
    }
  }

  /**
   * Show message to user
   */
  showMessage(message, type = 'info') {
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Get account linking status
   */
  getLinkingStatus() {
    const user = this.useAuth.getUser();
    const identities = this.getLinkedIdentities();
    
    return {
      isAuthenticated: !!user,
      hasMultipleIdentities: this.hasMultipleIdentities(),
      identities,
      primaryIdentity: this.getPrimaryIdentity(),
      linkingInProgress: this.linkingInProgress,
      pendingOffers: this.pendingLinks.size
    };
  }

  /**
   * Clear pending linking offers
   */
  clearPendingOffers() {
    this.pendingLinks.clear();
  }

  /**
   * Check if linking is supported for provider
   */
  isLinkingSupported(provider) {
    const supportedProviders = ['google', 'github', 'facebook', 'twitter'];
    return supportedProviders.includes(provider);
  }
}

// Create global instance
let accountLinking = null;

export const getAccountLinking = () => {
  if (!accountLinking) {
    accountLinking = new AccountLinking();
  }
  return accountLinking;
};

// Initialize on load and expose globally
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const linking = getAccountLinking();
    window.accountLinking = linking;
  });
}

export default AccountLinking;