export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'disabled';

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
}

export const defaultUserSettings: UserSettings = {
  theme: 'system',
};

export interface User {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  settings: UserSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCreateInput {
  email: string;
  username: string;
  password: string;
}

export interface UserLoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// Admin 相关类型
export interface UserListItem {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  sessionCount?: number;
}

export interface UserListResponse {
  users: UserListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UpdateUserStatusInput {
  status: UserStatus;
}

export interface UpdateUserRoleInput {
  role: UserRole;
}

export interface ResetPasswordInput {
  newPassword: string;
}
