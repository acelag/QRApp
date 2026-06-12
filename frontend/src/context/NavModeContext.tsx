import { createContext, useContext, useState } from 'react';

export type NavMode = 'sidebar' | 'launcher';

interface NavModeContextValue {
  navMode: NavMode;
  setNavMode: (mode: NavMode) => void;
}

const NavModeContext = createContext<NavModeContextValue>({
  navMode: 'sidebar',
  setNavMode: () => {},
});

export function NavModeProvider({ children }: { children: React.ReactNode }) {
  const [navMode, setNavModeState] = useState<NavMode>(
    () => (localStorage.getItem('qra-nav-mode') as NavMode | null) ?? 'sidebar'
  );

  function setNavMode(mode: NavMode) {
    localStorage.setItem('qra-nav-mode', mode);
    setNavModeState(mode);
  }

  return (
    <NavModeContext.Provider value={{ navMode, setNavMode }}>
      {children}
    </NavModeContext.Provider>
  );
}

export function useNavMode() {
  return useContext(NavModeContext);
}
