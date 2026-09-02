import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Megaphone,
  Sparkles,
  Download,
  Send,
  Loader2,
  History,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";

type Segment = "all" | "free" | "premium";
type AIKind = "subject" | "body" | "cta" | "ideas";

interface BroadcastRow {
  id: string;
  segment: Segment;
  channel: string;
  title: string;
  message: string;
  cta: string | null;
  recipients_count: number;
  created_at: string;
}

const segmentLabel: Record<Segment, string> = {
  all: "Todos usuários",
  free: "Apenas gratuitos",
  premium: "Apenas premium",
};

export default function AdminBroadcast() {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: roleLoading } = useUserRole();

  const [segment, setSegment] = useState<Segment>("all");
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [cta, setCta] = useState("");

  const [aiTopic, setAiTopic] = useState("");
  const [aiLoading, setAiLoading] = useState<AIKind | null>(null);
  const [aiOutput, setAiOutput] = useState("");

  const [sending, setSending] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [history, setHistory] = useState<BroadcastRow[]>([]);

  // load count when segment changes
  useEffect(() => {
    if (!isSuperAdmin) return;
    setCountLoading(true);
    supabase.functions
      .invoke("admin-broadcast", { body: { action: "count", segment } })
      .then(({ data, error }) => {
        if (error) {
          toast.error("Erro ao contar destinatários");
          setAudienceCount(null);
        } else {
          setAudienceCount(data?.count ?? 0);
        }
      })
      .finally(() => setCountLoading(false));
  }, [segment, isSuperAdmin]);

  // history
  const loadHistory = async () => {
    const { data, error } = await supabase
      .from("admin_broadcasts" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error && data) setHistory(data as unknown as BroadcastRow[]);
  };

  useEffect(() => {
    if (isSuperAdmin) loadHistory();
  }, [isSuperAdmin]);

  if (authLoading || roleLoading) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="p-6">
            <Skeleton className="h-8 w-64 mb-4" />
            <Skeleton className="h-48 w-full" />
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (!user || !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleAI = async (kind: AIKind) => {
    if (!aiTopic.trim()) {
      toast.error("Descreva o tema do comunicado primeiro");
      return;
    }
    setAiLoading(kind);
    setAiOutput("");
    try {
      const { data, error } = await supabase.functions.invoke(
        "admin-broadcast",
        {
          body: {
            action: "ai_generate",
            kind,
            topic: aiTopic,
            audience: segment,
          },
        },
      );
      if (error) throw error;
      setAiOutput(data?.content ?? "");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro na IA");
    } finally {
      setAiLoading(null);
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Preencha título e mensagem");
      return;
    }
    if (
      !confirm(
        `Enviar para ${audienceCount ?? "?"} usuários (${segmentLabel[segment]})?`,
      )
    ) {
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "admin-broadcast",
        {
          body: {
            action: "send_in_app",
            segment,
            title,
            message,
            cta: cta || undefined,
          },
        },
      );
      if (error) throw error;
      toast.success(`Enviado para ${data?.recipients} usuários`);
      setTitle("");
      setMessage("");
      setCta("");
      loadHistory();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar");
    } finally {
      setSending(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-broadcast`;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ action: "export", segment }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(t);
      }
      const csv = await resp.text();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `sirvo-contatos-${segment}-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success("CSV exportado");
      loadHistory();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao exportar");
    } finally {
      setExporting(false);
    }
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="px-4 md:px-6 py-6 max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Megaphone className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Central de Comunicados</h1>
              <p className="text-sm text-muted-foreground">
                Envie notificações in-app e exporte contatos para campanhas externas
              </p>
            </div>
          </div>

          {/* Segment + audience */}
          <Card className="p-5 space-y-4">
            <div className="grid sm:grid-cols-[1fr,auto] gap-4 items-end">
              <div>
                <Label>Segmento</Label>
                <Select
                  value={segment}
                  onValueChange={(v) => setSegment(v as Segment)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos usuários</SelectItem>
                    <SelectItem value="free">Apenas gratuitos</SelectItem>
                    <SelectItem value="premium">Apenas premium (Basic/Standard)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Destinatários</p>
                <p className="text-2xl font-bold">
                  {countLoading ? "…" : (audienceCount ?? "—")}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exporting || !audienceCount}
              className="w-full sm:w-auto"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Exportar CSV ({segmentLabel[segment]})
            </Button>
          </Card>

          {/* AI Assistant */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="font-bold">Assistente de IA</h2>
            </div>
            <div>
              <Label>Tema do comunicado</Label>
              <Textarea
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="Ex: Anunciar nova funcionalidade de troca de escalas..."
                rows={2}
                className="mt-1"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { k: "subject", label: "Gerar assunto" },
                  { k: "body", label: "Gerar corpo" },
                  { k: "cta", label: "Gerar CTA" },
                  { k: "ideas", label: "Ideias promocionais" },
                ] as { k: AIKind; label: string }[]
              ).map(({ k, label }) => (
                <Button
                  key={k}
                  variant="outline"
                  size="sm"
                  onClick={() => handleAI(k)}
                  disabled={aiLoading !== null}
                >
                  {aiLoading === k ? (
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3 mr-2" />
                  )}
                  {label}
                </Button>
              ))}
            </div>
            {aiOutput && (
              <div className="rounded-xl bg-muted p-4">
                <pre className="whitespace-pre-wrap text-sm font-sans">
                  {aiOutput}
                </pre>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2"
                  onClick={() => {
                    navigator.clipboard.writeText(aiOutput);
                    toast.success("Copiado");
                  }}
                >
                  Copiar
                </Button>
              </div>
            )}
          </Card>

          {/* Compose & send in-app */}
          <Card className="p-5 space-y-4">
            <h2 className="font-bold">Notificação in-app</h2>
            <div>
              <Label>Título</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={140}
                placeholder="Novidades no Sirvo"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Mensagem</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                maxLength={2000}
                placeholder="Escreva sua mensagem..."
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {message.length}/2000
              </p>
            </div>
            <div>
              <Label>CTA (opcional)</Label>
              <Input
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                placeholder="Confira agora"
                maxLength={100}
                className="mt-1"
              />
            </div>
            <Button
              onClick={handleSend}
              disabled={sending || !audienceCount}
              className="w-full sm:w-auto"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Enviar para {audienceCount ?? "—"} usuários
            </Button>
          </Card>

          {/* History */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              <h2 className="font-bold">Histórico</h2>
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum comunicado enviado ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-xl border"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{h.title}</p>
                        <Badge variant="secondary" className="text-xs">
                          {h.channel === "in_app" ? "In-app" : "Export"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {segmentLabel[h.segment]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {h.message}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{h.recipients_count}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(h.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
