export interface AuthSuccessPayload {
  id: string;
  fullName?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  isGuest?: boolean;
  kills?: number;
  rank?: number | null;
}

export interface SessionUser {
  id: string;
  fullName: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  isGuest?: boolean;
}

export interface StoredPlayerProfile {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  kills?: number;
  rank?: number | null;
}

export interface StoredGuestProfile {
  id: string;
  email?: string;
  fullName?: string;
  kills?: number;
  rank?: number | null;
}
