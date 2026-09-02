import { useState, useEffect, useCallback } from "react";
import { Globe, Loader2, Trash2, Link2, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { supabase } from "@/integrations/supabase/client";

interface SystemUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  churches: { churchId: string; churchName: string; role: string }[];
}

interface ChurchOption {
  id: string;
  name: string;
}

interface Props {
  onChanged?: () => void;
}

export function SuperAdminUsersDialog({ onChanged }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [churches, setChurches] = useState<ChurchOption[]>([]);
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SystemUser | null>(null);

  const call = useCallback(async (body: Record<string, unknown>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("admin-manage-users", {
      body,
      headers: sessionData.session
        ? { Authorization: `Bearer ${sessionData.session.access_token}` }
        : undefined,
    });
    if (error) {
      let msg = error.message;
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.text === "function") {
        try {
          const parsed = JSON.parse(await ctx.text());
          if (parsed?.error) msg = parsed.error;
        } catch {
          /* ignore */
        }
      }
      throw new Error(msg);
    }
    const result = data as { error?: string } | null;
    if (result?.error) throw new Error(result.error);
    return data;
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = (await call({ action: "list" })) as {
        users: SystemUser[];
        churches: ChurchOption[];
      };
      setUsers(data.users || []);
      setChurches(data.churches || []);
    } catch (error) {
      toast({
        title: "Erro ao carregar usuários",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [call, toast]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleLink = async (user: SystemUser) => {
    const churchId = selection[user.id];
    if (!churchId) {
      toast({ title: "Selecione uma igreja", variant: "destructive" });
      return;
    }
    try {
      setBusyId(user.id);
      await call({ action: "link_church", targetUserId: user.id, churchId, role: "volunteer" });
      toast({ title: "Usuário vinculado", description: "Vínculo criado com sucesso" });
      await load();
      onChanged?.();
    } catch (error) {
      toast({
        title: "Erro ao vincular",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleUnlink = async (userId: string, churchId: string) => {
    try {
      setBusyId(userId);
      await call({ action: "unlink_church", targetUserId: userId, churchId });
      await load();
      onChanged?.();
    } catch (error) {
      toast({
        title: "Erro ao desvincular",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setBusyId(deleteTarget.id);
      await call({ action: "delete_user", targetUserId: deleteTarget.id });
      toast({ title: "Usuário excluído", description: "Removido do sistema com sucesso" });
      setDeleteTarget(null);
      await load();
      onChanged?.();
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="shrink-0">
            <Globe className="w-4 h-4 mr-2" />
            Todos os usuários
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Usuários do sistema</DialogTitle>
            <DialogDescription>
              Visão global do super administrador: vincule usuários a qualquer igreja ou exclua
              cadastros do sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              Nenhum usuário encontrado
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((u) => (
                <div key={u.id} className="rounded-xl border border-border p-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{u.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive shrink-0"
                      disabled={busyId === u.id}
                      onClick={() => setDeleteTarget(u)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {u.churches.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Sem igreja vinculada</span>
                    ) : (
                      u.churches.map((c) => (
                        <Badge
                          key={c.churchId}
                          variant="outline"
                          className="flex items-center gap-1"
                        >
                          {c.churchName}
                          <button
                            type="button"
                            onClick={() => handleUnlink(u.id, c.churchId)}
                            disabled={busyId === u.id}
                            aria-label={`Desvincular de ${c.churchName}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Select
                      value={selection[u.id] ?? ""}
                      onValueChange={(v) => setSelection((prev) => ({ ...prev, [u.id]: v }))}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Vincular a uma igreja" />
                      </SelectTrigger>
                      <SelectContent>
                        {churches.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="secondary"
                      disabled={busyId === u.id}
                      onClick={() => handleLink(u)}
                    >
                      {busyId === u.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Link2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário do sistema?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} ({deleteTarget?.email}) será removido permanentemente, junto com
              vínculos, escalas e notificações. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
