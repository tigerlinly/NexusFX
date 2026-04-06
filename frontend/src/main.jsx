import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { setupGlobalAlerts } from './utils/alerts.js'

setupGlobalAlerts();

// Force clear old cache/user values on first visit after this update
const APP_VERSION = 'v1.0.1';
if (localStorage.getItem('nexusfx_app_version') !== APP_VERSION) {
  // Save theme if exists so user doesn't get blinded, wipe the rest
  const currentTheme = localStorage.getItem('nexusfx_theme') || 'dark-trading';
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('nexusfx_app_version', APP_VERSION);
  localStorage.setItem('nexusfx_theme', currentTheme);
  
  // If not already on login page, force reload to login
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }
}

// Set default theme
if (!document.documentElement.getAttribute('data-theme')) {
  document.documentElement.setAttribute('data-theme', 
    localStorage.getItem('nexusfx_theme') || 'dark-trading'
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
