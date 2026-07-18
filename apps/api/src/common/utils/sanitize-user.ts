import { User } from '@prisma/client';

export type SafeUser = Omit<User, 'password'>;

export function sanitizeUser(user: User): SafeUser {
  const { password: _password, ...safeUser } = user;
  return safeUser;
}
