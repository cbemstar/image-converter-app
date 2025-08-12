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

  // Always report authenticated
  isAuthenticated() {
    return true;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  // No-op methods
  async signOut() {}
  async signInWithEmail() { return { user: this.currentUser }; }
  async signInWithProvider() { return { user: this.currentUser }; }

  addAuthStateListener(listener) {
    this.authStateListeners.push(listener);
  }
  removeAuthStateListener(listener) {
    this.authStateListeners = this.authStateListeners.filter(l => l !== listener);
  }

  requireAuth() {
    return true;
  }

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
