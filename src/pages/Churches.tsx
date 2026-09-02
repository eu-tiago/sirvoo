import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChurchCard } from "@/components/churches/ChurchCard";
import { ChurchDialog } from "@/components/churches/ChurchDialog";
import { ChurchesStats } from "@/components/churches/ChurchesStats";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Plus, Search, Loader2, Church, ShieldAlert } from "lucide-react";
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

interface ChurchData {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  address: string | null;
  memberCount: number;
}

export default function Churches() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [churches, setChurches] = useState<ChurchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedChurch, setSelectedChurch] = useState<ChurchData | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [churchToDelete, setChurchToDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchChurches = async () => {
    if (!user) return;

    try {
      // Get churches the user is a member of
      const { data: memberData, error: memberError } = await supabase
        .from("church_members")
        .select("church_id")
        .eq("user_id", user.id);

      if (memberError) throw memberError;

      const churchIds = memberData?.map(m => m.church_id) || [];

      if (churchIds.length === 0) {
        setChurches([]);
        setLoading(false);
        return;
      }

      // Get churches with member counts
      const { data: churchData, error: churchError } = await supabase
        .from("churches")
        .select(`
          id,
          name,
          city,
          state,
          address
        `)
        .in("id", churchIds);

      if (churchError) throw churchError;

      // Get member counts for each church
      const churchesWithCounts = await Promise.all(
        (churchData || []).map(async (church) => {
          const { count } = await supabase
            .from("church_members")
            .select("*", { count: "exact", head: true })
            .eq("church_id", church.id);

          return {
            ...church,
            memberCount: count || 0,
          };
        })
      );

      setChurches(churchesWithCounts);
    } catch (error) {
      console.error("Error fetching churches:", error);
      toast.error("Erro ao carregar igrejas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChurches();
  }, [user]);

  const handleSave = async (data: Omit<ChurchData, 'id' | 'memberCount'>) => {
    if (!user) return;

    const payload = { ...data, name: data.name.trim() };

    setIsSaving(true);
    try {
      if (selectedChurch) {
        // Update existing church
        const { error } = await supabase
          .from("churches")
          .update(payload)
          .eq("id", selectedChurch.id);

        if (error) throw error;
        toast.success("Igreja atualizada com sucesso!");
      } else {
        // Create new church
        const { data: newChurch, error: churchError } = await supabase
          .from("churches")
          .insert({ ...payload, created_by: user.id })
          .select()
          .single();

        if (churchError) throw churchError;

        // Add creator as admin member
        const { error: memberError } = await supabase
          .from("church_members")
          .insert({
            church_id: newChurch.id,
            user_id: user.id,
            role: "admin",
          });

        if (memberError) throw memberError;
        toast.success("Igreja criada com sucesso!");
      }

      setDialogOpen(false);
      setSelectedChurch(null);
      fetchChurches();
    } catch (error) {
      console.error("Error saving church:", error);
      const code = (error as { code?: string })?.code;
      if (code === "23505") {
        toast.error("Já existe uma igreja cadastrada com esse nome. Cada igreja deve ter apenas um cadastro no sistema.");
      } else {
        toast.error("Erro ao salvar igreja");
      }
    } finally {
      setIsSaving(false);
    }
  };


  const handleEdit = (church: ChurchData) => {
    setSelectedChurch(church);
    setDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setChurchToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!churchToDelete) return;

    try {
      const { error } = await supabase
        .from("churches")
        .delete()
        .eq("id", churchToDelete);

      if (error) throw error;
      toast.success("Igreja excluída com sucesso!");
      fetchChurches();
    } catch (error) {
      console.error("Error deleting church:", error);
      toast.error("Erro ao excluir igreja");
    } finally {
      setDeleteDialogOpen(false);
      setChurchToDelete(null);
    }
  };

  const filteredChurches = churches.filter((church) =>
    church.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    church.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: churches.length,
    totalMembers: churches.reduce((acc, c) => acc + c.memberCount, 0),
    cities: new Set(churches.map(c => c.city).filter(Boolean)).size,
  };

  if (loading || roleLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
          <ShieldAlert className="w-16 h-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Apenas administradores podem gerenciar igrejas.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Header */}
      <header className="px-4 md:px-6 pt-6 md:pt-8 pb-4 md:pb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Igrejas</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie as igrejas da sua organização
            </p>
          </div>
          <Button onClick={() => {
            setSelectedChurch(null);
            setDialogOpen(true);
          }} size="sm" className="shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Nova Igreja</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </div>
      </header>

      <div className="px-4 md:px-6 space-y-4 pb-24 md:pb-6">
        {/* Stats */}
        <ChurchesStats stats={stats} />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou cidade..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 sirvo-input"
          />
        </div>

        {/* Churches Grid */}
        {filteredChurches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Church className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              {searchQuery ? "Nenhuma igreja encontrada" : "Nenhuma igreja cadastrada"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery 
                ? "Tente uma busca diferente" 
                : "Crie sua primeira igreja para começar"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredChurches.map((church) => (
              <ChurchCard
                key={church.id}
                church={church}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Church Dialog */}
      <ChurchDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        church={selectedChurch}
        onSave={handleSave}
        isLoading={isSaving}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Igreja</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta igreja? Esta ação não pode ser desfeita e todos os dados relacionados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
