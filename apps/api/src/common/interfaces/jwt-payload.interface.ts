export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  /** Refresh-token / session row id */
  sid: string;
}
