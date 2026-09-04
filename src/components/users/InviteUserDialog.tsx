import { useState, useEffect } from "react";
import { Mail, Send, AlertCircle, Loader2, CreditCard, Clock, CheckCircle2, XCircle, FileSpreadsheet, RefreshCw, MailCheck, MailX, MailWarning } from "lucide-react";
import { BulkInviteUpload } from "./BulkInviteUpload";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useChurchId } from "@/hooks/useChurchId";
import { useSubscription } from "@/hooks/useSubscription";
import { useMinistries } from "@/hooks/useMinistries";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
  role: z.enum(["admin", "ministry_leader", "volunteer"]),
});

interface InviteUserDialogProps {
  onInviteSuccess: () => void;
  currentUserCount?: number;
  isSuperAdmin?: boolean;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  ministry_id: string | null;
}

interface EmailStatus {
  status: string; // pending | sent | failed | dlq | suppressed | bounced | complained
  error_message: string | null;
  created_at: string;
}

export function InviteUserDialog({ onInviteSuccess, currentUserCount = 0, isSuperAdmin = false }: InviteUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "ministry_leader" | "volunteer">("volunteer");
  const [ministryId, setMinistryId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [maxUsers, setMaxUsers] = useState(3);
  const [planName, setPlanName] = useState("Gratuito");
  const [churchName, setChurchName] = useState("");
  const [inviterName, setInviterName] = useState("");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [emailStatuses, setEmailStatuses] = useState<Record<string, EmailStatus>>({});
  const [resendingId, setResendingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { churchId } = useChurchId();
  const { createCheckout } = useSubscription();
  const { ministries } = useMinistries(churchId);
  const { isLeader } = useUserRole();

  const getNextPlan = () => {
    if (maxUsers <= 3) return { plan: "basic" as const, name: "Básico", users: 10, price: "R$29,90" };
    if (maxUsers <= 10) return { plan: "standard" as const, name: "Standard", users: 30, price: "R$59,90" };
    return null;
  };

  const nextPlan = getNextPlan();

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

  useEffect(() => {
    if (open && churchId) {
      fetchSubscriptionAndChurch();
      fetchInvitations();
    }
  }, [open, churchId]);

  const fetchInvitations = async () => {
    if (!churchId) return;
    setLoadingInvitations(true);
    try {
      const { data, error } = await supabase
        .from("invitations")
        .select("id, email, role, status, created_at, expires_at, accepted_at, ministry_id")
        .eq("church_id", churchId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Mark expired invitations
      const now = new Date();
      const processed = (data || []).map((inv) => ({
        ...inv,
        status: inv.status === "pending" && new Date(inv.expires_at) < now ? "expired" : inv.status,
      }));

      setInvitations(processed);
      fetchEmailStatuses();
    } catch (err) {
      console.error("Error fetching invitations:", err);
    } finally {
      setLoadingInvitations(false);
    }
  };

  const fetchEmailStatuses = async () => {
    if (!churchId) return;
    try {
      const { data, error } = await supabase.rpc("get_invitation_email_statuses", {
        _church_id: churchId,
      });
      if (error) throw error;
      const map: Record<string, EmailStatus> = {};
      (data || []).forEach((row: any) => {
        map[row.invitation_id] = {
          status: row.status,
          error_message: row.error_message,
          created_at: row.created_at,
        };
      });
      setEmailStatuses(map);
    } catch (err) {
      console.error("Error fetching email statuses:", err);
    }
  };

  const handleResend = async (inv: Invitation) => {
    if (!churchId) return;
    setResendingId(inv.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-invite", {
        body: {
          email: inv.email,
          role: inv.role,
          churchId,
          churchName,
          inviterName,
          ministryId: inv.ministry_id || undefined,
          resend: true,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Erro ao reenviar", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Convite reenviado 📨", description: `Novo email enviado para ${inv.email}` });
      fetchInvitations();
    } catch (err: any) {
      console.error("Resend error:", err);
      toast({
        title: "Erro ao reenviar convite",
        description: err.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setResendingId(null);
    }
  };

  const fetchSubscriptionAndChurch = async () => {
    if (!churchId) return;

    const { data: subscription } = await supabase
      .from("church_subscriptions")
      .select("plan, max_users")
      .eq("church_id", churchId)
      .maybeSingle();

    if (subscription) {
      setMaxUsers(subscription.max_users);
      const planNames = { free: "Gratuito", basic: "Básico", standard: "Standard" };
      setPlanName(planNames[subscription.plan as keyof typeof planNames] || "Gratuito");
    }

    const { data: church } = await supabase
      .from("churches")
      .select("name")
      .eq("id", churchId)
      .maybeSingle();

    if (church) setChurchName(church.name);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) setInviterName(profile.full_name || "Um administrador");
    }
  };

  const canAddUser = isSuperAdmin || currentUserCount < maxUsers;
  const remainingSlots = isSuperAdmin ? Infinity : maxUsers - currentUserCount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canAddUser) {
      toast({
        title: "Limite de usuários atingido",
        description: `Seu plano ${planName} permite até ${maxUsers} usuários. Faça upgrade para adicionar mais.`,
        variant: "destructive",
      });
      return;
    }

    const result = inviteSchema.safeParse({ email: email.trim(), role });
    if (!result.success) {
      toast({
        title: "Erro de validação",
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    if (!churchId) {
      toast({ title: "Erro", description: "Igreja não encontrada", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-invite", {
        body: {
          email: email.trim(),
          role: isLeader ? "volunteer" : role,
          churchId,
          churchName,
          inviterName,
          ministryId: ministryId && ministryId !== "none" ? ministryId : undefined,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast({ title: "Erro ao enviar convite", description: data.error, variant: "destructive" });
        return;
      }

      toast({ title: "Convite enviado! 🎉", description: `Convite enviado para ${email}` });
      onInviteSuccess();
      fetchInvitations();
      setEmail("");
      setRole("volunteer");
      setMinistryId("");
    } catch (error: any) {
      console.error("Error sending invite:", error);
      toast({
        title: "Erro ao enviar convite",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    ministry_leader: "Líder",
    volunteer: "Voluntário",
  };

  const statusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    pending: { label: "Pendente", icon: <Clock className="w-3 h-3" />, className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
    accepted: { label: "Aceito", icon: <CheckCircle2 className="w-3 h-3" />, className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
    expired: { label: "Expirado", icon: <XCircle className="w-3 h-3" />, className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  };

  const emailStatusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    pending: { label: "Enfileirado", icon: <Clock className="w-3 h-3" />, className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
    sent: { label: "Enviado", icon: <MailCheck className="w-3 h-3" />, className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
    failed: { label: "Falhou", icon: <MailX className="w-3 h-3" />, className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
    dlq: { label: "Falhou", icon: <MailX className="w-3 h-3" />, className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
    bounced: { label: "Devolvido", icon: <MailX className="w-3 h-3" />, className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
    complained: { label: "Reclamação", icon: <MailWarning className="w-3 h-3" />, className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
    suppressed: { label: "Suprimido", icon: <MailWarning className="w-3 h-3" />, className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  };

  const pendingCount = invitations.filter((i) => i.status === "pending").length;
  const acceptedCount = invitations.filter((i) => i.status === "accepted").length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="sirvo-btn-primary text-xs sm:text-sm px-3 sm:px-4">
          <Mail className="w-4 h-4 mr-1 sm:mr-2 shrink-0" />
          <span className="truncate">Convidar</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convidar Novo Membro</DialogTitle>
          <DialogDescription>
            Envie um convite com link único. O membro será vinculado à sua igreja automaticamente.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="send" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="send" className="flex-1">Enviar</TabsTrigger>
            <TabsTrigger value="bulk" className="flex-1">
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
              Planilha
            </TabsTrigger>
            <TabsTrigger value="sent" className="flex-1">
              Enviados
              {pendingCount > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="space-y-4 mt-4">
            {!canAddUser && nextPlan && (
              <Alert className="border-primary/30 bg-primary/5">
                <CreditCard className="h-4 w-4 text-primary" />
                <AlertDescription className="flex flex-col gap-3">
                  <span>
                    Limite de <strong>{maxUsers} usuários</strong> atingido no plano {planName}.
                  </span>
                  <Button onClick={handleUpgrade} disabled={upgradeLoading} className="sirvo-btn-primary w-full">
                    {upgradeLoading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Redirecionando...</>
                    ) : (
                      <><CreditCard className="w-4 h-4 mr-2" />Upgrade para {nextPlan.name} ({nextPlan.users} usuários) - {nextPlan.price}/mês</>
                    )}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {!canAddUser && !nextPlan && (
              <Alert variant="default">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Você já está no plano máximo. Entre em contato para mais usuários.</AlertDescription>
              </Alert>
            )}

            {canAddUser && remainingSlots <= 2 && (
              <Alert className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Restam apenas {remainingSlots} vaga(s) no plano {planName}.</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="sirvo-input"
                  required
                  maxLength={255}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="role">Função</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                    <SelectTrigger className="sirvo-input">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="volunteer">Voluntário</SelectItem>
                        {!isLeader && <SelectItem value="ministry_leader">Líder de Ministério</SelectItem>}
                        {!isLeader && <SelectItem value="admin">Administrador</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ministry">Ministério (opcional)</Label>
                  <Select value={ministryId} onValueChange={setMinistryId}>
                    <SelectTrigger className="sirvo-input">
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {ministries.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading || !canAddUser} className="sirvo-btn-primary">
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" />Enviar Convite</>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="bulk" className="mt-4">
            <BulkInviteUpload
              onSuccess={() => {
                onInviteSuccess();
                fetchInvitations();
              }}
              churchName={churchName}
              inviterName={inviterName}
              remainingSlots={typeof remainingSlots === "number" && isFinite(remainingSlots) ? remainingSlots : 9999}
              isSuperAdmin={isSuperAdmin}
            />
          </TabsContent>

          <TabsContent value="sent" className="mt-4">
            {loadingInvitations ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : invitations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>Nenhum convite enviado ainda</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                  <span>{pendingCount} pendente(s)</span>
                  <span>•</span>
                  <span>{acceptedCount} aceito(s)</span>
                </div>
                {invitations.map((inv) => {
                  const config = statusConfig[inv.status] || statusConfig.pending;
                  const ministry = ministries.find((m) => m.id === inv.ministry_id);
                  const emailStatus = emailStatuses[inv.id];
                  const emailConfig = emailStatus ? emailStatusConfig[emailStatus.status] : null;
                  const canResend = inv.status !== "accepted";
                  const isResending = resendingId === inv.id;
                  return (
                    <div
                      key={inv.id}
                      className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-card"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{inv.email}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-muted-foreground">
                              {roleLabels[inv.role] || inv.role}
                            </span>
                            {ministry && (
                              <>
                                <span className="text-xs text-muted-foreground">•</span>
                                <span className="text-xs text-muted-foreground">{ministry.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary" className={`shrink-0 gap-1 ${config.className}`}>
                          {config.icon}
                          {config.label}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="text-xs text-muted-foreground">Email:</span>
                          {emailConfig ? (
                            <Badge variant="secondary" className={`gap-1 ${emailConfig.className}`} title={emailStatus?.error_message || undefined}>
                              {emailConfig.icon}
                              {emailConfig.label}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">sem registro</span>
                          )}
                          {emailStatus?.error_message && (
                            <span className="text-xs text-red-600 dark:text-red-400 truncate max-w-[180px]" title={emailStatus.error_message}>
                              {emailStatus.error_message}
                            </span>
                          )}
                        </div>
                        {canResend && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleResend(inv)}
                            disabled={isResending}
                            className="h-7 px-2 text-xs"
                          >
                            {isResending ? (
                              <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Reenviando</>
                            ) : (
                              <><RefreshCw className="w-3 h-3 mr-1" />Reenviar</>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
