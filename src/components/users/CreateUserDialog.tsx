import { useState, useEffect } from "react";
import { UserPlus, Copy, Check, AlertCircle, CreditCard, Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useChurchId } from "@/hooks/useChurchId";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email("Email inválido").max(255),
  fullName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  role: z.enum(["admin", "ministry_leader", "volunteer"]),
});

interface CreateUserDialogProps {
  onSuccess: () => void;
  currentUserCount: number;
  maxUsers?: number;
}

export function CreateUserDialog({ onSuccess, currentUserCount, maxUsers = 3 }: CreateUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "ministry_leader" | "volunteer">("volunteer");

  const [ministries, setMinistries] = useState<{ id: string; name: string }[]>([]);
  const [selectedMinistries, setSelectedMinistries] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [planName, setPlanName] = useState("Gratuito");
  const { toast } = useToast();
  const { user } = useAuth();
  const { churchId } = useChurchId();
  const { createCheckout, subscription } = useSubscription();

  const canAddMore = currentUserCount < maxUsers;
  const remainingSlots = maxUsers - currentUserCount;

  const getNextPlan = () => {
    if (maxUsers <= 3) return { plan: "basic" as const, name: "Básico", users: 10, price: "R$29,90" };
    if (maxUsers <= 10) return { plan: "standard" as const, name: "Standard", users: 30, price: "R$59,90" };
    return null;
  };

  const nextPlan = getNextPlan();

  useEffect(() => {
    if (open && churchId) {
      fetchPlanName();
      fetchMinistries();
    }
  }, [open, churchId]);

  const fetchPlanName = async () => {
    if (!churchId) return;
    const { data } = await supabase.from("church_subscriptions").select("plan").eq("church_id", churchId).maybeSingle();

    if (data) {
      const names = { free: "Gratuito", basic: "Básico", standard: "Standard" };
      setPlanName(names[data.plan as keyof typeof names] || "Gratuito");
    }
  };

  const fetchMinistries = async () => {
    if (!churchId) return;
    const { data, error } = await supabase
      .from("ministries")
      .select("id, name")
      .eq("church_id", churchId)
      .order("name");

    if (data && !error) {
      setMinistries(data);
    }
  };

  const handleUpgrade = async () => {
    if (!churchId || !nextPlan) return;
    setUpgradeLoading(true);
    try {
      await createCheckout(nextPlan.plan, churchId);
    } catch (error) {
      console.error("Upgrade error:", error);
    } finally {
      setUpgradeLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = createUserSchema.safeParse({ email, fullName, role });
    if (!result.success) {
      toast({
        title: "Erro de validação",
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    if (!churchId) {
      toast({
        title: "Erro",
        description: "Igreja não identificada",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email,
          fullName,
          role,
          churchId,
          ministryIds: selectedMinistries,
        },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Erro ao criar usuário",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      if (data.tempPassword) {
        setTempPassword(data.tempPassword);
        toast({
          title: "Usuário criado com sucesso",
          description: "Copie a senha temporária e envie ao usuário",
        });
      } else {
        toast({
          title: "Usuário adicionado",
          description: data.message,
        });
        resetForm();
        setOpen(false);
      }

      onSuccess();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        title: "Erro ao criar usuário",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setFullName("");
    setRole("volunteer");
    setSelectedMinistries([]);
    setTempPassword(null);
    setCopied(false);
  };

  const handleCopyPassword = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    resetForm();
    setOpen(false);
  };

  const toggleMinistry = (ministryId: string) => {
    setSelectedMinistries((prev) =>
      prev.includes(ministryId) ? prev.filter((id) => id !== ministryId) : [...prev, ministryId],
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
        else setOpen(true);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="text-xs sm:text-sm px-3 sm:px-4">
          <UserPlus className="w-4 h-4 mr-1 sm:mr-2 shrink-0" />
          <span className="truncate">Cadastrar</span>
        </Button>
      </DialogTrigger>

      {/* Estrutura Responsiva Flexível */}
      <DialogContent className="sm:max-w-md w-[95vw] flex flex-col gap-0 max-h-[90dvh] p-0 overflow-hidden">
        {/* Cabeçalho Fixo */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
          <DialogDescription>
            Crie uma conta para um novo membro diretamente. Ele receberá uma senha temporária para acessar o sistema.
          </DialogDescription>
        </DialogHeader>

        {/* Corpo Rolável */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-4">
          {!canAddMore && nextPlan && (
            <Alert className="border-primary/30 bg-primary/5 shrink-0">
              <CreditCard className="h-4 w-4 text-primary" />
              <AlertDescription className="flex flex-col gap-3">
                <span>
                  Limite de <strong>{maxUsers} usuários</strong> atingido no plano {planName}.
                </span>
                <Button onClick={handleUpgrade} disabled={upgradeLoading} className="sirvo-btn-primary w-full">
                  {upgradeLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Redirecionando...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Upgrade para {nextPlan.name}
                    </>
                  )}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {!canAddMore && !nextPlan && (
            <Alert variant="default" className="shrink-0">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Você já está no plano máximo. Entre em contato para mais usuários.</AlertDescription>
            </Alert>
          )}

          {canAddMore && remainingSlots <= 2 && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400 shrink-0">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Restam apenas {remainingSlots} vaga(s) no plano {planName}.
              </AlertDescription>
            </Alert>
          )}

          {tempPassword ? (
            <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg shrink-0">
              <p className="text-sm text-green-800 dark:text-green-200 mb-2">
                Usuário criado com sucesso! Compartilhe a senha temporária com o usuário:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-background rounded border text-sm font-mono">{tempPassword}</code>
                <Button size="icon" variant="outline" onClick={handleCopyPassword}>
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">O usuário deverá trocar a senha no primeiro acesso.</p>
            </div>
          ) : (
            <form id="create-user-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="João da Silva"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="sirvo-input"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="sirvo-input"
                  required
                />
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

              <div className="space-y-2 pt-2 border-t">
                <Label>Vincular Ministérios</Label>
                {/* Removido o max-h e overflow daqui, para rolar livremente com a tela */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 border rounded-md bg-muted/20">
                  {ministries.map((ministry) => (
                    <div key={ministry.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`ministry-${ministry.id}`}
                        checked={selectedMinistries.includes(ministry.id)}
                        onCheckedChange={() => toggleMinistry(ministry.id)}
                      />
                      <Label
                        htmlFor={`ministry-${ministry.id}`}
                        className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {ministry.name}
                      </Label>
                    </div>
                  ))}
                  {ministries.length === 0 && (
                    <p className="text-sm text-muted-foreground col-span-2">
                      Nenhum ministério encontrado para esta igreja.
                    </p>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Rodapé Fixo */}
        <div className="px-6 py-4 border-t shrink-0 bg-muted/10">
          {tempPassword ? (
            <Button onClick={handleClose} className="w-full">
              Fechar
            </Button>
          ) : (
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                form="create-user-form"
                disabled={loading || (!canAddMore && !tempPassword)}
                className="sirvo-btn-primary"
              >
                {loading ? "Criando..." : "Criar Usuário"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
