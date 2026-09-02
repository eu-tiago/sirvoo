import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, MailX } from "lucide-react";

type State =
  | { kind: "loading" }
  | { kind: "valid" }
  | { kind: "already" }
  | { kind: "invalid" }
  | { kind: "submitting" }
  | { kind: "done" }
  | { kind: "error"; message: string };

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid" });
      return;
    }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, {
      headers: { apikey: supabaseAnonKey },
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) return setState({ kind: "invalid" });
        if (data.valid === false && data.reason === "already_unsubscribed") {
          return setState({ kind: "already" });
        }
        if (data.valid) return setState({ kind: "valid" });
        setState({ kind: "invalid" });
      })
      .catch((e) => setState({ kind: "error", message: e?.message ?? "Erro" }));
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState({ kind: "submitting" });
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    if (error) return setState({ kind: "error", message: error.message });
    if (data?.success || data?.reason === "already_unsubscribed") {
      return setState({ kind: "done" });
    }
    setState({ kind: "error", message: "Não foi possível processar." });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <MailX className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Cancelar inscrição</CardTitle>
          <CardDescription>Sirvo · Gestão de Voluntários</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {state.kind === "loading" && (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <p>Validando link...</p>
            </div>
          )}
          {state.kind === "valid" && (
            <>
              <p className="text-sm text-muted-foreground">
                Confirme abaixo para parar de receber emails do Sirvo neste endereço.
              </p>
              <Button onClick={confirm} className="w-full">
                Confirmar cancelamento
              </Button>
            </>
          )}
          {state.kind === "submitting" && (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <p>Processando...</p>
            </div>
          )}
          {state.kind === "done" && (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
              <p className="text-sm">Você foi removido da nossa lista. Pode fechar esta página.</p>
            </div>
          )}
          {state.kind === "already" && (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
              <p className="text-sm">Este endereço já estava cancelado.</p>
            </div>
          )}
          {state.kind === "invalid" && (
            <div className="flex flex-col items-center gap-2">
              <XCircle className="w-8 h-8 text-destructive" />
              <p className="text-sm">Link inválido ou expirado.</p>
            </div>
          )}
          {state.kind === "error" && (
            <div className="flex flex-col items-center gap-2">
              <XCircle className="w-8 h-8 text-destructive" />
              <p className="text-sm">{state.message}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
