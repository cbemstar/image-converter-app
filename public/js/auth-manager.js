/**
 * Lightweight AuthManager stub that disables authentication.
 * Provides minimal API to satisfy existing calls without any auth logic.
 */
class AuthManager {
  constructor() {
    this.currentUser = { id: 'guest', email: 'guest@example.com' };
    this.authStateListeners = [];
    this.updateAuthUI();
  }

  // Always report authenticated to bypass checks
  isAuthenticated() {
    return true;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  // No-op auth methods
  async signOut() {}
  async signInWithEmail() { return { user: this.currentUser }; }
  async signInWithProvider() { return { user: this.currentUser }; }

  // Listener management (no-op)
  addAuthStateListener(listener) {
    this.authStateListeners.push(listener);
  }
  removeAuthStateListener(listener) {
    this.authStateListeners = this.authStateListeners.filter(l => l !== listener);
  }

  // Always allow access
  requireAuth() {
    return true;
  }

  // Hide any auth related UI elements
  updateAuthUI() {
    document.querySelectorAll('[data-auth-required],[data-guest-only]').forEach(el => {
      el.style.display = 'none';
      el.classList.add('hidden');
    });
  }
}

window.authManager = new AuthManager();

if (typeof module !== 'undefined') {
  module.exports = AuthManager;
}
