import { User } from '@prisma/client';

export type SafeUser = Omit<User, 'password'>;

export function sanitizeUser(user: User): SafeUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _password, ...safeUser } = user;
  return safeUser;
}
