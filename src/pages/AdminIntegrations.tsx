import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isSuperAdminEmail } from "@/lib/superadmin";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Plug,
  Shield,
  Lock,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface Secret {
  name: string;
  present: boolean;
  masked?: string;
}

interface Integration {
  id: string;
  name: string;
  category: string;
  description: string;
  configured: boolean;
  healthy: boolean;
  details: string;
  secrets: Secret[];
  docsUrl?: string;
  managed?: boolean;
}

interface Summary {
  total: number;
  configured: number;
  healthy: number;
  missing: number;
}

export default function AdminIntegrations() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isSuperAdminEmail(user.email))) {
      navigate("/dashboard");
    }
  }, [user, authLoading, navigate]);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-integrations", {
        body: { action: "list" },
      });
      if (error) throw error;
      setIntegrations(data.integrations || []);
      setSummary(data.summary || null);
    } catch (e: any) {
      toast.error("Erro ao carregar integrações", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && isSuperAdminEmail(user.email)) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const testIntegration = async (id: string) => {
    setTestingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-integrations", {
        body: { action: "test", id },
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success("Integração funcionando", { description: data.message });
      } else {
        toast.error("Falha no teste", { description: data?.error || "Erro desconhecido" });
      }
      await load();
    } catch (e: any) {
      toast.error("Falha no teste", { description: e.message });
    } finally {
      setTestingId(null);
    }
  };

  const grouped = integrations.reduce<Record<string, Integration[]>>((acc, i) => {
    (acc[i.category] = acc[i.category] || []).push(i);
    return acc;
  }, {});

  return (
    <AppLayout>
      <div className="container max-w-6xl py-6 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Plug className="w-6 h-6 text-primary" />
              <h1 className="text-3xl font-bold">Integrações</h1>
            </div>
            <p className="text-muted-foreground">
              Gerencie todas as conexões com APIs externas em um só lugar.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        <Alert>
          <Shield className="w-4 h-4" />
          <AlertTitle>Painel restrito ao Super Admin</AlertTitle>
          <AlertDescription>
            Apenas você pode visualizar e testar as integrações. As chaves nunca são exibidas
            por completo — apenas uma versão mascarada para conferência.
          </AlertDescription>
        </Alert>

        {/* Summary KPIs */}
        {summary && !loading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPI label="Total" value={summary.total} icon={Plug} tone="neutral" />
            <KPI label="Configuradas" value={summary.configured} icon={CheckCircle2} tone="success" />
            <KPI label="Saudáveis" value={summary.healthy} icon={Sparkles} tone="primary" />
            <KPI label="Pendentes" value={summary.missing} icon={AlertTriangle} tone="warning" />
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {category}
              </h2>
              <div className="grid gap-3">
                {items.map((integ) => (
                  <IntegrationCard
                    key={integ.id}
                    integ={integ}
                    onTest={() => testIntegration(integ.id)}
                    testing={testingId === integ.id}
                  />
                ))}
              </div>
            </div>
          ))
        )}

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plug className="w-5 h-5" />
              Adicionar nova integração
            </CardTitle>
            <CardDescription>
              Para conectar um novo serviço (ex.: WhatsApp, Google Calendar, OpenAI próprio):
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Peça no chat do Lovable: "quero integrar com [serviço]".</li>
              <li>O assistente vai solicitar a chave de API necessária de forma segura.</li>
              <li>A chave fica armazenada criptografada e aparece automaticamente neste painel.</li>
            </ol>
            <p className="text-xs text-muted-foreground pt-2 border-t">
              💡 Nunca compartilhe chaves diretamente no chat. Use sempre o formulário seguro que
              o assistente exibe.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function IntegrationCard({
  integ,
  onTest,
  testing,
}: {
  integ: Integration;
  onTest: () => void;
  testing: boolean;
}) {
  const status = !integ.configured
    ? { label: "Não configurada", className: "bg-muted text-muted-foreground", Icon: XCircle }
    : integ.healthy
    ? { label: "Ativa", className: "bg-green-500/10 text-green-600", Icon: CheckCircle2 }
    : { label: "Atenção", className: "bg-amber-500/10 text-amber-600", Icon: AlertTriangle };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg">{integ.name}</CardTitle>
              <Badge className={status.className}>
                <status.Icon className="w-3 h-3 mr-1" />
                {status.label}
              </Badge>
              {integ.managed && (
                <Badge variant="outline" className="gap-1">
                  <Lock className="w-3 h-3" />
                  Gerenciada
                </Badge>
              )}
            </div>
            <CardDescription className="mt-1">{integ.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{integ.details}</p>

        <div className="space-y-1.5">
          {integ.secrets.map((s) => (
            <div
              key={s.name}
              className="flex items-start justify-between gap-2 text-xs bg-muted/50 rounded-md px-3 py-2"
            >
              <code className="font-mono text-foreground shrink-0">{s.name}</code>
              <div className="flex items-start gap-2 min-w-0">
                <span className="font-mono text-muted-foreground break-all text-right select-all">
                  {s.masked}
                </span>
                {s.present ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap pt-2">
          <Button
            size="sm"
            variant="default"
            onClick={onTest}
            disabled={testing || !integ.configured}
          >
            {testing ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Testar conexão
          </Button>
          {integ.docsUrl && (
            <Button size="sm" variant="outline" asChild>
              <a href={integ.docsUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Painel do serviço
              </a>
            </Button>
          )}
          {!integ.managed && (
            <p className="text-xs text-muted-foreground ml-auto">
              Para alterar a chave, peça no chat do Lovable.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function KPI({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: any;
  tone: "neutral" | "success" | "primary" | "warning";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-muted text-foreground",
    success: "bg-green-500/10 text-green-600",
    primary: "bg-primary/10 text-primary",
    warning: "bg-amber-500/10 text-amber-600",
  };
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
