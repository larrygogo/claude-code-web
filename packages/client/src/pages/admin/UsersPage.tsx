import React, { useEffect, useState } from 'react';
import { useAdminStore } from '@/stores/adminStore';
import { useAuthStore } from '@/stores/authStore';
import { useConfirm } from '@/contexts/ConfirmContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Search, ChevronLeft, ChevronRight, Key, Trash2 } from 'lucide-react';
import { UserRole, UserStatus } from '@claude-web/shared';

export default function AdminUsersPage() {
  const { user: currentUser } = useAuthStore();
  const {
    users,
    usersTotal,
    usersPage,
    usersTotalPages,
    usersLoading,
    usersSearch,
    fetchUsers,
    updateUserStatus,
    updateUserRole,
    resetPassword,
    deleteUser,
    setUsersSearch,
  } = useAdminStore();
  const confirm = useConfirm();

  const [searchInput, setSearchInput] = useState(usersSearch);
  const [resetPasswordDialog, setResetPasswordDialog] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setUsersSearch(searchInput);
    fetchUsers(1, searchInput);
  };

  const handleStatusChange = async (userId: string, status: UserStatus) => {
    try {
      await updateUserStatus(userId, status);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleRoleChange = async (userId: string, role: UserRole) => {
    try {
      await updateUserRole(userId, role);
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordDialog || !newPassword) return;

    setIsResetting(true);
    try {
      await resetPassword(resetPasswordDialog, newPassword);
      setResetPasswordDialog(null);
      setNewPassword('');
    } catch (error) {
      console.error('Failed to reset password:', error);
    } finally {
      setIsResetting(false);
    }
  };

  const handleDelete = async (userId: string, username: string) => {
    const confirmed = await confirm({
      title: `确定要删除用户 "${username}" 吗？`,
      description: '此操作不可撤销，用户的所有数据将被删除。',
      confirmText: '删除',
      variant: 'destructive',
    });

    if (confirmed) {
      try {
        await deleteUser(userId);
      } catch (error) {
        console.error('Failed to delete user:', error);
      }
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">用户管理</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>用户列表</CardTitle>
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="搜索用户..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-64"
              />
              <Button type="submit" variant="outline" size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          {usersLoading && users.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">用户名</th>
                      <th className="text-left py-3 px-4 font-medium">邮箱</th>
                      <th className="text-left py-3 px-4 font-medium">角色</th>
                      <th className="text-left py-3 px-4 font-medium">状态</th>
                      <th className="text-left py-3 px-4 font-medium">会话数</th>
                      <th className="text-left py-3 px-4 font-medium">注册时间</th>
                      <th className="text-left py-3 px-4 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">{user.username}</td>
                        <td className="py-3 px-4 text-muted-foreground">{user.email}</td>
                        <td className="py-3 px-4">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                            disabled={user.id === currentUser?.id}
                            className={cn(
                              'px-2 py-1 rounded border text-sm bg-background',
                              user.id === currentUser?.id && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            <option value="user">用户</option>
                            <option value="admin">管理员</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={user.status}
                            onChange={(e) => handleStatusChange(user.id, e.target.value as UserStatus)}
                            disabled={user.id === currentUser?.id}
                            className={cn(
                              'px-2 py-1 rounded border text-sm bg-background',
                              user.status === 'active' ? 'text-green-600' : 'text-red-600',
                              user.id === currentUser?.id && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            <option value="active">活跃</option>
                            <option value="disabled">禁用</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">{user.sessionCount ?? 0}</td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setResetPasswordDialog(user.id)}
                              title="重置密码"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(user.id, user.username)}
                              disabled={user.id === currentUser?.id}
                              title="删除用户"
                              className={cn(
                                'text-destructive hover:text-destructive',
                                user.id === currentUser?.id && 'opacity-50 cursor-not-allowed'
                              )}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  共 {usersTotal} 条记录
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => fetchUsers(usersPage - 1)}
                    disabled={usersPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    {usersPage} / {usersTotalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => fetchUsers(usersPage + 1)}
                    disabled={usersPage >= usersTotalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 重置密码对话框 */}
      <Dialog open={!!resetPasswordDialog} onOpenChange={() => setResetPasswordDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="password"
              placeholder="输入新密码（至少 6 位）"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordDialog(null)}>
              取消
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={newPassword.length < 6 || isResetting}
            >
              {isResetting ? '重置中...' : '重置密码'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
