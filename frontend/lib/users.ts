export type AppUser = { id: number; name: string; initials: string };

// Mock current-user roster. In production this comes from Google Workspace.
export const USERS: AppUser[] = [
  { id: 1, name: "Yaniv Botvinik", initials: "YB" },
  { id: 2, name: "Diana", initials: "DI" },
  { id: 3, name: "Yossi Cohen", initials: "YC" },
  { id: 4, name: "Other User", initials: "OU" },
];
