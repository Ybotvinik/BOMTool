import { createContext, useContext, useState, type ReactNode } from "react";

export type AppUser = { name: string; initials: string };

export const USERS: AppUser[] = [
  { name: "Yaniv Botvinik", initials: "YB" },
  { name: "Diana", initials: "DI" },
  { name: "Yossi Cohen", initials: "YC" },
  { name: "Other User", initials: "OU" },
];

type Ctx = {
  user: AppUser;
  setUser: (u: AppUser) => void;
  users: AppUser[];
};

const CurrentUserContext = createContext<Ctx | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser>(USERS[0]);
  return (
    <CurrentUserContext.Provider value={{ user, setUser, users: USERS }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) {
    // Safe fallback so isolated components don't crash
    return { user: USERS[0], setUser: () => {}, users: USERS };
  }
  return ctx;
}
