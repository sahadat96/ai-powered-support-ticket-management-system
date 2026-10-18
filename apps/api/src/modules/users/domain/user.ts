export const ROLES = ['CUSTOMER', 'AGENT', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];
export interface Actor {
  id: string;
  role: Role;
}
export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: Role;
  passwordHash: string;
  createdAt: Date;
}
export type PublicUser = Omit<UserRecord, 'passwordHash'>;
export function publicUser(user: UserRecord): PublicUser {
  const { passwordHash: _, ...safe } = user;
  return safe;
}
