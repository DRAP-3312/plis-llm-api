export interface AuthResponse {
  accessToken: string;
  playerId: string;
  username: string;
}

export interface AuthenticatedPlayer {
  playerId: string;
  username: string;
}
