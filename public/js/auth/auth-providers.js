/**
 * Authentication Providers Configuration
 * Handles email, Google, and GitHub authentication with secure settings
 */

import { createClient } from './supabase-client.js';

class AuthProviders {
  constructor() {
    this.supabase = createClient();
    this.providers = {
      email: {
        name: 'Email',
        icon: '✉️',
        enabled: true,
        requiresPassword: true
      },
      google: {
        name: 'Google',
        icon: '🔍',
        enabled: true,
        requiresPassword: false
      },
      github: {
        name: 'GitHub',
        icon: '🐙',
        enabled: true,
        requiresPassword: false
      }
    };
  }

  /**
   * Get available authentication providers
   */
  getAvailableProviders() {
    return Object.entries(this.providers)
      .filter(([_, config]) => config.enabled)
      .map(([key, config]) => ({
        id: key,
        ...config
      }));
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email, password, options = {}) {
    try {
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
        options: {
          captchaToken: options.captchaToken
        }
      });

      if (error) throw error;

      return {
        success: true,
        user: data.user,
        session: data.session,
        provider: 'email'
      };

    } catch (error) {
      console.error('Email sign in error:', error);
      throw this.normalizeAuthError(error);
    }
  }

  /**
   * Sign up with email and password
   */
  async signUpWithEmail(email, password, options = {}) {
    try {
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address');
      }

      const { data, error } = await this.supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
        options: {
          data: {
            full_name: options.fullName || '',
            ...options.metadata
          },
          captchaToken: options.captchaToken,
          emailRedirectTo: this.getEmailRedirectUrl()
        }
      });

      if (error) throw error;

      return {
        success: true,
        user: data.user,
        session: data.session,
        requiresConfirmation: !data.session,
        provider: 'email'
      };

    } catch (error) {
      console.error('Email sign up error:', error);
      throw this.normalizeAuthError(error);
    }
  }

  /**
   * Sign in with Google OAuth
   */
  async signInWithGoogle(options = {}) {
    try {
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: this.getOAuthRedirectUrl(),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            ...options.queryParams
          },
          scopes: 'email profile'
        }
      });

      if (error) throw error;

      return {
        success: true,
        data,
        provider: 'google'
      };

    } catch (error) {
      console.error('Google sign in error:', error);
      throw this.normalizeAuthError(error);
    }
  }

  /**
   * Sign in with GitHub OAuth
   */
  async signInWithGitHub(options = {}) {
    try {
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: this.getOAuthRedirectUrl(),
          queryParams: {
            ...options.queryParams
          },
          scopes: 'user:email'
        }
      });

      if (error) throw error;

      return {
        success: true,
        data,
        provider: 'github'
      };

    } catch (error) {
      console.error('GitHub sign in error:', error);
      throw this.normalizeAuthError(error);
    }
  }

  /**
   * Reset password
   */
  async resetPassword(email, options = {}) {
    try {
      if (!email) {
        throw new Error('Email is required');
      }

      const { error } = await this.supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: this.getPasswordResetRedirectUrl(),
          captchaToken: options.captchaToken
        }
      );

      if (error) throw error;

      return {
        success: true,
        message: 'Password reset email sent. Please check your inbox.'
      };

    } catch (error) {
      console.error('Password reset error:', error);
      throw this.normalizeAuthError(error);
    }
  }

  /**
   * Update password
   */
  async updatePassword(newPassword, options = {}) {
    try {
      if (!newPassword || newPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      const { error } = await this.supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      return {
        success: true,
        message: 'Password updated successfully'
      };

    } catch (error) {
      console.error('Password update error:', error);
      throw this.normalizeAuthError(error);
    }
  }

  /**
   * Resend email confirmation
   */
  async resendConfirmation(email, options = {}) {
    try {
      if (!email) {
        throw new Error('Email is required');
      }

      const { error } = await this.supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: this.getEmailRedirectUrl(),
          captchaToken: options.captchaToken
        }
      });

      if (error) throw error;

      return {
        success: true,
        message: 'Confirmation email sent. Please check your inbox.'
      };

    } catch (error) {
      console.error('Resend confirmation error:', error);
      throw this.normalizeAuthError(error);
    }
  }

  /**
   * Sign out current user
   */
  async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut();
      if (error) throw error;

      return {
        success: true,
        message: 'Signed out successfully'
      };

    } catch (error) {
      console.error('Sign out error:', error);
      throw this.normalizeAuthError(error);
    }
  }

  /**
   * Get OAuth redirect URL
   */
  getOAuthRedirectUrl() {
    // Store current URL for post-auth redirect
    const currentUrl = window.location.href;
    sessionStorage.setItem('auth_redirect', currentUrl);
    
    // Return to auth.html for OAuth callback processing
    return `${window.location.origin}/auth.html`;
  }

  /**
   * Get email redirect URL for email confirmation
   */
  getEmailRedirectUrl() {
    return `${window.location.origin}/auth.html?type=email_confirmation`;
  }

  /**
   * Get password reset redirect URL
   */
  getPasswordResetRedirectUrl() {
    return `${window.location.origin}/reset-password.html`;
  }

  /**
   * Normalize authentication errors
   */
  normalizeAuthError(error) {
    const errorMessages = {
      'Invalid login credentials': 'Invalid email or password. Please check your credentials and try again.',
      'Email not confirmed': 'Please check your email and confirm your account before signing in.',
      'User not found': 'No account found with this email address.',
      'Invalid email': 'Please enter a valid email address.',
      'Password should be at least 6 characters': 'Password must be at least 6 characters long.',
      'User already registered': 'An account with this email already exists. Please sign in instead.',
      'Signup disabled': 'New account registration is currently disabled.',
      'Email rate limit exceeded': 'Too many emails sent. Please wait before requesting another.',
      'Captcha verification failed': 'Captcha verification failed. Please try again.',
      'Invalid refresh token': 'Your session has expired. Please sign in again.',
      'Auth session missing': 'Authentication session is missing. Please sign in again.',
      'Invalid JWT': 'Invalid authentication token. Please sign in again.',
      'JWT expired': 'Your session has expired. Please sign in again.'
    };

    const message = errorMessages[error.message] || error.message || 'An unexpected error occurred. Please try again.';
    
    return new Error(message);
  }

  /**
   * Validate provider configuration
   */
  validateProviderConfig() {
    const issues = [];
    
    // Check if OAuth providers are properly configured
    if (this.providers.google.enabled) {
      const googleClientId = window.OAUTH_CONFIG?.GOOGLE_CLIENT_ID;
      if (!googleClientId || googleClientId.includes('your-google-client-id')) {
        issues.push('Google OAuth client ID not configured');
      }
    }
    
    if (this.providers.github.enabled) {
      const githubClientId = window.OAUTH_CONFIG?.GITHUB_CLIENT_ID;
      if (!githubClientId || githubClientId.includes('your-github-client-id')) {
        issues.push('GitHub OAuth client ID not configured');
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Get provider-specific configuration
   */
  getProviderConfig(providerId) {
    return this.providers[providerId] || null;
  }

  /**
   * Enable/disable a provider
   */
  setProviderEnabled(providerId, enabled) {
    if (this.providers[providerId]) {
      this.providers[providerId].enabled = enabled;
    }
  }
}

// Create global instance
let authProviders = null;

export const getAuthProviders = () => {
  if (!authProviders) {
    authProviders = new AuthProviders();
  }
  return authProviders;
};

// Export for direct usage
export default AuthProviders;