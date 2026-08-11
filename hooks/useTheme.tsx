import { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors, type ColorPalette } from '@/theme';

const THEME_KEY = 'resenha:theme';

export type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedScheme = 'light' | 'dark';

type ThemeContextType = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolvedScheme: ResolvedScheme;
  colors: ColorPalette;
};

const ThemeContext = createContext<ThemeContextType>({
  mode: 'system',
  setMode: () => {},
  resolvedScheme: 'light',
  colors: lightColors,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const systemScheme = useColorScheme();

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(THEME_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setModeState(stored);
      }
    })();
  }, []);

  function setMode(next: ThemeMode) {
    setModeState(next);
    AsyncStorage.setItem(THEME_KEY, next);
  }

  const resolvedScheme: ResolvedScheme = mode === 'system' ? (systemScheme ?? 'light') : mode;
  const colors = resolvedScheme === 'dark' ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ mode, setMode, resolvedScheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
