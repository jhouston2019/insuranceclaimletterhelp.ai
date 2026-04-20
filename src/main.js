// Main application entry point
import { getCurrentUser, getSession } from './components/Auth.js';

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
  // Check if user is logged in
  const user = await getCurrentUser();
  const session = await getSession();
  
  if (user && session) {
    // User is logged in, show dashboard link
    updateNavigationForLoggedInUser(user);
  } else {
    // User is not logged in, show login/signup
    updateNavigationForGuest();
  }
});

function updateNavigationForLoggedInUser(user) {
  const nav = document.querySelector('nav div:last-child');
  if (nav) {
    nav.innerHTML = `
      <a href="/payment.html">Upload</a> |
      <a href="/dashboard.html">Dashboard</a> |
      <a href="/pricing.html">Pricing</a> |
      <span>Welcome, ${user.email}</span> |
      <a href="#" id="logout">Logout</a>
    `;
    
    // Add logout functionality
    document.getElementById('logout').addEventListener('click', async (e) => {
      e.preventDefault();
      const { signOut } = await import('./components/Auth.js');
      await signOut();
      window.location.href = '/';
    });
  }
}

function updateNavigationForGuest() {
  const nav = document.querySelector('nav div:last-child');
  if (nav) {
    nav.innerHTML = `
      <a href="/payment.html">Upload</a> |
      <a href="/dashboard.html">Dashboard</a> |
      <a href="/pricing.html">Pricing</a> |
      <a href="/login.html">Login</a>
    `;
  }
}

// Global checkout — Stripe collects email; optional logged-in supabase_user_id for linkage
window.startCheckout = async function (plan, evt) {
  try {
    const user = await getCurrentUser();
    const button = evt && evt.target ? evt.target : null;
    const originalText = button ? button.textContent : '';
    if (button) {
      button.textContent = 'Processing...';
      button.disabled = true;
    }

    const response = await fetch('/.netlify/functions/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: plan || 'single',
        supabase_user_id: user?.id || null
      })
    });

    const data = await response.json();

    if (data.url) {
      try {
        if (data.id) localStorage.setItem('last_checkout_session_id', data.id);
      } catch (_) {}
      window.location.href = data.url;
    } else {
      alert('Failed to create checkout session: ' + (data.error || data.details || 'Unknown error'));
      if (button) {
        button.textContent = originalText || 'Try Again';
        button.disabled = false;
      }
    }
  } catch (error) {
    alert('Failed to start checkout: ' + error.message);
    const button = evt && evt.target ? evt.target : null;
    if (button) {
      button.textContent = button.getAttribute('data-original-text') || 'Try Again';
      button.disabled = false;
    }
  }
};
