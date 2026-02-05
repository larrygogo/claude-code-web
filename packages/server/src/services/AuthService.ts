import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import {
  User,
  UserCreateInput,
  UserLoginInput,
  AuthTokens,
  AuthResponse,
  UserSettings,
  defaultUserSettings,
  UserRole,
  UserStatus,
} from '@claude-web/shared';
import { getDatabase } from '../storage/Database.js';
import { fileStorage } from '../storage/FileStorage.js';
import { config } from '../config.js';
import { ConflictError, UnauthorizedError, NotFoundError, ForbiddenError } from '../middleware/error.js';

const SALT_ROUNDS = 10;
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export class AuthService {
  async register(input: UserCreateInput): Promise<AuthResponse> {
    const db = getDatabase();

    const existingUser = await db.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    const user = await db.user.create({
      data: {
        email: input.email,
        username: input.username,
        passwordHash,
      },
    });

    await fileStorage.ensureUserDirs(user.id);

    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  async login(input: UserLoginInput): Promise<AuthResponse> {
    const db = getDatabase();

    const user = await db.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // 检查用户状态
    if (user.status === 'disabled') {
      throw new ForbiddenError('Account is disabled');
    }

    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const db = getDatabase();

    const storedToken = await db.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (storedToken.expiresAt < new Date()) {
      await db.refreshToken.deleteMany({ where: { id: storedToken.id } });
      throw new UnauthorizedError('Refresh token expired');
    }

    const user = await db.user.findUnique({
      where: { id: storedToken.userId },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    await db.refreshToken.deleteMany({ where: { id: storedToken.id } });

    return this.generateTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const db = getDatabase();

    await db.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  async getCurrentUser(userId: string): Promise<User> {
    const db = getDatabase();

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    return this.sanitizeUser(user);
  }

  async updateSettings(userId: string, settings: Partial<UserSettings>): Promise<UserSettings> {
    const db = getDatabase();

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    const currentSettings = this.parseSettings(user.settings);
    const newSettings = { ...currentSettings, ...settings };

    await db.user.update({
      where: { id: userId },
      data: { settings: JSON.stringify(newSettings) },
    });

    return newSettings;
  }

  private async generateTokens(user: { id: string; email: string; role?: string }): Promise<AuthTokens> {
    const db = getDatabase();

    const payload = {
      userId: user.id,
      email: user.email,
      role: (user.role as UserRole) || 'user',
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.accessTokenExpiry as jwt.SignOptions['expiresIn'],
    });

    const refreshToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await db.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60,
    };
  }

  private parseSettings(settingsStr: string): UserSettings {
    try {
      return { ...defaultUserSettings, ...JSON.parse(settingsStr) };
    } catch {
      return defaultUserSettings;
    }
  }

  private sanitizeUser(user: {
    id: string;
    email: string;
    username: string;
    role?: string;
    status?: string;
    settings: string;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: (user.role as UserRole) || 'user',
      status: (user.status as UserStatus) || 'active',
      settings: this.parseSettings(user.settings),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

export const authService = new AuthService();
