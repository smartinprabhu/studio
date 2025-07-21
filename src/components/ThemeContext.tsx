"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ColorTheme = 'blue' | 'teal' | 'green' | 'purple' | 'orange' | 'gray';
export type FontFamily = 'gotham-book' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  colorTheme: ColorTheme;
  fontFamily: FontFamily;
  setThemeMode: (mode: ThemeMode) => void;
  setColorTheme: (theme: ColorTheme) => void;
  setFontFamily: (font: FontFamily) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [colorTheme, setColorTheme] = useState<ColorTheme>('blue');
  const [fontFamily, setFontFamily] = useState<FontFamily>('system');

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Apply theme mode
    root.classList.remove('light', 'dark');
    if (themeMode === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
      root.setAttribute('data-theme', `${systemTheme}-${colorTheme}`);
    } else {
      root.classList.add(themeMode);
      root.setAttribute('data-theme', `${themeMode}-${colorTheme}`);
    }

    // Apply font family
    if (fontFamily === 'gotham-book') {
      root.style.fontFamily = '"Gotham Book", system-ui, sans-serif';
    } else {
      root.style.fontFamily = 'system-ui, sans-serif';
    }
  }, [themeMode, colorTheme, fontFamily]);

  return (
    <ThemeContext.Provider value={{
      themeMode,
      colorTheme,
      fontFamily,
      setThemeMode,
      setColorTheme,
      setFontFamily,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}