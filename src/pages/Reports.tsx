import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, AlertTriangle, ArrowLeftRight, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useChurchId } from "@/hooks/useChurchId";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AttendanceRow {
  id: string;
  name: string;
  ministry: string;
  event: string;
  date: string;
  rawDate: string;
  checkedIn: boolean;
}

interface SwapRow {
  id: string;
  requester: string;
  requested: string;
  event: string;
  date: string;
  status: string;
  createdAt: string;
}

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const [y, m, day] = String(d).split("-").map(Number);
  if (!y) return "—";
  return format(new Date(y, (m || 1) - 1, day || 1), "dd MMM yyyy", { locale: ptBR });
};

const toCsv = (rows: Record<string, string>[]) => {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
};

const download = (filename: string, content: string) => {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const swapStatusLabel: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  accepted: { label: "Aceita", className: "bg-green-500/10 text-green-600 border-green-500/20" },
  rejected: { label: "Recusada", className: "bg-red-500/10 text-red-500 border-red-500/20" },
  cancelled: { label: "Cancelada", className: "bg-muted text-muted-foreground border-border" },
};

const Reports = () => {
  const { churchId, loading: churchLoading } = useChurchId();
  const { role, isSuperAdmin, loading: roleLoading } = useUserRole();
  const isAdmin = role === "admin" || role === "ministry_leader" || isSuperAdmin;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [swaps, setSwaps] = useState<SwapRow[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!churchId) return;
      setLoading(true);
      try {
        const { data: schedulesData, error } = await supabase
          .from("schedules")
          .select(`
            id,
            events!inner ( id, title, event_date, church_id ),
            ministries!inner ( id, name, church_id )
          `)
          .eq("ministries.church_id", churchId);
        if (error) throw error;

        const scheduleIds = (schedulesData || []).map((s: any) => s.id);
        const scheduleInfo = new Map<string, { event: string; date: string; ministry: string }>(
          (schedulesData || []).map((s: any) => [
            s.id,
            { event: s.events?.title || "—", date: s.events?.event_date || "", ministry: s.ministries?.name || "—" },
          ])
        );

        if (scheduleIds.length === 0) {
          setAttendance([]);
          setSwaps([]);
          return;
        }

        const todayStr = new Date().toISOString().split("T")[0];

        const [assignRes, swapRes] = await Promise.all([
          supabase
            .from("schedule_assignments")
            .select("id, user_id, schedule_id, status, checked_in_at")
            .in("schedule_id", scheduleIds)
            .eq("status", "confirmed"),
          supabase
            .from("swap_requests")
            .select("id, schedule_id, requester_id, requested_id, status, created_at")
            .in("schedule_id", scheduleIds)
            .order("created_at", { ascending: false }),
        ]);

        const assignments = assignRes.data || [];
        const swapRequests = swapRes.data || [];

        const userIds = Array.from(
          new Set([
            ...assignments.map((a: any) => a.user_id),
            ...swapRequests.map((s: any) => s.requester_id),
            ...swapRequests.map((s: any) => s.requested_id),
          ].filter(Boolean))
        );

        const nameById = new Map<string, string>();
        if (userIds.length > 0) {
          const { data: profiles } = await (supabase as any)
            .from("safe_profiles")
            .select("id, full_name")
            .in("id", userIds);
          for (const p of profiles || []) if (p.full_name) nameById.set(p.id, p.full_name);
        }

        setAttendance(
          assignments
            .filter((a: any) => {
              const info = scheduleInfo.get(a.schedule_id);
              return info?.date && info.date <= todayStr;
            })
            .map((a: any) => {
              const info = scheduleInfo.get(a.schedule_id)!;
              return {
                id: a.id,
                name: nameById.get(a.user_id) || "Sem nome",
                ministry: info.ministry,
                event: info.event,
                date: fmtDate(info.date),
                rawDate: info.date,
                checkedIn: !!a.checked_in_at,
              };
            })
            .sort((a, b) => b.rawDate.localeCompare(a.rawDate))
        );

        setSwaps(
          swapRequests.map((s: any) => {
            const info = scheduleInfo.get(s.schedule_id);
            return {
              id: s.id,
              requester: nameById.get(s.requester_id) || "Sem nome",
              requested: nameById.get(s.requested_id) || "Sem nome",
              event: info?.event || "—",
              date: fmtDate(info?.date),
              status: s.status,
              createdAt: format(new Date(s.created_at), "dd/MM/yyyy HH:mm"),
            };
          })
        );
      } catch (err: any) {
        toast({ title: "Erro ao carregar relatórios", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [churchId, toast]);

  const absences = useMemo(() => attendance.filter((a) => !a.checkedIn), [attendance]);
  const presences = attendance.length - absences.length;

  if (!roleLoading && !isAdmin) {
    return <Navigate to="/schedules" replace />;
  }

  const exportAbsences = () =>
    download(
      "relatorio-faltas.csv",
      toCsv(
        absences.map((a) => ({
          Voluntario: a.name,
          Ministerio: a.ministry,
          Evento: a.event,
          Data: a.date,
          Situacao: "Confirmou e não fez check-in",
        }))
      )
    );

  const exportSwaps = () =>
    download(
      "relatorio-trocas.csv",
      toCsv(
        swaps.map((s) => ({
          Solicitante: s.requester,
          Solicitado: s.requested,
          Evento: s.event,
          Data: s.date,
          Status: swapStatusLabel[s.status]?.label || s.status,
          Criado_em: s.createdAt,
        }))
      )
    );

  const LoadingSkeleton = () => (
    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  );

  return (
    <ProtectedRoute>
      <AppLayout>
        <header className="px-4 md:px-6 pt-6 md:pt-8 pb-4">
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe presenças (check-in), faltas e solicitações de troca da igreja
          </p>
        </header>

        <div className="px-4 md:px-6 pb-24 md:pb-6">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="sirvo-card p-3">
              <p className="text-xs text-muted-foreground">Presenças</p>
              <p className="text-xl font-bold text-green-600">{presences}</p>
            </div>
            <div className="sirvo-card p-3">
              <p className="text-xs text-muted-foreground">Faltas</p>
              <p className="text-xl font-bold text-red-500">{absences.length}</p>
            </div>
            <div className="sirvo-card p-3">
              <p className="text-xs text-muted-foreground">Trocas</p>
              <p className="text-xl font-bold text-primary">{swaps.length}</p>
            </div>
          </div>

          <Tabs defaultValue="faltas">
            <TabsList className="mb-4">
              <TabsTrigger value="faltas">
                <AlertTriangle className="w-4 h-4 mr-1.5" /> Faltas
              </TabsTrigger>
              <TabsTrigger value="presencas">
                <UserCheck className="w-4 h-4 mr-1.5" /> Presenças
              </TabsTrigger>
              <TabsTrigger value="trocas">
                <ArrowLeftRight className="w-4 h-4 mr-1.5" /> Trocas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="faltas">
              {loading || churchLoading ? (
                <LoadingSkeleton />
              ) : absences.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">Nenhuma falta registrada. 🎉</p>
              ) : (
                <>
                  <div className="flex justify-end mb-2">
                    <Button size="sm" variant="outline" onClick={exportAbsences}>
                      <Download className="w-4 h-4 mr-1.5" /> Exportar CSV
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {absences.map((a) => (
                      <div key={a.id} className="sirvo-card p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {a.ministry} · {a.event} · {a.date}
                          </p>
                        </div>
                        <Badge className="bg-red-500/10 text-red-500 border-red-500/20 shrink-0">
                          Falta
                        </Badge>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="presencas">
              {loading || churchLoading ? (
                <LoadingSkeleton />
              ) : presences === 0 ? (
                <p className="text-center text-muted-foreground py-10">Nenhum check-in registrado ainda.</p>
              ) : (
                <div className="space-y-2">
                  {attendance
                    .filter((a) => a.checkedIn)
                    .map((a) => (
                      <div key={a.id} className="sirvo-card p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {a.ministry} · {a.event} · {a.date}
                          </p>
                        </div>
                        <Badge className="bg-green-500/10 text-green-600 border-green-500/20 shrink-0">
                          Presente
                        </Badge>
                      </div>
                    ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="trocas">
              {loading || churchLoading ? (
                <LoadingSkeleton />
              ) : swaps.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">Nenhuma solicitação de troca.</p>
              ) : (
                <>
                  <div className="flex justify-end mb-2">
                    <Button size="sm" variant="outline" onClick={exportSwaps}>
                      <Download className="w-4 h-4 mr-1.5" /> Exportar CSV
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {swaps.map((s) => {
                      const st = swapStatusLabel[s.status] || {
                        label: s.status,
                        className: "bg-muted text-muted-foreground border-border",
                      };
                      return (
                        <div key={s.id} className="sirvo-card p-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {s.requester} → {s.requested}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {s.event} · {s.date} · solicitado em {s.createdAt}
                            </p>
                          </div>
                          <Badge className={`${st.className} shrink-0`}>{st.label}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
};

export default Reports;
