/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import { useAuth } from './AuthContext';

const ThemeContext = createContext(null);

import { THEMES } from '../constants/themes';

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('nexusfx_theme') || 'dark-trading';
  });

  const applyCustomColors = useCallback((colors) => {
    Object.keys(colors).forEach(k => {
      const val = colors[k];
      if (!val) return;
      if (k.includes('font-size') && /^\d+(px|rem|em|%)$/.test(val)) {
        document.documentElement.style.setProperty(`--${k}`, val);
      } else if (/^#([0-9a-fA-F]{3}){1,2}$/.test(val) || val.startsWith('rgba') || val.startsWith('hsl')) {
        document.documentElement.style.setProperty(`--${k}`, val);
      }
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);

    const savedCustomStyles = localStorage.getItem('nexusfx_custom_colors');
    if (savedCustomStyles) {
       try {
         const colors = JSON.parse(savedCustomStyles);
         applyCustomColors(colors);
       } catch (e) { 
         /* ignore */ 
       }
    }
  }, [currentTheme, applyCustomColors]);

  useEffect(() => {
    if (user) {
      api.getSettings()
        .then(s => {
          if (s.theme_id) {
            setCurrentTheme(s.theme_id);
            document.documentElement.setAttribute('data-theme', s.theme_id);
            localStorage.setItem('nexusfx_theme', s.theme_id);
          }
          if (s.custom_colors) {
            localStorage.setItem('nexusfx_custom_colors', JSON.stringify(s.custom_colors));
            applyCustomColors(s.custom_colors);
          }
        })
        .catch(() => {});
    }
  }, [user, applyCustomColors]);

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
