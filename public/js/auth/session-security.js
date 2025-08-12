/**
 * Session Security System
 * Implements session token rotation, timeout management, and hijacking detection
 */

import { createClient } from './supabase-client.js';
import { useAuth } from './hooks/useAuth.js';
import { getCookieConfig } from './cookie-config.js';

class SessionSecurity {
  constructor() {
    this.supabase = createClient();
    this.useAuth = useAuth();
    this.cookieConfig = getCookieConfig();
    
    // Security configuration
    this.config = {
      tokenRotationInterval: 15 * 60 * 1000, // 15 minutes
      sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
      inactivityTimeout: 2 * 60 * 60 * 1000, // 2 hours
      maxConcurrentSessions: 5,
      enableHijackingDetection: true,
      enableDeviceFingerprinting: true,
      rotateOnPrivilegeChange: true
    };
    
    // State tracking
    this.lastActivity = Date.now();
    this.rotationTimer = null;
    this.inactivityTimer = null;
    this.sessionFingerprint = null;
    this.deviceFingerprint = null;
    this.securityEvents = [];
    
    this.initialize();
  }

  /**
   * Initialize session security system
   */
  async initialize() {
    try {
      console.log('SessionSecurity: Initializing security system');

      // Subscribe to auth state changes
      this.useAuth.subscribe((state) => {
        this.handleAuthStateChange(state);
      });

      // Generate device fingerprint
      this.deviceFingerprint = await this.generateDeviceFingerprint();
      
      // Set up activity monitoring
      this.setupActivityMonitoring();
      
      // Set up security event listeners
      this.setupSecurityEventListeners();
      
      // Initialize session if user is authenticated
      const state = this.useAuth.getState();
      if (state.isAuthenticated) {
        await this.initializeSecureSession(state.session);
      }

      console.log('SessionSecurity: Initialization complete');
    } catch (error) {
      console.error('SessionSecurity initialization error:', error);
    }
  }

  /**
   * Handle authentication state changes
   */
  async handleAuthStateChange(state) {
    console.log('SessionSecurity: Auth state changed', state.isAuthenticated);

    if (state.isAuthenticated && state.session) {
      await this.handleSignIn(state.session, state.user);
    } else {
      await this.handleSignOut();
    }
  }

