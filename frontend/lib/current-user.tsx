"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { USERS, type AppUser } from "./users";

type Ctx = {
  user: AppUser;
  setUser: (u: AppUser) => void;
  users: AppUser[];
};

const CurrentUserContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "glintech.currentUserId";

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AppUser>(USERS[0]);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const found = USERS.find((u) => String(u.id) === saved);
      if (found) setUserState(found);
    }
  }, []);

  const setUser = (u: AppUser) => {
    setUserState(u);
    window.localStorage.setItem(STORAGE_KEY, String(u.id));
  };

  return (
    <CurrentUserContext.Provider value={{ user, setUser, users: USERS }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser(): Ctx {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) return { user: USERS[0], setUser: () => {}, users: USERS };
  return ctx;
}
