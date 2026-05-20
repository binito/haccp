import { User } from '@/types';

// Toda a sessão vive apenas em memória.
// - Access token (15m): variável de módulo, enviado no header Authorization
// - Refresh token (7d): HttpOnly cookie, gerido automaticamente pelo browser
// - Dados do utilizador: Zustand store
// Nada é guardado em localStorage — elimina a superfície de ataque XSS.

let _user: User | null = null;
let _accessToken: string | null = null;

export function getUser(): User | null {
  return _user;
}

export function setUser(user: User): void {
  _user = user;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function setAccessToken(token: string): void {
  _accessToken = token;
}

export function removeUser(): void {
  _user = null;
}

export function isLoggedIn(): boolean {
  return _user !== null;
}

export function clearAuth(): void {
  _user = null;
  _accessToken = null;
}
