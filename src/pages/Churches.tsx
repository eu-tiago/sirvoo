import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { ChurchCard } from "@/components/churches/ChurchCard";
import { ChurchDialog } from "@/components/churches/ChurchDialog";
import { ChurchesStats } from "@/components/churches/ChurchesStats";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Church = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  address: string | null;
  memberCount: number;
};

export function Churches() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [editingChurch, setEditingChurch] = useState<Church | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchChurches = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("churches")
      .select("id, name, city, state, address")
      .order("name");

    if (error) {
      toast({ title: "Erro ao carregar igrejas", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const churchesWithMembers = await Promise.all(
      (data || []).map(async (church) => {
        const { count } = await supabase
          .from("church_members")
          .select("user_id", { count: "exact", head: true })
          .eq("church_id", church.id);
        return { ...church, memberCount: count || 0 };
      }),
    );
    setChurches(churchesWithMembers);
    setLoading(false);
  };

  useEffect(() => {
    fetchChurches();
  }, []);

  const saveChurch = async (values: Omit<Church, "id" | "memberCount">) => {
    setSaving(true);
    const query = editingChurch
      ? supabase.from("churches").update(values).eq("id", editingChurch.id)
      : supabase.from("churches").insert(values);
    const { error } = await query;

    if (error) {
      toast({ title: "Erro ao salvar igreja", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editingChurch ? "Igreja atualizada" : "Igreja criada" });
      setDialogOpen(false);
      setEditingChurch(null);
      await fetchChurches();
    }
    setSaving(false);
  };

  const deleteChurch = async (id: string) => {
    const { error } = await supabase.from("churches").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir igreja", description: error.message, variant: "destructive" });
      return;
    }
    setChurches((current) => current.filter((church) => church.id !== id));
    toast({ title: "Igreja excluída" });
  };

  const totalMembers = churches.reduce((total, church) => total + church.memberCount, 0);
  const cities = new Set(churches.map((church) => church.city).filter(Boolean)).size;

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Igrejas</h1>
              <p className="text-muted-foreground">Gerencie as igrejas cadastradas.</p>
            </div>
            <Button onClick={() => { setEditingChurch(null); setDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Nova igreja
            </Button>
          </div>
          <ChurchesStats stats={{ total: churches.length, totalMembers, cities }} />
          {loading ? (
            <p className="text-muted-foreground">Carregando igrejas...</p>
          ) : churches.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma igreja cadastrada.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {churches.map((church) => (
                <ChurchCard
                  key={church.id}
                  church={church}
                  onEdit={(selected) => { setEditingChurch(selected); setDialogOpen(true); }}
                  onDelete={deleteChurch}
                />
              ))}
            </div>
          )}
        </div>
        <ChurchDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          church={editingChurch}
          onSave={saveChurch}
          isLoading={saving}
        />
      </AppLayout>
    </ProtectedRoute>
  );
}
