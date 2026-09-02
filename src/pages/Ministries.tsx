import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MinistryCard } from "@/components/ministries/MinistryCard";
import { MinistryDialog } from "@/components/ministries/MinistryDialog";
import { MinistryDetailDialog } from "@/components/ministries/MinistryDetailDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search } from "lucide-react";
import { Music, Tv, Speaker, Lightbulb, UserCheck, Baby, Heart, Shield, Users, Mic } from "lucide-react";
import { useMinistries } from "@/hooks/useMinistries";
import { useChurchId } from "@/hooks/useChurchId";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ICON_MAP: Record<string, React.ElementType> = {
  music: Music,
  tv: Tv,
  speaker: Speaker,
  lightbulb: Lightbulb,
  "user-check": UserCheck,
  baby: Baby,
  heart: Heart,
  shield: Shield,
  users: Users,
  mic: Mic,
};

const Ministries = () => {
  const isMobile = useIsMobile();
  const { churchId, loading: churchLoading } = useChurchId();
  const { role } = useUserRole();
  const isAdmin = role === "admin" || role === "ministry_leader";

  const {
    ministries = [],
    loading,
    createMinistry,
    updateMinistry,
    deleteMinistry,
    addMember,
    removeMember,
    updateMemberLeader,
    addRole,
    deleteRole,
  } = useMinistries(churchId);

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedMinistry, setSelectedMinistry] = useState<any>(null);

  // 🔧 Mantém o ministério atualizado após mudanças
  useEffect(() => {
    if (!selectedMinistry || ministries.length === 0) return;

    const updated = ministries.find((m) => m.id === selectedMinistry.id);
    if (updated) setSelectedMinistry(updated);
  }, [ministries, selectedMinistry]);

  const filteredMinistries = ministries.filter((m) => {
    const name = m.name?.toLowerCase() || "";
    const desc = m.description?.toLowerCase() || "";
    const term = search.toLowerCase();

    return name.includes(term) || desc.includes(term);
  });

  const handleCardClick = (ministry: any) => {
    setSelectedMinistry(ministry);
    setShowDetail(true);
  };

  const handleEdit = () => {
    setShowDetail(false);
    setShowEdit(true);
  };

  const handleDelete = () => {
    setShowDetail(false);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (selectedMinistry) {
      await deleteMinistry(selectedMinistry.id);
      setSelectedMinistry(null);
      setShowDeleteConfirm(false);
    }
  };

  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-28 rounded-2xl" />
      ))}
    </div>
  );

  return (
    <ProtectedRoute>
      <AppLayout>
        <header className="px-4 md:px-6 pt-6 md:pt-8 pb-4 md:pb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Ministérios</h1>
            {isAdmin && (
              <Button onClick={() => setShowCreate(true)} size={isMobile ? "icon" : "default"}>
                <Plus className="w-5 h-5" />
                {!isMobile && <span className="ml-2">Novo Ministério</span>}
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Gerencie e explore os ministérios da igreja</p>
        </header>

        {/* Search */}
        <div className="px-4 md:px-6 mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar ministério..."
              className="w-full sirvo-input pl-12"
            />
          </div>
        </div>

        {/* Ministry List */}
        <div className="px-4 md:px-6 pb-24 md:pb-6">
          {loading || churchLoading || !churchId ? (
            <LoadingSkeleton />
          ) : (
            <div className="space-y-4">
              {filteredMinistries.map((ministry, index) => (
                <div
                  key={ministry.id}
                  className="animate-slide-up opacity-0"
                  style={{
                    animationDelay: `${index * 0.05}s`,
                    animationFillMode: "forwards",
                  }}
                  onClick={() => handleCardClick(ministry)}
                >
                  <MinistryCard
                    id={ministry.id}
                    name={ministry.name}
                    description={ministry.description || ""}
                    memberCount={ministry.memberCount}
                    color={ministry.color}
                    icon={ICON_MAP[ministry.icon] || Music}
                  />
                </div>
              ))}

              {filteredMinistries.length === 0 && !loading && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Nenhum ministério encontrado</p>
                  {isAdmin && (
                    <Button onClick={() => setShowCreate(true)} className="mt-4">
                      <Plus className="w-4 h-4 mr-2" />
                      Criar primeiro ministério
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Create Dialog */}
        <MinistryDialog open={showCreate} onOpenChange={setShowCreate} onSubmit={createMinistry} mode="create" />

        {/* Edit Dialog */}
        {selectedMinistry && (
          <MinistryDialog
            open={showEdit}
            onOpenChange={setShowEdit}
            onSubmit={async (data) => {
              await updateMinistry(selectedMinistry.id, data);
              setShowEdit(false);
            }}
            initialData={{
              name: selectedMinistry.name,
              description: selectedMinistry.description,
              color: selectedMinistry.color,
              icon: selectedMinistry.icon,
            }}
            mode="edit"
          />
        )}

        {/* Detail Dialog */}
        {churchId && selectedMinistry && (
          <MinistryDetailDialog
            open={showDetail}
            onOpenChange={setShowDetail}
            ministry={selectedMinistry}
            churchId={churchId}
            onAddMember={addMember}
            onRemoveMember={removeMember}
            onUpdateMemberLeader={updateMemberLeader}
            onAddRole={addRole}
            onDeleteRole={deleteRole}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isAdmin={isAdmin}
          />
        )}

        {/* Delete Confirmation */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Ministério</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o ministério "{selectedMinistry?.name}"? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AppLayout>
    </ProtectedRoute>
  );
};

export default Ministries;
