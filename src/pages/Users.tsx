import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter, Loader2, ShieldAlert, Pencil, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { UserCard } from "@/components/users/UserCard";
import { InviteUserDialog } from "@/components/users/InviteUserDialog";
import { CreateUserDialog } from "@/components/users/CreateUserDialog";
import { EditUserDialog } from "@/components/users/EditUserDialog";
import { ManagePasswordDialog } from "@/components/users/ManagePasswordDialog";
import { SuperAdminUsersDialog } from "@/components/users/SuperAdminUsersDialog";
import { UsersStats } from "@/components/users/UsersStats";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useChurchId } from "@/hooks/useChurchId";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: "admin" | "ministry_leader" | "volunteer";
  avatarUrl?: string;
}

const Users = () => {
  const { user } = useAuth();
  const { isAdmin, isLeader, isSuperAdmin, loading: roleLoading } = useUserRole();
  const { churchId } = useChurchId();
  const { maxUsers } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [passwordUser, setPasswordUser] = useState<UserData | null>(null);

  useEffect(() => {
    if (churchId) {
      fetchUsers();
    }
  }, [churchId]);

  const fetchUsers = async () => {
    if (!churchId) return;

    try {
      setLoading(true);

      // Fetch church members with their profiles and roles
      const { data: members, error: membersError } = await supabase
        .from("church_members")
        .select("user_id, role")
        .eq("church_id", churchId);

      if (membersError) throw membersError;

      if (!members || members.length === 0) {
        setUsers([]);
        return;
      }

      const userIds = members.map((m) => m.user_id);

      // Fetch profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Create a map of user roles from church_members
      const memberRolesMap = new Map(members.map((m) => [m.user_id, m.role]));

      const usersData: UserData[] =
        profiles?.map((profile) => ({
          id: profile.id,
          name: profile.full_name || "Sem nome",
          email: profile.email || "",
          role: memberRolesMap.get(profile.id) || "volunteer",
          avatarUrl: profile.avatar_url || undefined,
        })) || [];

      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Erro ao carregar usuários",
        description: "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = async (
    userId: string,
    newRole: "admin" | "ministry_leader" | "volunteer"
  ) => {
    if (!churchId) return;

    try {
      const { error } = await supabase.rpc("set_member_role", {
        _user_id: userId,
        _church_id: churchId,
        _role: newRole,
      });

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );

      toast({
        title: "Permissão atualizada",
        description: "A função do usuário foi alterada com sucesso",
      });
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast({
        title: "Erro ao atualizar função",
        description: error?.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    }
  };

  const handleUpdateUser = async (
    userId: string,
    name: string,
    role: "admin" | "ministry_leader" | "volunteer"
  ) => {
    if (!churchId) return;

    // Update profile name
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: name })
      .eq("id", userId);

    if (profileError) throw profileError;

    // Update role through the secure RPC (keeps church_members + user_roles in sync)
    const { error: roleError } = await supabase.rpc("set_member_role", {
      _user_id: userId,
      _church_id: churchId,
      _role: role,
    });

    if (roleError) throw roleError;

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, name, role } : u))
    );

    toast({
      title: "Usuário atualizado",
      description: "As informações foram salvas com sucesso",
    });
  };

  const handleRemoveUser = async (userId: string) => {
    if (!churchId) return;

    try {
      // Remove from ministry_members first
      const { error: ministryError } = await supabase
        .from("ministry_members")
        .delete()
        .eq("user_id", userId);

      if (ministryError) console.error("Error removing from ministries:", ministryError);

      // Remove from schedule_assignments
      const { error: scheduleError } = await supabase
        .from("schedule_assignments")
        .delete()
        .eq("user_id", userId);

      if (scheduleError) console.error("Error removing from schedules:", scheduleError);

      // Remove from church_members
      const { error: memberError } = await supabase
        .from("church_members")
        .delete()
        .eq("user_id", userId)
        .eq("church_id", churchId);

      if (memberError) throw memberError;

      setUsers((prev) => prev.filter((u) => u.id !== userId));

      toast({
        title: "Usuário removido",
        description: "O usuário foi removido da igreja com sucesso",
      });
    } catch (error) {
      console.error("Error removing user:", error);
      throw error;
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterRole === "all" || u.role === filterRole;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: users.length,
    admins: users.filter((u) => u.role === "admin").length,
    leaders: users.filter((u) => u.role === "ministry_leader").length,
    volunteers: users.filter((u) => u.role === "volunteer").length,
  };

  if (roleLoading) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  const canManageUsers = isAdmin || isSuperAdmin || isLeader;

  if (!canManageUsers) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
              <ShieldAlert className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Acesso Restrito
            </h1>
            <p className="text-muted-foreground mb-6">
              Você não tem permissão para acessar esta página. Apenas
              administradores e líderes podem gerenciar usuários.
            </p>
            <Button onClick={() => navigate("/dashboard")}>
              Voltar ao Dashboard
            </Button>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="overflow-x-hidden">
          {/* Header */}
          <header className="px-4 md:px-6 pt-6 md:pt-12 pb-4 md:pb-6">
            <div className="flex flex-col gap-3 mb-4 md:mb-6">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground">Usuários</h1>
                <p className="text-sm text-muted-foreground">
                  Gerencie usuários e permissões
                </p>
              </div>
              <div className="flex gap-2">
                <CreateUserDialog
                  onSuccess={fetchUsers}
                  currentUserCount={users.length}
                  maxUsers={isSuperAdmin ? Infinity : maxUsers}
                />
                <InviteUserDialog
                  onInviteSuccess={fetchUsers}
                  currentUserCount={users.length}
                  isSuperAdmin={isSuperAdmin}
                />
                {isSuperAdmin && <SuperAdminUsersDialog onChanged={fetchUsers} />}
              </div>
            </div>

            {/* Stats */}
            <UsersStats {...stats} />
          </header>

          <div className="px-4 md:px-6 space-y-4 pb-24">
            {/* Search and Filters */}
            <div className="flex gap-2 md:gap-3">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuário..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 sirvo-input"
                />
              </div>
              <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                <Filter className="w-4 h-4" />
              </Button>
              <Button variant="outline" className="shrink-0 hidden md:flex">
                <Filter className="w-4 h-4 mr-2" />
                Filtrar
              </Button>
            </div>

            {/* Filter Pills */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {["all", "admin", "ministry_leader", "volunteer"].map((role) => (
                <button
                  key={role}
                  onClick={() => setFilterRole(role)}
                  className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                    filterRole === role
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {role === "all"
                    ? "Todos"
                    : role === "admin"
                    ? "Admins"
                    : role === "ministry_leader"
                    ? "Líderes"
                    : "Voluntários"}
                </button>
              ))}
            </div>

            {/* Users List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhum usuário encontrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((userData, index) => (
                  <div
                    key={userData.id}
                    className="animate-slide-up relative group"
                    style={{
                      animationDelay: `${index * 0.05}s`,
                      animationFillMode: "forwards",
                      opacity: 0,
                    }}
                  >
                    <UserCard
                      {...userData}
                      onChangeRole={handleChangeRole}
                      onRemove={handleRemoveUser}
                      onManagePassword={
                        isAdmin || isSuperAdmin ? () => setPasswordUser(userData) : undefined
                      }
                      canManage={
                        userData.id !== user?.id &&
                        (isAdmin || isSuperAdmin || (isLeader && userData.role !== "admin"))
                      }
                    />
                    {userData.id !== user?.id &&
                      (isAdmin || isSuperAdmin || (isLeader && userData.role !== "admin")) && (
                      <Button
                        size="icon"
                        variant="outline"
                        className="absolute right-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"
                        onClick={() => setEditingUser(userData)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Edit User Dialog */}
          {editingUser && (
            <EditUserDialog
              user={editingUser}
              open={!!editingUser}
              onOpenChange={(open) => !open && setEditingUser(null)}
              onUpdate={handleUpdateUser}
              onDelete={handleRemoveUser}
            />
          )}

          {passwordUser && (
            <ManagePasswordDialog
              user={passwordUser}
              open={!!passwordUser}
              onOpenChange={(open) => !open && setPasswordUser(null)}
            />
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
};

export default Users;
