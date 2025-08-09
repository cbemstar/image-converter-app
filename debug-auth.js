// Debug script to test authentication issues
console.log('=== Authentication Debug Script ===');

// Check if all required globals are available
console.log('1. Checking global variables:');
console.log('   window.PUBLIC_ENV:', !!window.PUBLIC_ENV);
console.log('   window.supabase:', !!window.supabase);
console.log('   window.authManager:', !!window.authManager);

if (window.PUBLIC_ENV) {
    console.log('2. Configuration values:');
    console.log('   SUPABASE_URL:', window.PUBLIC_ENV.SUPABASE_URL);
    console.log('   SUPABASE_ANON_KEY:', window.PUBLIC_ENV.SUPABASE_ANON_KEY ? 'Present' : 'Missing');
    console.log('   STRIPE_PUBLISHABLE_KEY:', window.PUBLIC_ENV.STRIPE_PUBLISHABLE_KEY ? 'Present' : 'Missing');
}

// Test Supabase client initialization
if (window.supabase) {
    console.log('3. Testing Supabase client:');
    
    // Test basic connection
    window.supabase.auth.getSession()
        .then(({ data, error }) => {
            if (error) {
                console.log('   Session check error:', error.message);
            } else {
                console.log('   Session check successful:', !!data.session);
            }
        })
        .catch(err => {
            console.error('   Session check failed:', err);
        });
    
    // Test auth state listener
    window.supabase.auth.onAuthStateChange((event, session) => {
        console.log('   Auth state change:', event, session ? 'Session present' : 'No session');
    });
}

// Test AuthManager
if (window.authManager) {
    console.log('4. Testing AuthManager:');
    console.log('   Is authenticated:', window.authManager.isAuthenticated());
    console.log('   Current user:', !!window.authManager.getCurrentUser());
    console.log('   Current session:', !!window.authManager.getCurrentSession());
}

// Check DOM elements
console.log('5. Checking DOM elements:');
const authRequired = document.querySelectorAll('[data-auth-required]');
const guestOnly = document.querySelectorAll('[data-guest-only]');
const userInfo = document.querySelectorAll('[data-user-info]');

console.log('   Auth required elements:', authRequired.length);
console.log('   Guest only elements:', guestOnly.length);
console.log('   User info elements:', userInfo.length);

// Test form elements on auth page
if (window.location.pathname.includes('auth')) {
    console.log('6. Auth page specific checks:');
    const signinForm = document.getElementById('signinForm');
    const signupForm = document.getElementById('signupForm');
    const googleBtn = document.getElementById('googleSignin');
    
    console.log('   Sign in form:', !!signinForm);
    console.log('   Sign up form:', !!signupForm);
    console.log('   Google button:', !!googleBtn);
    
    if (googleBtn) {
        console.log('   Google button click handler:', googleBtn.onclick ? 'Present' : 'Missing');
    }
}

console.log('=== Debug Complete ===');