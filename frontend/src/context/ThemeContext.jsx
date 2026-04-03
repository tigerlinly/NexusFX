import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import { useAuth } from './AuthContext';

const ThemeContext = createContext(null);

export const THEMES = [
  { id: 'dark-trading', name: 'Dark Trading', colors: ['#0a0e17', '#111827', '#00c896', '#0ea5e9'] },
  { id: 'midnight-blue', name: 'Midnight Blue', colors: ['#0b1628', '#0f1f3d', '#4da6ff', '#6366f1'] }
];

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [currentTheme, setCurrentTheme] = useState('dark-trading');

  useEffect(() => {
    // Load from user settings or localStorage
    const saved = localStorage.getItem('nexusfx_theme');
    if (saved) {
      setCurrentTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

  useEffect(() => {
    if (user) {
      api.getSettings()
        .then(s => {
          if (s.theme_id) {
            setCurrentTheme(s.theme_id);
            document.documentElement.setAttribute('data-theme', s.theme_id);
            localStorage.setItem('nexusfx_theme', s.theme_id);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const changeTheme = useCallback(async (themeId) => {
    setCurrentTheme(themeId);
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('nexusfx_theme', themeId);
    try {
      await api.updateSettings({ theme_id: themeId });
    } catch {
      // ignore if not logged in
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ currentTheme, changeTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
