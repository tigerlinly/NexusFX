import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { setupGlobalAlerts } from './utils/alerts.js'

setupGlobalAlerts();

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
