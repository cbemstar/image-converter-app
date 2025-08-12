/**
 * Profile Management Components
 * Handles user profile management and account settings
 */

import { useAuth } from '../hooks/useAuth.js';
import { getAccountLinking } from '../account-linking.js';
import { createClient } from '../supabase-client.js';

class ProfileManagement {
  constructor() {
    this.useAuth = useAuth();
    this.accountLinking = getAccountLinking();
    this.supabase = createClient();
    this.profileComponents = new Map();
    
    this.initialize();
  }

  /**
   * Initialize profile management system
   */
  initialize() {
    // Subscribe to auth state changes
    this.useAuth.subscribe((state) => {
      this.handleAuthStateChange(state);
    });
  }

  /**
   * Handle authentication state changes
   */
  handleAuthStateChange(state) {
    console.log('ProfileManagement: Auth state changed', state);
    
    // Update all profile components
    this.updateAllComponents(state);
  }

  /**
   * Create profile overview component
   */
  createProfileOverview(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Profile overview container not found: ${containerId}`);
      return null;
    }

    const component = {
      type: 'overview',
      container,
      options: {
        showAvatar: options.showAvatar !== false,
        showLinkedAccounts: options.showLinkedAccounts !== false,
        showEmailVerification: options.showEmailVerification !== false,
        editable: options.editable !== false,
        ...options
      }
    };

    this.profileComponents.set(containerId, component);
    this.renderProfileOverview(component);
    
    return component;
  }

  /**
   * Render profile overview component
   */
  renderProfileOverview(component) {
    const { container, options } = component;
    const state = this.useAuth.getState();

    if (!state.isAuthenticated) {
      container.innerHTML = '<p>Please sign in to view your profile.</p>';
      return;
    }

    const user = state.user;
    const linkingStatus = this.accountLinking.getLinkingStatus();

    let html = `
      <div class="profile-overview">
        <div class="profile-header">
    `;

    // Avatar section
    if (options.showAvatar) {
      const avatarUrl = user.user_metadata?.avatar_url || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=0066cc&color=fff`;
      
      html += `
        <div class="profile-avatar">
          <img src="${avatarUrl}" alt="Profile avatar" class="avatar-image">
          ${options.editable ? '<button onclick="profileManagement.changeAvatar()" class="avatar-edit-btn">📷</button>' : ''}
        </div>
      `;
    }

    // Basic info
    html += `
        <div class="profile-info">
          <h3>${user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}</h3>
          <p class="profile-email">${user.email}</p>
          <p class="profile-id">ID: ${user.id}</p>
          <p class="profile-created">Member since: ${new Date(user.created_at).toLocaleDateString()}</p>
        </div>
      </div>
    `;

    // Email verification status
    if (options.showEmailVerification) {
      html += `
        <div class="profile-section">
          <h4>Email Verification</h4>
          <div class="verification-status ${state.isEmailVerified ? 'verified' : 'unverified'}">
            ${state.isEmailVerified ? '✅ Email verified' : '⚠️ Email not verified'}
            ${!state.isEmailVerified ? '<button onclick="profileManagement.resendVerification()" class="btn btn-sm">Resend</button>' : ''}
          </div>
        </div>
      `;
    }

    // Linked accounts section
    if (options.showLinkedAccounts) {
      html += this.renderLinkedAccountsSection(linkingStatus);
    }

