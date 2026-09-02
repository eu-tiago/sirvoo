import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { isSuperAdminEmail } from "@/lib/superadmin";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign, Users, TrendingUp, TrendingDown, RefreshCw, ShieldCheck, Ban,
  FileText, Loader2, ExternalLink, AlertTriangle, Search, CreditCard, Mail,
  CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type ChurchRow = {
  church_id: string;
  church_name: string;
  created_at: string;
  admin_name: string;
  admin_email: string;
  plan: "free" | "basic" | "standard";
  max_users: number;
  current_users: number;
  status: string;
  live_status: string;
  payment_status: "paid" | "past_due" | "unpaid" | "canceled" | "trialing" | "free";
  last_invoice_status: string | null;
  last_payment_at: number | null;
  next_payment_attempt: number | null;
  amount_due: number;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

type Kpis = {
  mrr: number;
  active_subscribers: number;
  past_due_count: number;
  overdue_amount: number;
  month_revenue: number;
  month_invoices: number;
  failed_this_month: number;
  churn: number;
  plan_breakdown: { free: number; basic: number; standard: number };
};

type Payment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paid: boolean;
  refunded: boolean;
  created: number;
  receipt_url: string | null;
  description: string | null;
  failure_message: string | null;
  church_name: string;
  card_brand: string | null;
  card_last4: string | null;
};

const planBadge: Record<string, { label: string; className: string }> = {
  free: { label: "Gratuito", className: "bg-muted text-muted-foreground" },
  basic: { label: "Básico", className: "bg-primary/10 text-primary" },
  standard: { label: "Padrão", className: "bg-amber-500/10 text-amber-600" },
};

const paymentStatusBadge: Record<string, { label: string; className: string; icon: any }> = {
  paid: { label: "Em dia", className: "bg-green-500/10 text-green-600 border-green-500/30", icon: CheckCircle2 },
  past_due: { label: "Inadimplente", className: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertTriangle },
  unpaid: { label: "Não pago", className: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle },
  canceled: { label: "Cancelado", className: "bg-muted text-muted-foreground", icon: Ban },
  trialing: { label: "Trial", className: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: Clock },
  free: { label: "Gratuito", className: "bg-muted text-muted-foreground", icon: Users },
};

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const fmtDate = (ts: number | string | null) => {
  if (!ts) return "—";
  const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
};

