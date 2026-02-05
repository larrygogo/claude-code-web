import { create } from 'zustand';
import {
  DashboardStats,
  UserListItem,
  UserListResponse,
  UserRole,
  UserStatus,
  ModelConfigListItem,
  ModelConfigInput,
  ModelConfigUpdateInput,
} from '@claude-web/shared';
import {
  getAdminDashboard,
  getAdminUsers,
  updateUserStatus as apiUpdateUserStatus,
  updateUserRole as apiUpdateUserRole,
  resetUserPassword as apiResetPassword,
  deleteAdminUser,
  getAdminModels,
  createAdminModel,
  updateAdminModel,
  deleteAdminModel,
} from '@/lib/api';

interface AdminState {
  // Dashboard
  stats: DashboardStats | null;
  statsLoading: boolean;

  // Users
  users: UserListItem[];
  usersTotal: number;
  usersPage: number;
  usersLimit: number;
  usersTotalPages: number;
  usersLoading: boolean;
  usersSearch: string;

  // Models
  models: ModelConfigListItem[];
  modelsLoading: boolean;

  // Actions
  fetchDashboard: () => Promise<void>;
  fetchUsers: (page?: number, search?: string) => Promise<void>;
  updateUserStatus: (userId: string, status: UserStatus) => Promise<void>;
  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
  resetPassword: (userId: string, newPassword: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  fetchModels: () => Promise<void>;
  createModel: (input: ModelConfigInput) => Promise<ModelConfigListItem>;
  updateModel: (id: string, input: ModelConfigUpdateInput) => Promise<void>;
  deleteModel: (id: string) => Promise<void>;
  setUsersSearch: (search: string) => void;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  // Dashboard
  stats: null,
  statsLoading: false,

  // Users
  users: [],
  usersTotal: 0,
  usersPage: 1,
  usersLimit: 20,
  usersTotalPages: 0,
  usersLoading: false,
  usersSearch: '',

  // Models
  models: [],
  modelsLoading: false,

  // Actions
  fetchDashboard: async () => {
    set({ statsLoading: true });
    try {
      const stats = await getAdminDashboard();
      set({ stats });
    } finally {
      set({ statsLoading: false });
    }
  },

  fetchUsers: async (page?: number, search?: string) => {
    const state = get();
    const targetPage = page ?? state.usersPage;
    const targetSearch = search !== undefined ? search : state.usersSearch;

    set({ usersLoading: true });
    try {
      const response = await getAdminUsers(targetPage, state.usersLimit, targetSearch || undefined);
      set({
        users: response.users,
        usersTotal: response.total,
        usersPage: response.page,
        usersTotalPages: response.totalPages,
        usersSearch: targetSearch,
      });
    } finally {
      set({ usersLoading: false });
    }
  },

  updateUserStatus: async (userId: string, status: UserStatus) => {
    const updatedUser = await apiUpdateUserStatus(userId, status);
    set((state) => ({
      users: state.users.map((u) => (u.id === userId ? updatedUser : u)),
    }));
  },

  updateUserRole: async (userId: string, role: UserRole) => {
    const updatedUser = await apiUpdateUserRole(userId, role);
    set((state) => ({
      users: state.users.map((u) => (u.id === userId ? updatedUser : u)),
    }));
  },

  resetPassword: async (userId: string, newPassword: string) => {
    await apiResetPassword(userId, newPassword);
  },

  deleteUser: async (userId: string) => {
    await deleteAdminUser(userId);
    set((state) => ({
      users: state.users.filter((u) => u.id !== userId),
      usersTotal: state.usersTotal - 1,
    }));
  },

  fetchModels: async () => {
    set({ modelsLoading: true });
    try {
      const models = await getAdminModels();
      set({ models });
    } finally {
      set({ modelsLoading: false });
    }
  },

  createModel: async (input: ModelConfigInput) => {
    const model = await createAdminModel(input);
    set((state) => ({
      models: [...state.models, model],
    }));
    return model;
  },

  updateModel: async (id: string, input: ModelConfigUpdateInput) => {
    const updatedModel = await updateAdminModel(id, input);
    set((state) => ({
      models: state.models.map((m) => (m.id === id ? updatedModel : m)),
    }));
  },

  deleteModel: async (id: string) => {
    await deleteAdminModel(id);
    set((state) => ({
      models: state.models.filter((m) => m.id !== id),
    }));
  },

  setUsersSearch: (search: string) => {
    set({ usersSearch: search });
  },
}));