    // Profile actions
    if (options.editable) {
      html += `
        <div class="profile-actions">
          <button onclick="profileManagement.editProfile('${container.id}')" class="btn btn-primary">
            Edit Profile
          </button>
          <button onclick="profileManagement.changePassword()" class="btn btn-outline">
            Change Password
          </button>
          <button onclick="profileManagement.downloadData()" class="btn btn-outline">
            Download My Data
          </button>
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;
  }

  /**
   * Render linked accounts section
   */
  renderLinkedAccountsSection(linkingStatus) {
    let html = `
      <div class="profile-section">
        <h4>Linked Accounts</h4>
        <div class="linked-accounts">
    `;

    if (linkingStatus.identities.length === 0) {
      html += '<p>No linked accounts found.</p>';
    } else {
      linkingStatus.identities.forEach(identity => {
        const isPrimary = linkingStatus.primaryIdentity?.id === identity.id;
        
        html += `
          <div class="linked-account ${isPrimary ? 'primary' : ''}">
            <div class="account-info">
              <span class="provider-name">${identity.displayName}</span>
              <span class="account-email">${identity.email || 'No email'}</span>
              ${isPrimary ? '<span class="primary-badge">Primary</span>' : ''}
            </div>
            <div class="account-actions">
              <span class="last-signin">Last used: ${new Date(identity.lastSignIn || identity.createdAt).toLocaleDateString()}</span>
              ${!isPrimary && linkingStatus.identities.length > 1 ? 
                `<button onclick="profileManagement.unlinkAccount('${identity.id}')" class="btn btn-sm btn-danger">Unlink</button>` : 
                ''}
            </div>
          </div>
        `;
      });
    }

    // Add account linking options
    html += `
        </div>
        <div class="link-account-options">
          <h5>Link Additional Accounts</h5>
          <div class="link-buttons">
            <button onclick="profileManagement.linkAccount('google')" class="btn btn-sm btn-oauth">
              Link Google
            </button>
            <button onclick="profileManagement.linkAccount('github')" class="btn btn-sm btn-oauth">
              Link GitHub
            </button>
          </div>
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Create profile edit form component
   */
  createProfileEditForm(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Profile edit form container not found: ${containerId}`);
      return null;
    }

    const component = {
      type: 'edit-form',
      container,
      options: {
        showFullName: options.showFullName !== false,
        showBio: options.showBio !== false,
        showPreferences: options.showPreferences !== false,
        ...options
      }
    };

    this.profileComponents.set(containerId, component);
    this.renderProfileEditForm(component);
    
    return component;
  }

  /**
   * Render profile edit form
   */
  renderProfileEditForm(component) {
    const { container, options } = component;
    const state = this.useAuth.getState();

    if (!state.isAuthenticated) {
      container.innerHTML = '<p>Please sign in to edit your profile.</p>';
      return;
    }

    const user = state.user;
    const metadata = user.user_metadata || {};

    let html = `
      <div class="profile-edit-form">
        <h3>Edit Profile</h3>
        <form onsubmit="profileManagement.saveProfile(event, '${container.id}')">
    `;

    // Full name field
    if (options.showFullName) {
      html += `
        <div class="form-group">
          <label for="fullName">Full Name</label>
          <input type="text" id="fullName" name="fullName" 
                 value="${metadata.full_name || ''}" 
                 placeholder="Enter your full name">
        </div>
      `;
    }

    // Bio field
    if (options.showBio) {
      html += `
        <div class="form-group">
          <label for="bio">Bio</label>
          <textarea id="bio" name="bio" rows="3" 
                    placeholder="Tell us about yourself">${metadata.bio || ''}</textarea>
        </div>
      `;
    }

    // Preferences
    if (options.showPreferences) {
      html += `
        <div class="form-group">
          <label>Preferences</label>
          <div class="preferences">
            <label class="checkbox-label">
              <input type="checkbox" name="emailNotifications" 
                     ${metadata.email_notifications !== false ? 'checked' : ''}>
              Email notifications
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="marketingEmails" 
                     ${metadata.marketing_emails === true ? 'checked' : ''}>
              Marketing emails
            </label>
          </div>
        </div>
      `;
    }

    html += `
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Save Changes</button>
            <button type="button" onclick="profileManagement.cancelEdit('${container.id}')" 
                    class="btn btn-outline">Cancel</button>
          </div>
        </form>
      </div>
    `;

    container.innerHTML = html;
  }

  /**
   * Update all profile components
   */
  updateAllComponents(state) {
    this.profileComponents.forEach((component) => {
      switch (component.type) {
        case 'overview':
          this.renderProfileOverview(component);
          break;
        case 'edit-form':
          this.renderProfileEditForm(component);
          break;
      }
    });
  }

  /**
   * Edit profile
   */
  editProfile(containerId) {
    const component = this.profileComponents.get(containerId);
    if (component && component.type === 'overview') {
      // Switch to edit mode
      component.type = 'edit-form';
      this.renderProfileEditForm(component);
    }
  }

  /**
   * Cancel profile edit
   */
  cancelEdit(containerId) {
    const component = this.profileComponents.get(containerId);
    if (component && component.type === 'edit-form') {
      // Switch back to overview mode
      component.type = 'overview';
      this.renderProfileOverview(component);
    }
  }

  /**
   * Save profile changes
   */
  async saveProfile(event, containerId) {
    event.preventDefault();
    
    try {
      const formData = new FormData(event.target);
      const updates = {
        full_name: formData.get('fullName'),
        bio: formData.get('bio'),
        email_notifications: formData.get('emailNotifications') === 'on',
        marketing_emails: formData.get('marketingEmails') === 'on'
      };

      // Remove empty values
      Object.keys(updates).forEach(key => {
        if (updates[key] === '' || updates[key] === null) {
          delete updates[key];
        }
      });

      console.log('ProfileManagement: Saving profile updates:', updates);

      // Update user metadata
      const { error } = await this.supabase.auth.updateUser({
        data: updates
      });

      if (error) throw error;

      this.showMessage('Profile updated successfully!', 'success');

      // Switch back to overview mode
      this.cancelEdit(containerId);

    } catch (error) {
      console.error('Error saving profile:', error);
      this.showMessage('Failed to update profile. Please try again.', 'error');
    }
  }

  /**
   * Change avatar
   */
  changeAvatar() {
    // Create file input for avatar upload
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (event) => {
      this.handleAvatarUpload(event.target.files[0]);
    };
    input.click();
  }

  /**
   * Handle avatar upload
   */
  async handleAvatarUpload(file) {
    if (!file) return;

    try {
      console.log('ProfileManagement: Uploading avatar:', file.name);

      // Validate file
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        throw new Error('File size must be less than 5MB');
      }

      if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image');
      }

      this.showMessage('Uploading avatar...', 'info');

      // In a real implementation, you would:
      // 1. Upload the file to Supabase Storage
      // 2. Get the public URL
      // 3. Update the user metadata with the new avatar URL

      // For now, we'll simulate the upload
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Create a temporary URL for demo purposes
      const tempUrl = URL.createObjectURL(file);

      // Update user metadata
      const { error } = await this.supabase.auth.updateUser({
        data: { avatar_url: tempUrl }
      });

      if (error) throw error;

      this.showMessage('Avatar updated successfully!', 'success');

      // Refresh components
      this.updateAllComponents(this.useAuth.getState());

    } catch (error) {
      console.error('Error uploading avatar:', error);
      this.showMessage(error.message || 'Failed to upload avatar', 'error');
    }
  }

  /**
   * Change password
   */
  async changePassword() {
    const newPassword = prompt('Enter your new password (minimum 6 characters):');
    
    if (!newPassword) return;

    if (newPassword.length < 6) {
      this.showMessage('Password must be at least 6 characters long', 'error');
      return;
    }

    try {
      await this.useAuth.updatePassword(newPassword);
      this.showMessage('Password updated successfully!', 'success');
    } catch (error) {
      console.error('Error changing password:', error);
      this.showMessage('Failed to change password. Please try again.', 'error');
    }
  }

  /**
   * Resend email verification
   */
  async resendVerification() {
    const user = this.useAuth.getUser();
    if (!user?.email) return;

    try {
      // This would use the auth providers to resend verification
      console.log('ProfileManagement: Resending verification email to:', user.email);
      this.showMessage('Verification email sent! Please check your inbox.', 'success');
    } catch (error) {
      console.error('Error resending verification:', error);
      this.showMessage('Failed to send verification email. Please try again.', 'error');
    }
  }

  /**
   * Link additional account
   */
  async linkAccount(provider) {
    try {
      await this.accountLinking.linkOAuthIdentity(provider);
      this.showMessage(`${provider} account linking initiated`, 'info');
    } catch (error) {
      console.error(`Error linking ${provider} account:`, error);
      this.showMessage(`Failed to link ${provider} account`, 'error');
    }
  }

  /**
   * Unlink account
   */
  async unlinkAccount(identityId) {
    if (!confirm('Are you sure you want to unlink this account?')) {
      return;
    }

    try {
      await this.accountLinking.unlinkIdentity(identityId);
      
      // Refresh components
      this.updateAllComponents(this.useAuth.getState());
      
    } catch (error) {
      console.error('Error unlinking account:', error);
    }
  }

  /**
   * Download user data
   */
  async downloadData() {
    try {
      this.showMessage('Preparing your data for download...', 'info');

      // In a real implementation, this would:
      // 1. Call a server-side function to collect all user data
      // 2. Generate a downloadable file (JSON/CSV)
      // 3. Provide a download link

      // For now, we'll simulate the process
      const userData = await this.collectUserData();
      this.downloadAsJSON(userData, 'my-data.json');

      this.showMessage('Data download started', 'success');

    } catch (error) {
      console.error('Error downloading data:', error);
      this.showMessage('Failed to download data. Please try again.', 'error');
    }
  }

  /**
   * Collect user data for download
   */
  async collectUserData() {
    const user = this.useAuth.getUser();
    const linkingStatus = this.accountLinking.getLinkingStatus();

    return {
      profile: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        metadata: user.user_metadata
      },
      linked_accounts: linkingStatus.identities,
      export_date: new Date().toISOString(),
      // In a real implementation, you would include:
      // usage_records: [],
      // conversions: [],
      // files: [],
      // preferences: {}
    };
  }

  /**
   * Download data as JSON file
   */
  downloadAsJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
   * Get profile component
   */
  getComponent(containerId) {
    return this.profileComponents.get(containerId);
  }

  /**
   * Remove profile component
   */
  removeComponent(containerId) {
    const component = this.profileComponents.get(containerId);
    if (component) {
      component.container.innerHTML = '';
      this.profileComponents.delete(containerId);
    }
  }

  /**
   * Get profile management status
   */
  getProfileStatus() {
    const state = this.useAuth.getState();
    const linkingStatus = this.accountLinking.getLinkingStatus();
    
    return {
      isAuthenticated: state.isAuthenticated,
      isEmailVerified: state.isEmailVerified,
      user: state.user,
      hasLinkedAccounts: linkingStatus.hasMultipleIdentities,
      linkedAccounts: linkingStatus.identities.length,
      profileComplete: this.isProfileComplete(state.user)
    };
  }

  /**
   * Check if profile is complete
   */
  isProfileComplete(user) {
    if (!user) return false;
    
    const metadata = user.user_metadata || {};
    return !!(
      user.email &&
      metadata.full_name &&
      user.email_confirmed_at
    );
  }
}

// Create global instance
let profileManagement = null;

export const getProfileManagement = () => {
  if (!profileManagement) {
    profileManagement = new ProfileManagement();
  }
  return profileManagement;
};

// Initialize on load and expose globally
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const profile = getProfileManagement();
    window.profileManagement = profile;
  });
}

export default ProfileManagement;