export default function AdminFinancial() {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [rows, setRows] = useState<ChurchRow[]>([]);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");

  // payments tab
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // override dialog
  const [overrideTarget, setOverrideTarget] = useState<ChurchRow | null>(null);
  const [overridePlan, setOverridePlan] = useState<"free" | "basic" | "standard">("basic");

  // invoices dialog
  const [invoicesTarget, setInvoicesTarget] = useState<ChurchRow | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-financial", {
        body: { action: "overview" },
      });
      if (error) throw error;
      setKpis(data.kpis);
      setRows(data.churches);
    } catch (e: any) {
      toast({ title: "Erro ao carregar dados", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchPayments = async () => {
    setPaymentsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-financial", {
        body: { action: "list_payments", limit: 100 },
      });
      if (error) throw error;
      setPayments(data.payments ?? []);
    } catch (e: any) {
      toast({ title: "Erro ao carregar pagamentos", description: e.message, variant: "destructive" });
    } finally {
      setPaymentsLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdminEmail(user?.email)) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (planFilter !== "all" && r.plan !== planFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.church_name.toLowerCase().includes(q) &&
          !r.admin_email.toLowerCase().includes(q) &&
          !(r.admin_name ?? "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [rows, search, planFilter]);

  const overdueRows = useMemo(
    () => rows.filter((r) => r.payment_status === "past_due" || r.payment_status === "unpaid" || r.amount_due > 0),
    [rows]
  );

  if (authLoading || roleLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isSuperAdmin || !isSuperAdminEmail(user.email)) return <Navigate to="/dashboard" replace />;

  const handleSync = async (church: ChurchRow) => {
    setActionLoading(church.church_id + ":sync");
    try {
      const { data, error } = await supabase.functions.invoke("admin-financial", {
        body: { action: "sync_church", churchId: church.church_id },
      });
      if (error) throw error;
      toast({ title: "Sincronizado", description: `Plano: ${data.plan} · Status: ${data.status ?? "—"}` });
      fetchData();
    } catch (e: any) {
      toast({ title: "Erro ao sincronizar", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleOverride = async () => {
    if (!overrideTarget) return;
    setActionLoading(overrideTarget.church_id + ":override");
    try {
      const { error } = await supabase.functions.invoke("admin-financial", {
        body: { action: "manual_override", churchId: overrideTarget.church_id, plan: overridePlan },
      });
      if (error) throw error;
      toast({ title: "Plano atualizado manualmente" });
      setOverrideTarget(null);
      fetchData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (church: ChurchRow) => {
    setActionLoading(church.church_id + ":suspend");
    try {
      const { error } = await supabase.functions.invoke("admin-financial", {
        body: { action: "manual_override", churchId: church.church_id, plan: "free" },
      });
      if (error) throw error;
      toast({ title: "Acesso suspenso", description: "Igreja revertida ao plano gratuito" });
      fetchData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const openInvoices = async (church: ChurchRow) => {
    setInvoicesTarget(church);
    setInvoicesLoading(true);
    setInvoices([]);
    try {
      const { data, error } = await supabase.functions.invoke("admin-financial", {
        body: { action: "list_invoices", churchId: church.church_id },
      });
      if (error) throw error;
      setInvoices(data.invoices ?? []);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setInvoicesLoading(false);
    }
  };

  const renderPaymentStatus = (r: ChurchRow) => {
    const cfg = paymentStatusBadge[r.payment_status] ?? paymentStatusBadge.free;
    const Icon = cfg.icon;
    return (
      <Badge variant="outline" className={`gap-1 ${cfg.className}`}>
        <Icon className="w-3 h-3" />
        {cfg.label}
      </Badge>
    );
  };

  const renderActions = (r: ChurchRow) => (
    <div className="flex justify-end gap-1 whitespace-nowrap">
      <Button size="sm" variant="ghost" onClick={() => handleSync(r)}
        disabled={actionLoading === r.church_id + ":sync"} title="Sincronizar com Stripe">
        {actionLoading === r.church_id + ":sync"
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <RefreshCw className="w-4 h-4" />}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => openInvoices(r)} title="Ver faturas">
        <FileText className="w-4 h-4" />
      </Button>
      <Button size="sm" variant="ghost"
        onClick={() => { setOverrideTarget(r); setOverridePlan(r.plan === "free" ? "basic" : r.plan); }}
        title="Liberar plano manualmente">
        <ShieldCheck className="w-4 h-4 text-primary" />
      </Button>
      {r.plan !== "free" && (
        <Button size="sm" variant="ghost" onClick={() => handleSuspend(r)}
          disabled={actionLoading === r.church_id + ":suspend"} title="Suspender (voltar ao gratuito)">
          {actionLoading === r.church_id + ":suspend"
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Ban className="w-4 h-4 text-destructive" />}
        </Button>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 text-primary" />
              Painel Financeiro
            </h1>
            <p className="text-sm text-muted-foreground">
              Assinantes, pagamentos, inadimplência e liberação manual
            </p>
          </div>
          <Button variant="outline" onClick={fetchData} disabled={refreshing} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <KpiCard icon={<TrendingUp className="w-5 h-5" />} label="MRR"
            value={loading ? "—" : fmtBRL(kpis?.mrr ?? 0)}
            hint="Receita recorrente mensal" tone="primary" />
          <KpiCard icon={<Users className="w-5 h-5" />} label="Assinantes ativos"
            value={loading ? "—" : String(kpis?.active_subscribers ?? 0)}
            hint={kpis ? `Básico ${kpis.plan_breakdown.basic} · Padrão ${kpis.plan_breakdown.standard}` : ""}
            tone="success" />
          <KpiCard icon={<AlertTriangle className="w-5 h-5" />} label="Inadimplentes"
            value={loading ? "—" : String(kpis?.past_due_count ?? 0)}
            hint={kpis ? `${fmtBRL(kpis.overdue_amount)} em atraso` : ""}
            tone="destructive" />
          <KpiCard icon={<DollarSign className="w-5 h-5" />} label="Receita do mês"
            value={loading ? "—" : fmtBRL(kpis?.month_revenue ?? 0)}
            hint={kpis ? `${kpis.month_invoices} pagas · ${kpis.failed_this_month} falhas` : ""}
            tone="amber" />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="subscribers" onValueChange={(v) => { if (v === "payments" && !payments) fetchPayments(); }}>
          <TabsList className="grid grid-cols-3 w-full md:w-auto">
            <TabsTrigger value="subscribers">Assinantes</TabsTrigger>
            <TabsTrigger value="overdue" className="gap-1">
              Inadimplentes
              {overdueRows.length > 0 && (
                <Badge className="bg-destructive text-destructive-foreground h-5 px-1.5 text-[10px]">
                  {overdueRows.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="payments">Pagamentos</TabsTrigger>
          </TabsList>

          {/* Subscribers tab */}
          <TabsContent value="subscribers" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-lg">Igrejas e assinaturas</CardTitle>
                <div className="flex gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Buscar igreja ou e-mail..." value={search}
                      onChange={(e) => setSearch(e.target.value)} className="pl-9 w-64" />
                  </div>
                  <Select value={planFilter} onValueChange={setPlanFilter}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos planos</SelectItem>
                      <SelectItem value="free">Gratuito</SelectItem>
                      <SelectItem value="basic">Básico</SelectItem>
                      <SelectItem value="standard">Padrão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {loading ? (
                  <div className="p-6 space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Igreja / Admin</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Pagamento</TableHead>
                        <TableHead>Usuários</TableHead>
                        <TableHead>Último pgto</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((r) => (
                        <TableRow key={r.church_id}>
                          <TableCell>
                            <div className="font-medium">{r.church_name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="w-3 h-3" />{r.admin_email}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={planBadge[r.plan]?.className}>
                              {planBadge[r.plan]?.label}
                            </Badge>
                          </TableCell>
                          <TableCell>{renderPaymentStatus(r)}</TableCell>
                          <TableCell className="text-sm">{r.current_users}/{r.max_users}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {fmtDate(r.last_payment_at)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {fmtDate(r.current_period_end)}
                            {r.cancel_at_period_end && (
                              <div className="text-[10px] text-amber-600">cancela ao fim</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{renderActions(r)}</TableCell>
                        </TableRow>
                      ))}
                      {filteredRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            Nenhuma igreja encontrada
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Overdue tab */}
          <TabsContent value="overdue" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Assinantes inadimplentes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {loading ? (
                  <div className="p-6"><Skeleton className="h-32 w-full" /></div>
                ) : overdueRows.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-600" />
                    Nenhum inadimplente. Todos os assinantes estão em dia! 🎉
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Igreja / Admin</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Valor devido</TableHead>
                        <TableHead>Próx. tentativa</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overdueRows.map((r) => (
                        <TableRow key={r.church_id}>
                          <TableCell>
                            <div className="font-medium">{r.church_name}</div>
                            <div className="text-xs text-muted-foreground">{r.admin_email}</div>
                          </TableCell>
                          <TableCell>{renderPaymentStatus(r)}</TableCell>
                          <TableCell className="text-sm font-semibold text-destructive">
                            {r.amount_due > 0 ? fmtBRL(r.amount_due) : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {fmtDate(r.next_payment_attempt)}
                          </TableCell>
                          <TableCell className="text-right">{renderActions(r)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments tab */}
          <TabsContent value="payments" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Últimos pagamentos
                </CardTitle>
                <Button variant="outline" size="sm" onClick={fetchPayments} disabled={paymentsLoading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${paymentsLoading ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {paymentsLoading ? (
                  <div className="p-6 space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : !payments || payments.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">Nenhum pagamento encontrado</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Igreja</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Cartão</TableHead>
                        <TableHead className="text-right">Recibo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(p.created * 1000).toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell className="font-medium">{p.church_name}</TableCell>
                          <TableCell className="font-semibold">{fmtBRL(p.amount)}</TableCell>
                          <TableCell>
                            {p.refunded ? (
                              <Badge variant="outline" className="border-amber-500/30 text-amber-600">Reembolsado</Badge>
                            ) : p.status === "succeeded" ? (
                              <Badge variant="outline" className="border-green-500/30 text-green-600 gap-1">
                                <CheckCircle2 className="w-3 h-3" />Pago
                              </Badge>
                            ) : p.status === "failed" ? (
                              <Badge variant="outline" className="border-destructive/30 text-destructive gap-1">
                                <XCircle className="w-3 h-3" />Falhou
                              </Badge>
                            ) : (
                              <Badge variant="outline">{p.status}</Badge>
                            )}
                            {p.failure_message && (
                              <div className="text-[10px] text-destructive mt-0.5">{p.failure_message}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground uppercase">
                            {p.card_brand && p.card_last4 ? `${p.card_brand} ••••${p.card_last4}` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {p.receipt_url ? (
                              <a href={p.receipt_url} target="_blank" rel="noreferrer"
                                className="text-primary hover:underline inline-flex items-center gap-1">
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Override Dialog */}
      <Dialog open={!!overrideTarget} onOpenChange={(o) => !o && setOverrideTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liberar acesso manualmente</DialogTitle>
            <DialogDescription>
              {overrideTarget?.church_name} — defina o plano sem passar pelo Stripe.
              Útil quando o pagamento foi confirmado mas o webhook não atualizou.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-sm font-medium">Plano</label>
            <Select value={overridePlan} onValueChange={(v: any) => setOverridePlan(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Gratuito (3 usuários)</SelectItem>
                <SelectItem value="basic">Básico (10 usuários)</SelectItem>
                <SelectItem value="standard">Padrão (30 usuários)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideTarget(null)}>Cancelar</Button>
            <Button onClick={handleOverride} disabled={!!actionLoading}>
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoices Dialog */}
      <Dialog open={!!invoicesTarget} onOpenChange={(o) => !o && setInvoicesTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Faturas — {invoicesTarget?.church_name}</DialogTitle>
            <DialogDescription>Histórico de cobranças no Stripe</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {invoicesLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma fatura encontrada</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <div className="font-medium text-sm">{inv.number ?? inv.id}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span>{new Date(inv.created * 1000).toLocaleString("pt-BR")}</span>
                        <Badge variant="outline" className={
                          inv.status === "paid" ? "border-green-500/30 text-green-600"
                          : inv.status === "open" ? "border-amber-500/30 text-amber-600"
                          : inv.status === "uncollectible" || inv.status === "void"
                            ? "border-destructive/30 text-destructive" : ""
                        }>
                          {inv.status}
                        </Badge>
                        {inv.attempt_count > 1 && (
                          <span className="text-amber-600">{inv.attempt_count} tentativas</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {fmtBRL(inv.status === "paid" ? inv.amount_paid : inv.amount_due)}
                      </span>
                      {inv.hosted_invoice_url && (
                        <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer"
                          className="text-primary hover:underline">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function KpiCard({ icon, label, value, hint, tone }: {
  icon: React.ReactNode; label: string; value: string; hint?: string;
  tone: "primary" | "success" | "amber" | "destructive";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-green-500/10 text-green-600",
    amber: "bg-amber-500/10 text-amber-600",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <Card>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs md:text-sm text-muted-foreground">{label}</span>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tones[tone]}`}>
            {icon}
          </div>
        </div>
        <div className="text-xl md:text-2xl font-bold">{value}</div>
        {hint && <div className="text-[10px] md:text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}