  /**
   * Handle successful sign in
   */
  async handleSignIn(session, user) {
    try {
      console.log('SessionSecurity: Handling sign in');

      // Initialize secure session
      await this.initializeSecureSession(session);
      
      // Rotate token on login
      await this.rotateSessionToken('login');
      
      // Log security event
      this.logSecurityEvent('session_started', {
        userId: user.id,
        deviceFingerprint: this.deviceFingerprint,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error handling secure sign in:', error);
    }
  }

  /**
   * Handle sign out
   */
  async handleSignOut() {
    try {
      console.log('SessionSecurity: Handling sign out');

      // Clear timers
      this.clearSecurityTimers();
      
      // Clear session data
      this.clearSecureSessionData();
      
      // Log security event
      this.logSecurityEvent('session_ended', {
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error handling secure sign out:', error);
    }
  }

  /**
   * Initialize secure session
   */
  async initializeSecureSession(session) {
    try {
      // Generate session fingerprint
      this.sessionFingerprint = this.generateSessionFingerprint(session);
      
      // Store secure session metadata
      this.storeSecureSessionMetadata(session);
      
      // Set up token rotation
      this.setupTokenRotation();
      
      // Set up session timeout
      this.setupSessionTimeout();
      
      // Set up inactivity timeout
      this.setupInactivityTimeout();
      
      // Check for session hijacking
      if (this.config.enableHijackingDetection) {
        await this.checkSessionHijacking(session);
      }

    } catch (error) {
      console.error('Error initializing secure session:', error);
    }
  }

  /**
   * Generate session fingerprint
   */
  generateSessionFingerprint(session) {
    const fingerprintData = [
      session.user.id,
      session.access_token.substring(0, 10), // First 10 chars of token
      this.deviceFingerprint,
      Date.now().toString()
    ].join('|');

    return this.hashString(fingerprintData);
  }

  /**
   * Store secure session metadata
   */
  storeSecureSessionMetadata(session) {
    const metadata = {
      sessionId: this.sessionFingerprint,
      userId: session.user.id,
      deviceFingerprint: this.deviceFingerprint,
      startTime: Date.now(),
      lastActivity: Date.now(),
      expiresAt: session.expires_at * 1000,
      rotationCount: 0
    };

    // Store in secure session storage
    sessionStorage.setItem('secure_session_meta', JSON.stringify(metadata));
    
    // Store fingerprint separately for hijacking detection
    sessionStorage.setItem('session_fingerprint', this.sessionFingerprint);
  }

  /**
   * Set up token rotation
   */
  setupTokenRotation() {
    this.clearRotationTimer();
    
    this.rotationTimer = setInterval(async () => {
      try {
        await this.rotateSessionToken('scheduled');
      } catch (error) {
        console.error('Scheduled token rotation failed:', error);
      }
    }, this.config.tokenRotationInterval);

    console.log(`SessionSecurity: Token rotation scheduled every ${this.config.tokenRotationInterval / 1000} seconds`);
  }

  /**
   * Set up session timeout
   */
  setupSessionTimeout() {
    const metadata = this.getSecureSessionMetadata();
    if (!metadata) return;

    const timeUntilExpiry = metadata.expiresAt - Date.now();
    
    if (timeUntilExpiry > 0) {
      setTimeout(async () => {
        console.log('SessionSecurity: Session expired due to timeout');
        await this.handleSessionExpiry('timeout');
      }, timeUntilExpiry);
    }
  }

  /**
   * Set up inactivity timeout
   */
  setupInactivityTimeout() {
    this.clearInactivityTimer();
    
    this.inactivityTimer = setTimeout(async () => {
      console.log('SessionSecurity: Session expired due to inactivity');
      await this.handleSessionExpiry('inactivity');
    }, this.config.inactivityTimeout);
  }

  /**
   * Reset inactivity timeout
   */
  resetInactivityTimeout() {
    this.lastActivity = Date.now();
    this.setupInactivityTimeout();
    
    // Update session metadata
    const metadata = this.getSecureSessionMetadata();
    if (metadata) {
      metadata.lastActivity = Date.now();
      sessionStorage.setItem('secure_session_meta', JSON.stringify(metadata));
    }
  }

  /**
   * Rotate session token
   */
  async rotateSessionToken(reason = 'manual') {
    try {
      console.log(`SessionSecurity: Rotating session token (reason: ${reason})`);

      // Get current session
      const { data: { session }, error } = await this.supabase.auth.getSession();
      if (error || !session) {
        throw new Error('No active session to rotate');
      }

      // Refresh session to get new tokens
      const { data: { session: newSession }, error: refreshError } = 
        await this.supabase.auth.refreshSession();
      
      if (refreshError) {
        throw refreshError;
      }

      if (newSession) {
        // Update session fingerprint
        this.sessionFingerprint = this.generateSessionFingerprint(newSession);
        
        // Update secure session metadata
        const metadata = this.getSecureSessionMetadata();
        if (metadata) {
          metadata.rotationCount += 1;
          metadata.lastRotation = Date.now();
          sessionStorage.setItem('secure_session_meta', JSON.stringify(metadata));
        }

        // Update authentication cookies
        this.updateAuthenticationCookies(newSession);
        
        // Log security event
        this.logSecurityEvent('token_rotated', {
          reason,
          rotationCount: metadata?.rotationCount || 0,
          timestamp: Date.now()
        });

        console.log('SessionSecurity: Token rotation successful');
        return newSession;
      }

    } catch (error) {
      console.error('Token rotation failed:', error);
      
      // Log security event
      this.logSecurityEvent('token_rotation_failed', {
        reason,
        error: error.message,
        timestamp: Date.now()
      });

      // If rotation fails multiple times, sign out for security
      if (this.getConsecutiveRotationFailures() >= 3) {
        console.warn('SessionSecurity: Multiple rotation failures, signing out');
        await this.forceSignOut('rotation_failure');
      }

      throw error;
    }
  }

  /**
   * Update authentication cookies after token rotation
   */
  updateAuthenticationCookies(session) {
    try {
      // Set new access token cookie
      if (session.access_token) {
        this.cookieConfig.setAuthCookie('sb-access-token', session.access_token, {
          maxAge: 60 * 60 // 1 hour
        });
      }

      // Set new refresh token cookie (more secure)
      if (session.refresh_token) {
        this.cookieConfig.setSecureCookie('sb-refresh-token', session.refresh_token, {
          maxAge: 60 * 60 * 24 * 7 // 7 days
        });
      }

      console.log('SessionSecurity: Authentication cookies updated');
    } catch (error) {
      console.error('Error updating authentication cookies:', error);
    }
  }

  /**
   * Check for session hijacking
   */
  async checkSessionHijacking(session) {
    try {
      const storedFingerprint = sessionStorage.getItem('session_fingerprint');
      const currentFingerprint = this.generateSessionFingerprint(session);

      // Check device fingerprint consistency
      const storedDeviceFingerprint = sessionStorage.getItem('device_fingerprint');
      if (storedDeviceFingerprint && storedDeviceFingerprint !== this.deviceFingerprint) {
        console.warn('SessionSecurity: Device fingerprint mismatch detected');
        
        this.logSecurityEvent('potential_hijacking', {
          type: 'device_fingerprint_mismatch',
          storedFingerprint: storedDeviceFingerprint,
          currentFingerprint: this.deviceFingerprint,
          timestamp: Date.now()
        });

        // Ask user to verify
        if (await this.confirmDeviceChange()) {
          // User confirmed - update stored fingerprint
          sessionStorage.setItem('device_fingerprint', this.deviceFingerprint);
        } else {
          // User denied - potential hijacking
          await this.handleSuspiciousActivity('device_fingerprint_mismatch');
          return;
        }
      }

      // Check for impossible travel (if location data available)
      await this.checkImpossibleTravel();

      // Check session metadata consistency
      const metadata = this.getSecureSessionMetadata();
      if (metadata && this.detectMetadataInconsistency(metadata, session)) {
        console.warn('SessionSecurity: Session metadata inconsistency detected');
        await this.handleSuspiciousActivity('metadata_inconsistency');
      }

    } catch (error) {
      console.error('Error checking session hijacking:', error);
    }
  }

  /**
   * Generate device fingerprint
   */
  async generateDeviceFingerprint() {
    try {
      const fingerprints = [];

      // Browser information
      fingerprints.push(navigator.userAgent);
      fingerprints.push(navigator.language);
      fingerprints.push(navigator.platform);
      fingerprints.push(navigator.hardwareConcurrency || 'unknown');

      // Screen information
      fingerprints.push(`${screen.width}x${screen.height}`);
      fingerprints.push(`${screen.colorDepth}`);
      fingerprints.push(screen.pixelDepth || 'unknown');

      // Timezone
      fingerprints.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
      fingerprints.push(new Date().getTimezoneOffset().toString());

      // Canvas fingerprint
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Device fingerprint', 2, 2);
      fingerprints.push(canvas.toDataURL());

      // WebGL fingerprint (if available)
      try {
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          fingerprints.push(gl.getParameter(gl.RENDERER));
          fingerprints.push(gl.getParameter(gl.VENDOR));
        }
      } catch (e) {
        // WebGL not available
      }

      // Audio context fingerprint (if available)
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const analyser = audioContext.createAnalyser();
        oscillator.connect(analyser);
        fingerprints.push(analyser.frequencyBinCount.toString());
        audioContext.close();
      } catch (e) {
        // Audio context not available
      }

      const fingerprintString = fingerprints.join('|');
      const fingerprint = this.hashString(fingerprintString);
      
      // Store for consistency checks
      sessionStorage.setItem('device_fingerprint', fingerprint);
      
      return fingerprint;
    } catch (error) {
      console.error('Error generating device fingerprint:', error);
      return 'unknown';
    }
  }

  /**
   * Hash string using simple algorithm
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Set up activity monitoring
   */
  setupActivityMonitoring() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const activityHandler = () => {
      this.resetInactivityTimeout();
    };

    events.forEach(event => {
      document.addEventListener(event, activityHandler, { passive: true });
    });

    // Monitor page visibility
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.resetInactivityTimeout();
      }
    });
  }

  /**
   * Set up security event listeners
   */
  setupSecurityEventListeners() {
    // Listen for storage events (potential session manipulation)
    window.addEventListener('storage', (event) => {
      if (event.key === 'secure_session_meta' || event.key === 'session_fingerprint') {
        console.warn('SessionSecurity: Session storage manipulation detected');
        this.logSecurityEvent('storage_manipulation', {
          key: event.key,
          oldValue: event.oldValue,
          newValue: event.newValue,
          timestamp: Date.now()
        });
      }
    });

    // Listen for focus events (potential session sharing)
    window.addEventListener('focus', () => {
      this.checkConcurrentSessions();
    });
  }

  /**
   * Check for concurrent sessions
   */
  async checkConcurrentSessions() {
    try {
      // This would typically check with the server for concurrent sessions
      // For now, we'll simulate the check
      
      const metadata = this.getSecureSessionMetadata();
      if (!metadata) return;

      // In a real implementation, you would:
      // 1. Call server API to check active sessions for user
      // 2. Compare session IDs and device fingerprints
      // 3. Alert user if suspicious concurrent sessions detected

      console.log('SessionSecurity: Checking concurrent sessions (simulated)');
    } catch (error) {
      console.error('Error checking concurrent sessions:', error);
    }
  }

  /**
   * Check for impossible travel
   */
  async checkImpossibleTravel() {
    try {
      // This would check if user location changed impossibly fast
      // Requires geolocation and server-side tracking
      
      // For now, we'll skip this check
      console.log('SessionSecurity: Impossible travel check (not implemented)');
    } catch (error) {
      console.error('Error checking impossible travel:', error);
    }
  }

  /**
   * Detect metadata inconsistency
   */
  detectMetadataInconsistency(metadata, session) {
    // Check if session user ID matches stored metadata
    if (metadata.userId !== session.user.id) {
      return true;
    }

    // Check if session is older than expected
    const sessionAge = Date.now() - metadata.startTime;
    if (sessionAge > this.config.sessionTimeout) {
      return true;
    }

    return false;
  }

  /**
   * Confirm device change with user
   */
  async confirmDeviceChange() {
    return new Promise((resolve) => {
      const confirmed = confirm(
        'We detected you may be using a different device. ' +
        'Is this correct? Click OK to continue or Cancel if this is suspicious activity.'
      );
      resolve(confirmed);
    });
  }

  /**
   * Handle suspicious activity
   */
  async handleSuspiciousActivity(type) {
    console.warn(`SessionSecurity: Suspicious activity detected: ${type}`);
    
    this.logSecurityEvent('suspicious_activity', {
      type,
      timestamp: Date.now()
    });

    // Force sign out for security
    await this.forceSignOut('suspicious_activity');
  }

  /**
   * Handle session expiry
   */
  async handleSessionExpiry(reason) {
    console.log(`SessionSecurity: Session expired (${reason})`);
    
    this.logSecurityEvent('session_expired', {
      reason,
      timestamp: Date.now()
    });

    await this.forceSignOut(reason);
  }

  /**
   * Force sign out
   */
  async forceSignOut(reason) {
    try {
      console.log(`SessionSecurity: Force sign out (${reason})`);
      
      // Clear all security timers
      this.clearSecurityTimers();
      
      // Clear session data
      this.clearSecureSessionData();
      
      // Sign out from Supabase
      await this.supabase.auth.signOut();
      
      // Show message to user
      const messages = {
        'timeout': 'Your session has expired. Please sign in again.',
        'inactivity': 'You have been signed out due to inactivity.',
        'suspicious_activity': 'Your session has been terminated due to suspicious activity.',
        'rotation_failure': 'Your session has been terminated due to security issues.'
      };
      
      const message = messages[reason] || 'You have been signed out for security reasons.';
      this.showMessage(message, 'warning');
      
    } catch (error) {
      console.error('Error during force sign out:', error);
    }
  }

  /**
   * Clear security timers
   */
  clearSecurityTimers() {
    this.clearRotationTimer();
    this.clearInactivityTimer();
  }

  /**
   * Clear rotation timer
   */
  clearRotationTimer() {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }
  }

  /**
   * Clear inactivity timer
   */
  clearInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  /**
   * Clear secure session data
   */
  clearSecureSessionData() {
    sessionStorage.removeItem('secure_session_meta');
    sessionStorage.removeItem('session_fingerprint');
    sessionStorage.removeItem('device_fingerprint');
    
    // Clear authentication cookies
    this.cookieConfig.clearAuthCookies();
    this.cookieConfig.clearSecureCookies();
  }

  /**
   * Get secure session metadata
   */
  getSecureSessionMetadata() {
    try {
      const metadata = sessionStorage.getItem('secure_session_meta');
      return metadata ? JSON.parse(metadata) : null;
    } catch (error) {
      console.error('Error getting secure session metadata:', error);
      return null;
    }
  }

  /**
   * Log security event
   */
  logSecurityEvent(type, data) {
    const event = {
      type,
      timestamp: Date.now(),
      sessionId: this.sessionFingerprint,
      deviceFingerprint: this.deviceFingerprint,
      ...data
    };

    this.securityEvents.push(event);
    
    // Keep only last 100 events
    if (this.securityEvents.length > 100) {
      this.securityEvents = this.securityEvents.slice(-100);
    }

    console.log('SessionSecurity: Security event logged:', event);
  }

  /**
   * Get consecutive rotation failures
   */
  getConsecutiveRotationFailures() {
    let failures = 0;
    for (let i = this.securityEvents.length - 1; i >= 0; i--) {
      const event = this.securityEvents[i];
      if (event.type === 'token_rotation_failed') {
        failures++;
      } else if (event.type === 'token_rotated') {
        break;
      }
    }
    return failures;
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
   * Get security status
   */
  getSecurityStatus() {
    const metadata = this.getSecureSessionMetadata();
    const state = this.useAuth.getState();
    
    return {
      isAuthenticated: state.isAuthenticated,
      sessionActive: !!metadata,
      sessionAge: metadata ? Date.now() - metadata.startTime : 0,
      lastActivity: this.lastActivity,
      rotationCount: metadata?.rotationCount || 0,
      deviceFingerprint: this.deviceFingerprint,
      sessionFingerprint: this.sessionFingerprint,
      securityEvents: this.securityEvents.length,
      timersActive: {
        rotation: !!this.rotationTimer,
        inactivity: !!this.inactivityTimer
      }
    };
  }

  /**
   * Manual token rotation
   */
  async manualTokenRotation() {
    try {
      await this.rotateSessionToken('manual');
      this.showMessage('Session token rotated successfully', 'success');
    } catch (error) {
      this.showMessage('Failed to rotate session token', 'error');
      throw error;
    }
  }

  /**
   * Get security events
   */
  getSecurityEvents(limit = 50) {
    return this.securityEvents.slice(-limit);
  }

  /**
   * Clear security events
   */
  clearSecurityEvents() {
    this.securityEvents = [];
  }
}

// Create global instance
let sessionSecurity = null;

export const getSessionSecurity = () => {
  if (!sessionSecurity) {
    sessionSecurity = new SessionSecurity();
  }
  return sessionSecurity;
};

// Initialize on load and expose globally
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const security = getSessionSecurity();
    window.sessionSecurity = security;
  });
}

export default SessionSecurity;