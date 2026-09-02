import { useState } from "react";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ManagePasswordDialogProps {
  user: { id: string; name: string; email: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManagePasswordDialog({ user, open, onOpenChange }: ManagePasswordDialogProps) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const call = async (body: Record<string, unknown>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("admin-manage-password", {
      body,
      headers: sessionData.session
        ? { Authorization: `Bearer ${sessionData.session.access_token}` }
        : undefined,
    });
    if (error) {
      let msg = (data as { error?: string } | null)?.error || error.message;
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.text === "function") {
        try {
          const body = await ctx.text();
          const parsed = JSON.parse(body);
          if (parsed?.error) msg = parsed.error;
        } catch {
          /* ignore */
        }
      }
      throw new Error(msg);
    }
    const result = data as { success?: boolean; error?: string; code?: string } | null;
    if (result?.success === false || result?.error) {
      const validationError = new Error(result.error || "Não foi possível concluir a operação");
      validationError.name = result.code || "ValidationError";
      throw validationError;
    }
    return data;
  };

  const friendly = (msg: string) => {
    if (/weak|pwned|known to be weak|muito comum|vazamento|easy to guess/i.test(msg))
      return "Esta senha é muito comum ou já vazou na internet. Escolha uma senha mais forte (misture letras, números e símbolos).";
    if (/at least|should be at least|length/i.test(msg)) return "A senha deve ter pelo menos 8 caracteres.";
    if (/rate limit|too many/i.test(msg)) return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    return msg;
  };

  const handleSetPassword = async () => {
    if (password.length < 8) {
      toast({ variant: "destructive", title: "Senha muito curta", description: "Use pelo menos 8 caracteres." });
      return;
    }
    if (password !== confirm) {
      toast({ variant: "destructive", title: "As senhas não conferem" });
      return;
    }
    setSaving(true);
    try {
      await call({ action: "set", targetUserId: user.id, newPassword: password });
      toast({ title: "Senha alterada", description: `A nova senha de ${user.name} já está ativa.` });
      setPassword("");
      setConfirm("");
      onOpenChange(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao alterar senha", description: friendly((e as Error).message) });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSending(true);
    try {
      await call({
        action: "reset",
        targetUserId: user.id,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      toast({
        title: "Redefinição enviada",
        description: `${user.email} receberá um link para criar uma nova senha.`,
      });
      onOpenChange(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao enviar redefinição", description: friendly((e as Error).message) });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            Gerenciar senha
          </DialogTitle>
          <DialogDescription>
            {user.name} · {user.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar senha</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Repita a senha"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button className="w-full" onClick={handleSetPassword} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Definir senha manualmente"}
          </Button>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-2 text-xs text-muted-foreground">ou</span>
            </div>
          </div>

          <Button variant="outline" className="w-full" onClick={handleReset} disabled={sending}>
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Enviar redefinição por email
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            O usuário recebe um link e define a nova senha no próximo acesso.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
