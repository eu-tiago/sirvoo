import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, Church, UserPlus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { z } from "zod";

const signupSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  fullName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
});

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

interface InviteInfo {
  churchName: string;
  inviterName: string;
  role: string;
  email: string;
  expired: boolean;
  status: string;
}

const AcceptInvite = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn } = useAuth();
  const { toast } = useToast();

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [pendingEmailConfirm, setPendingEmailConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    ministry_leader: "Líder de Ministério",
    volunteer: "Voluntário",
  };

  // Fetch invite info (public endpoint via edge function)
  useEffect(() => {
    const fetchInviteInfo = async () => {
      if (!token) {
        setInviteError("Token de convite inválido");
        setLoadingInvite(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("get-invite-info", {
          body: { token },
        });

        if (error) throw error;

        if (data?.error) {
          setInviteError(data.error);
        } else {
          setInviteInfo(data);
          setEmail(data.email || "");
        }
      } catch (err: any) {
        setInviteError("Não foi possível carregar as informações do convite");
      } finally {
        setLoadingInvite(false);
      }
    };

    fetchInviteInfo();
  }, [token]);

  // If user is already logged in, auto-accept
  useEffect(() => {
    if (user && !authLoading && inviteInfo && !inviteInfo.expired && inviteInfo.status === "pending") {
      acceptInvite();
    }
  }, [user, authLoading, inviteInfo]);

  const acceptInvite = async () => {
    if (!token || accepting) return;
    setAccepting(true);

    try {
      const { data, error } = await supabase.functions.invoke("accept-invite", {
        body: { inviteToken: token },
      });

      if (error) throw error;

      if (data?.error) {
        if (data.alreadyAccepted) {
          navigate("/dashboard");
          return;
        }
        toast({
          variant: "destructive",
          title: "Erro ao aceitar convite",
          description: data.error,
        });
      } else {
        toast({
          title: "Convite aceito! 🎉",
          description: `Bem-vindo à ${data.churchName || "igreja"}!`,
        });
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erro ao aceitar convite",
        description: err.message,
      });
    } finally {
      setAccepting(false);
    }
  };

  const validateForm = () => {
    try {
      if (isSignUp) {
        signupSchema.parse({ email, password, fullName });
      } else {
        loginSchema.parse({ email, password });
      }
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) newErrors[err.path[0] as string] = err.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Enforce invitation email matches account email
    if (inviteInfo && email.trim().toLowerCase() !== inviteInfo.email.trim().toLowerCase()) {
      toast({
        variant: "destructive",
        title: "Email não corresponde ao convite",
        description: `Este convite é para ${inviteInfo.email}. Use exatamente esse email.`,
      });
      return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        // Direct signup so we can keep the invite token in the email-confirm redirect
        const redirectUrl = `${window.location.origin}/convite/${token}`;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: { full_name: fullName },
          },
        });
        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "Email já cadastrado",
              description: "Detectamos uma conta com esse email. Faça login para aceitar o convite.",
            });
            setIsSignUp(false);
          } else {
            toast({ variant: "destructive", title: "Erro ao criar conta", description: error.message });
          }
        } else if (!data.session) {
          // Email confirmation required
          setPendingEmailConfirm(true);
        }
        // If session exists, useEffect will auto-accept
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            variant: "destructive",
            title: "Erro ao entrar",
            description: "Email ou senha incorretos.",
          });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (loadingInvite || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando convite...</p>
        </div>
      </div>
    );
  }

  // Accepting state (logged in user)
  if (user && accepting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Aceitando convite...</p>
        </div>
      </div>
    );
  }

  // Email confirmation pending state
  if (pendingEmailConfirm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Confirme seu email</h1>
          <p className="text-muted-foreground">
            Enviamos um link de confirmação para <strong>{email}</strong>. Abra o email e clique no link — você voltará automaticamente para aceitar o convite.
          </p>
          <p className="text-sm text-muted-foreground">
            Não recebeu? Verifique sua caixa de spam.
          </p>
        </div>
      </div>
    );
  }

  // Error / expired state
  if (inviteError || !inviteInfo || inviteInfo.expired || inviteInfo.status !== "pending") {
    const message = inviteInfo?.status === "accepted"
      ? "Este convite já foi aceito."
      : inviteInfo?.expired || inviteInfo?.status === "expired"
      ? "Este convite expirou. Peça um novo convite ao administrador."
      : inviteError || "Convite inválido.";

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Convite indisponível</h1>
          <p className="text-muted-foreground">{message}</p>
          <Link to="/">
            <Button className="sirvo-btn-primary">Ir para o início</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Show signup/login form with invite context
  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl sirvo-gradient-bg flex items-center justify-center">
              <span className="text-lg font-bold text-primary-foreground">S</span>
            </div>
            <span className="text-xl font-bold text-foreground">Sirvo</span>
          </Link>

          {/* Invite context card */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 mb-8 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Church className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Você foi convidado para</p>
                <p className="font-semibold text-foreground text-lg">{inviteInfo.churchName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <UserPlus className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Convite enviado por</p>
                <p className="font-medium text-foreground">{inviteInfo.inviterName}</p>
              </div>
            </div>
            <div className="pt-1">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                {roleLabels[inviteInfo.role] || inviteInfo.role}
              </span>
            </div>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">
              {isSignUp ? "Crie sua conta" : "Entre na sua conta"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {isSignUp
                ? "Crie sua conta para entrar na igreja"
                : "Entre para aceitar o convite"
              }
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Seu nome"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="sirvo-input"
                />
                {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="sirvo-input bg-muted/40"
                readOnly
              />
              <p className="text-xs text-muted-foreground">
                Este convite é exclusivo para este email.
              </p>
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="sirvo-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>

            <Button type="submit" className="w-full sirvo-btn-primary py-6" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isSignUp ? (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Criar conta e entrar na igreja
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Entrar e aceitar convite
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              {isSignUp ? "Já tem uma conta?" : "Não tem uma conta?"}{" "}
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-primary font-medium hover:underline"
              >
                {isSignUp ? "Entrar" : "Criar conta"}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Visual */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <div className="absolute inset-0 sirvo-gradient-bg opacity-90" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2)_0%,transparent_50%)]" />
        <div className="relative flex flex-col items-center justify-center px-12 text-primary-foreground">
          <div className="max-w-md text-center">
            <h2 className="text-3xl font-bold mb-4">
              Bem-vindo à {inviteInfo.churchName}
            </h2>
            <p className="text-lg opacity-90">
              Você foi convidado para fazer parte da equipe. Crie sua conta e comece a participar!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcceptInvite;
