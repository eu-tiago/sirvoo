import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Status = "checking" | "ok" | "error";

/**
 * Indicador de status da conexão Supabase.
 * Renderiza apenas em desenvolvimento (import.meta.env.DEV).
 * Mostra a URL/projeto configurados e se o REST responde.
 */
export const SupabaseConnectionStatus = () => {
  const [status, setStatus] = useState<Status>("checking");
  const [detail, setDetail] = useState<string>("");
  const [open, setOpen] = useState(false);

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let cancelled = false;

    const run = async () => {
      if (!url || !key) {
        setStatus("error");
        setDetail("Variáveis VITE_SUPABASE_URL/PUBLISHABLE_KEY ausentes");
        return;
      }
      try {
        const res = await fetch(`${url}/rest/v1/?apikey=${key}`, {
          headers: { apikey: key },
        });
        if (cancelled) return;
        if (res.ok) {
          setStatus("ok");
          setDetail(`HTTP ${res.status}`);
        } else {
          setStatus("error");
          setDetail(`HTTP ${res.status}`);
        }
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setDetail(e instanceof Error ? e.message : "Falha de rede");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [url, key]);

  if (!import.meta.env.DEV) return null;

  const color =
    status === "ok"
      ? "bg-emerald-500"
      : status === "error"
        ? "bg-red-500"
        : "bg-amber-500";

  const label =
    status === "ok"
      ? "Supabase OK"
      : status === "error"
        ? "Supabase erro"
        : "Verificando…";

  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        right: 8,
        zIndex: 99999,
        fontFamily: "ui-sans-serif, system-ui",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className={`${color} text-white text-xs px-2 py-1 rounded-full shadow flex items-center gap-1.5`}
        title="Status da conexão Supabase (apenas em dev)"
      >
        <span className="w-2 h-2 rounded-full bg-white/90 inline-block" />
        {label}
      </button>
      {open && (
        <div className="mt-2 w-72 rounded-md border bg-background text-foreground text-xs p-3 shadow-lg">
          <div className="font-semibold mb-1">Conexão Supabase</div>
          <div className="space-y-0.5 break-all">
            <div>
              <span className="opacity-60">Projeto:</span> {projectId ?? "—"}
            </div>
            <div>
              <span className="opacity-60">URL:</span> {url ?? "—"}
            </div>
            <div>
              <span className="opacity-60">Key:</span>{" "}
              {key ? `${key.slice(0, 12)}…` : "—"}
            </div>
            <div>
              <span className="opacity-60">REST:</span> {detail || "—"}
            </div>
            <div>
              <span className="opacity-60">Runtime client:</span>{" "}
              {/* @ts-expect-error acesso interno apenas para diagnóstico */}
              {supabase?.supabaseUrl ?? "—"}
            </div>
          </div>
          <div className="mt-2 opacity-60">
            Visível somente em desenvolvimento.
          </div>
        </div>
      )}
    </div>
  );
};

export default SupabaseConnectionStatus;
