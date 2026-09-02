import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Users, 
  Plus, 
  X, 
  Crown, 
  UserMinus, 
  Tag,
  Trash2,
  Edit,
  Search
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Member {
  id: string;
  userId: string;
  name: string;
  email?: string;
  isLeader: boolean;
}

interface Role {
  id: string;
  name: string;
  description?: string;
}

interface ChurchMember {
  id: string;
  userId: string;
  name: string;
  email?: string;
}

interface MinistryDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ministry: {
    id: string;
    name: string;
    color: string;
    members?: Member[];
    roles?: Role[];
  } | null;
  churchId: string;
  onAddMember: (ministryId: string, userId: string, isLeader?: boolean) => void;
  onRemoveMember: (memberId: string) => void;
  onUpdateMemberLeader: (memberId: string, isLeader: boolean) => void;
  onAddRole: (ministryId: string, name: string, description?: string) => void;
  onDeleteRole: (roleId: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  isAdmin: boolean;
}

export function MinistryDetailDialog({
  open,
  onOpenChange,
  ministry,
  churchId,
  onAddMember,
  onRemoveMember,
  onUpdateMemberLeader,
  onAddRole,
  onDeleteRole,
  onEdit,
  onDelete,
  isAdmin,
}: MinistryDetailDialogProps) {
  const [churchMembers, setChurchMembers] = useState<ChurchMember[]>([]);
  const [searchMember, setSearchMember] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [showAddMember, setShowAddMember] = useState(true); // Show by default for easy access

  useEffect(() => {
    if (open && churchId && isAdmin) {
      fetchChurchMembers();
    }
  }, [open, churchId, isAdmin]);

  const fetchChurchMembers = async () => {
    // Step 1: Get church member user_ids
    const { data: members, error: membersError } = await supabase
      .from("church_members")
      .select("id, user_id")
      .eq("church_id", churchId);

    if (membersError) {
      console.error("Erro ao buscar membros da igreja:", membersError);
      return;
    }

    if (!members || members.length === 0) {
      setChurchMembers([]);
      return;
    }

    // Step 2: Get profiles for those user_ids
    const userIds = members.map((m) => m.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    if (profilesError) {
      console.error("Erro ao buscar perfis:", profilesError);
      return;
    }

    const profilesMap = new Map(
      (profiles || []).map((p) => [p.id, p])
    );

    setChurchMembers(
      members.map((m) => {
        const profile = profilesMap.get(m.user_id);
        return {
          id: m.id,
          userId: m.user_id,
          name: profile?.full_name || "Sem nome",
          email: profile?.email || undefined,
        };
      })
    );
  };

  if (!ministry) return null;

  const existingMemberIds = ministry.members?.map((m) => m.userId) || [];
  const availableMembers = churchMembers.filter(
    (m) =>
      !existingMemberIds.includes(m.userId) &&
      (m.name.toLowerCase().includes(searchMember.toLowerCase()) ||
        m.email?.toLowerCase().includes(searchMember.toLowerCase()))
  );

  const handleAddRole = async () => {
    const trimmedName = newRoleName.trim();
    if (!trimmedName) {
      // Focus the input if empty
      const input = document.querySelector('input[placeholder*="Nova função"]') as HTMLInputElement;
      input?.focus();
      return;
    }
    console.log("Adding role:", trimmedName, "to ministry:", ministry.id);
    await onAddRole(ministry.id, trimmedName);
    setNewRoleName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${ministry.color}20` }}
            >
              <Users className="w-5 h-5" style={{ color: ministry.color }} />
            </div>
            <div className="flex-1">
              <DialogTitle>{ministry.name}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {ministry.members?.length || 0} membros
              </p>
            </div>
            {isAdmin && (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={onEdit}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <Tabs defaultValue="members" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="members">
              <Users className="w-4 h-4 mr-2" />
              Membros
            </TabsTrigger>
            <TabsTrigger value="roles">
              <Tag className="w-4 h-4 mr-2" />
              Funções
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-4">
            {isAdmin && (
              <div className="mb-4 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchMember}
                    onChange={(e) => setSearchMember(e.target.value)}
                    placeholder="Buscar membro para adicionar..."
                    className="pl-9"
                  />
                </div>
                {(searchMember || true) && (
                  <ScrollArea className="h-40 border rounded-lg">
                    <div className="p-2 space-y-1">
                      {availableMembers.length > 0 ? (
                        availableMembers.map((member) => (
                          <button
                            key={member.userId}
                            onClick={() => {
                              onAddMember(ministry.id, member.userId);
                              setSearchMember("");
                            }}
                            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted text-left"
                          >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-primary-foreground">
                              {member.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {member.name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {member.email}
                              </p>
                            </div>
                            <Plus className="w-4 h-4 text-muted-foreground" />
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {churchMembers.length === 0
                            ? "Cadastre usuários primeiro na página Usuários"
                            : searchMember
                            ? "Nenhum membro encontrado"
                            : "Todos os membros já estão neste ministério"}
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}

            <ScrollArea className="h-64">
              <div className="space-y-2">
                {ministry.members?.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-sm font-bold text-primary-foreground">
                      {member.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">
                          {member.name}
                        </p>
                        {member.isLeader && (
                          <Badge
                            className="text-xs"
                            style={{
                              backgroundColor: `${ministry.color}20`,
                              color: ministry.color,
                            }}
                          >
                            <Crown className="w-3 h-3 mr-1" />
                            Líder
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.email}
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            onUpdateMemberLeader(member.id, !member.isLeader)
                          }
                          title={member.isLeader ? "Remover líder" : "Promover a líder"}
                        >
                          <Crown
                            className={cn(
                              "w-4 h-4",
                              member.isLeader
                                ? "text-amber-500"
                                : "text-muted-foreground"
                            )}
                          />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => onRemoveMember(member.id)}
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {(!ministry.members || ministry.members.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum membro neste ministério
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="roles" className="mt-4">
            {isAdmin && (
              <div className="flex gap-2 mb-4">
                <Input
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="Nova função (ex: Vocal, Guitarrista)"
                  onKeyDown={(e) => e.key === "Enter" && handleAddRole()}
                />
                <Button onClick={handleAddRole} size="icon">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}

            <ScrollArea className="h-64">
              <div className="space-y-2">
                {ministry.roles?.map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Tag className="w-4 h-4" style={{ color: ministry.color }} />
                      <span className="font-medium text-sm">{role.name}</span>
                    </div>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => onDeleteRole(role.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {(!ministry.roles || ministry.roles.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma função definida
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
