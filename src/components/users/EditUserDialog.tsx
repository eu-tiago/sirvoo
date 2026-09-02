import { useState, useEffect } from "react";
import { Pencil, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useToast } from "@/hooks/use-toast";
import { useChurchId } from "@/hooks/useChurchId";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const editUserSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  role: z.enum(["admin", "ministry_leader", "volunteer"]),
});

interface EditUserDialogProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "ministry_leader" | "volunteer";
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (userId: string, name: string, role: "admin" | "ministry_leader" | "volunteer") => Promise<void>;
  onDelete: (userId: string) => Promise<void>;
}

export function EditUserDialog({ user, open, onOpenChange, onUpdate, onDelete }: EditUserDialogProps) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<"admin" | "ministry_leader" | "volunteer">(user.role);

  const { churchId } = useChurchId();
  const [ministries, setMinistries] = useState<{ id: string; name: string }[]>([]);
  const [selectedMinistries, setSelectedMinistries] = useState<string[]>([]);
  const [initialMinistries, setInitialMinistries] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setName(user.name);
    setRole(user.role);
  }, [user]);

  useEffect(() => {
    if (open && churchId && user.id) {
      fetchMinistriesData();
    } else if (!open) {
      setSelectedMinistries([]);
      setInitialMinistries([]);
    }
  }, [open, churchId, user.id]);

  const fetchMinistriesData = async () => {
    if (!churchId) return;

    const { data: minData } = await supabase
      .from("ministries")
      .select("id, name")
      .eq("church_id", churchId)
      .order("name");

    if (minData) setMinistries(minData);

    const { data: userMinData } = await supabase.from("ministry_members").select("ministry_id").eq("user_id", user.id);

    if (userMinData) {
      const currentMins = userMinData.map((m) => m.ministry_id);
      setSelectedMinistries(currentMins);
      setInitialMinistries(currentMins);
    }
  };

  const toggleMinistry = (ministryId: string) => {
    setSelectedMinistries((prev) =>
      prev.includes(ministryId) ? prev.filter((id) => id !== ministryId) : [...prev, ministryId],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = editUserSchema.safeParse({ name, role });
    if (!result.success) {
      toast({
        title: "Erro de validação",
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await onUpdate(user.id, name, role);

      const toInsert = selectedMinistries.filter((id) => !initialMinistries.includes(id));
      const toDelete = initialMinistries.filter((id) => !selectedMinistries.includes(id));

      if (toDelete.length > 0) {
        await supabase.from("ministry_members").delete().eq("user_id", user.id).in("ministry_id", toDelete);
      }

      if (toInsert.length > 0) {
        const inserts = toInsert.map((ministryId) => ({
          ministry_id: ministryId,
          user_id: user.id,
          is_leader: role === "ministry_leader",
        }));
        await supabase.from("ministry_members").insert(inserts);
      }

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar usuário",
        description: error?.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onDelete(user.id);
      setShowDeleteConfirm(false);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erro ao remover usuário",
        description: "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Estrutura Responsiva Flexível */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md w-[95vw] flex flex-col gap-0 max-h-[90dvh] p-0 overflow-hidden">
          {/* Cabeçalho Fixo */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>Atualize as informações do usuário {user.email}</DialogDescription>
          </DialogHeader>

          {/* Corpo Rolável */}
          <form id="edit-user-form" onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="sirvo-input"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={user.email} className="sirvo-input bg-muted" disabled />
                <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Função</Label>
                <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                  <SelectTrigger className="sirvo-input">
                    <SelectValue placeholder="Selecione a função" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="volunteer">Voluntário</SelectItem>
                    <SelectItem value="ministry_leader">Líder de Ministério</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 pt-2 border-t mt-4">
                <Label>Vínculos de Ministérios</Label>
                {/* Removido o max-h e overflow daqui */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 border rounded-md bg-muted/20">
                  {ministries.map((ministry) => (
                    <div key={ministry.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-ministry-${ministry.id}`}
                        checked={selectedMinistries.includes(ministry.id)}
                        onCheckedChange={() => toggleMinistry(ministry.id)}
                      />
                      <Label
                        htmlFor={`edit-ministry-${ministry.id}`}
                        className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {ministry.name}
                      </Label>
                    </div>
                  ))}
                  {ministries.length === 0 && (
                    <p className="text-sm text-muted-foreground col-span-2">Nenhum ministério encontrado.</p>
                  )}
                </div>
              </div>
            </div>
          </form>

          {/* Rodapé Fixo */}
          <div className="px-6 py-4 border-t shrink-0 flex flex-col-reverse sm:flex-row justify-between gap-3 bg-muted/10">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remover
            </Button>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 sm:flex-none"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="edit-user-form"
                disabled={loading}
                className="sirvo-btn-primary flex-1 sm:flex-none"
              >
                {loading ? (
                  "Salvando..."
                ) : (
                  <>
                    <Pencil className="w-4 h-4 mr-2" />
                    Salvar
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Exclusão (Mantido intocado) */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Confirmar Remoção
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{user.name}</strong> da igreja? Esta ação removerá o usuário de
              todos os ministérios e escalas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Removendo..." : "Sim, remover usuário"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
