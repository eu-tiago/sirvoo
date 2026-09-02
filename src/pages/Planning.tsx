import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { GroupedScheduleCard, groupSchedules, ScheduleGroup } from "@/components/schedules/GroupedScheduleCard";
import { ScheduleDetailDialog } from "@/components/schedules/ScheduleDetailDialog";
import { CreateScheduleDialog, SchedulePrefill } from "@/components/schedules/CreateScheduleDialog";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { Button } from "@/components/ui/button";
import { Plus, Share2, Trash2 } from "lucide-react";
import { useSchedules } from "@/hooks/useSchedules";
import { useChurchId } from "@/hooks/useChurchId";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMinistries } from "@/hooks/useMinistries"; // ADICIONADO: Importação dos Ministérios reais
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { EditEventDialog } from "@/components/schedules/EditEventDialog";
import { ShareWeekDialog } from "@/components/schedules/ShareWeekDialog";
import { RecurringScheduleConfig } from "@/components/schedules/RecurringScheduleConfig";
import { ShareRecurringDialog } from "@/components/schedules/ShareRecurringDialog";
import { Navigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Planning = () => {
  const isMobile = useIsMobile();
  const { churchId, loading: churchLoading } = useChurchId();
  const { role, isSuperAdmin, loading: roleLoading } = useUserRole();
  const isAdmin = role === "admin" || role === "ministry_leader" || isSuperAdmin;
  const { toast } = useToast();

  const { ministries: allMinistries } = useMinistries(churchId); // ADICIONADO: Busca no banco todos os ministérios

  const {
    schedules,
    loading,
    refetch,
    confirmAssignment,
    markUnavailable,
    deleteSchedule,
    publishSchedules,
    remindPending,
  } = useSchedules(churchId);

  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [showShareWeek, setShowShareWeek] = useState(false);
  const [showShareRecurring, setShowShareRecurring] = useState(false);

  const [recurringWeekday, setRecurringWeekday] = useState<string>(String(new Date().getDay()));

  const [createPrefill, setCreatePrefill] = useState<SchedulePrefill | undefined>();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
  const [editEvent, setEditEvent] = useState<{
    id: string;
    title: string;
    date: string;
    time: string;
    location: string;
  } | null>(null);
  const [filter, setFilter] = useState<string>("Todas");
  const [statusFilter, setStatusFilter] = useState<"upcoming" | "drafts" | "past">("upcoming");

  // ARQUITETURA: Escalas Fixas como padrão prioritário ao abrir a página
  const [mainTab, setMainTab] = useState<"schedules" | "recurring">("recurring");

  if (!roleLoading && !isAdmin) {
    return <Navigate to="/schedules" replace />;
  }

  const todayStr = new Date().toISOString().split("T")[0];

  // CORREÇÃO APLICADA AQUI: Pegando a lista real do banco em vez das escalas apenas
  const ministries = ["Todas", ...Array.from(new Set(allMinistries.map((m) => m.name)))];

  const statusFiltered = schedules.filter((s) => {
    const isPast = s.eventDate ? s.eventDate < todayStr : false;
    if (statusFilter === "drafts") return s.status === "draft";
    if (statusFilter === "past") return isPast;
    return !isPast && s.status !== "draft";
  });
  const filteredSchedules = filter === "Todas" ? statusFiltered : statusFiltered.filter((s) => s.ministry === filter);

  const counts = {
    upcoming: schedules.filter((s) => (s.eventDate ? s.eventDate >= todayStr : true) && s.status !== "draft").length,
    drafts: schedules.filter((s) => s.status === "draft").length,
    past: schedules.filter((s) => s.eventDate && s.eventDate < todayStr).length,
  };

  const handleView = (schedule: any) => {
    setSelectedSchedule(schedule);
    setShowDetail(true);
  };

  const handleConfirm = async (assignmentId: string) => {
    await confirmAssignment(assignmentId);
    setShowDetail(false);
  };

  const handleUnavailable = async (assignmentId: string, reason?: string) => {
    await markUnavailable(assignmentId, reason);
    setShowDetail(false);
  };

  const handleDeleteClick = (scheduleId: string) => {
    setScheduleToDelete(scheduleId);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (scheduleToDelete) {
      await deleteSchedule(scheduleToDelete);
      setScheduleToDelete(null);
      setShowDeleteConfirm(false);
      setShowDetail(false);
    }
  };

  // Função para deletar um grupo inteiro de eventos manuais de uma vez
  const handleDeleteGroup = async (group: ScheduleGroup) => {
    try {
      for (const s of group.schedules) {
        await deleteSchedule(s.id);
      }
      toast({ title: "Escala de evento excluída com sucesso!" });
      refetch();
    } catch (error: any) {
      toast({ title: "Erro ao excluir grupo", description: error.message, variant: "destructive" });
    }
  };

  const handleDuplicate = async (group: ScheduleGroup) => {
    const scheduleIds = group.schedules.map((s) => s.id);
    const { data: quotaData } = await supabase
      .from("schedule_role_quotas")
      .select("schedule_id, role_id, quantity")
      .in("schedule_id", scheduleIds);

    const prefillQuotas: Record<string, Record<string, number>> = {};
    for (const s of group.schedules) {
      const sQuotas = (quotaData || []).filter((q) => q.schedule_id === s.id);
      const inner: Record<string, number> = {};
      if (sQuotas.length > 0) {
        sQuotas.forEach((q) => {
          inner[q.role_id || "_general"] = q.quantity;
        });
      }
      const sched = schedules.find((x) => x.id === s.id);
      if (sched) prefillQuotas[sched.ministryId] = inner;
    }

    const ministryIds = group.schedules
      .map((s) => schedules.find((x) => x.id === s.id)?.ministryId)
      .filter((x): x is string => !!x);

    setCreatePrefill({
      title: group.title,
      location: group.location,
      ministryIds,
      quotas: prefillQuotas,
    });
    setShowCreate(true);
  };

  const handleOpenCreate = (open: boolean) => {
    setShowCreate(open);
    if (!open) setCreatePrefill(undefined);
  };

  const openEditFromGroup = (group: ScheduleGroup) => {
    if (!group.eventId) return;
    setEditEvent({
      id: group.eventId,
      title: group.title,
      date: group.eventDate || "",
      time: group.time,
      location: group.location || "",
    });
  };

  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-48 rounded-2xl" />
      ))}
    </div>
  );

  return (
    <ProtectedRoute>
      <AppLayout>
        <header className="px-4 md:px-6 pt-6 md:pt-8 pb-4 md:pb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Planejamento</h1>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => (mainTab === "schedules" ? setShowShareWeek(true) : setShowShareRecurring(true))}
                size={isMobile ? "icon" : "default"}
                title={mainTab === "schedules" ? "Compartilhar eventos" : "Compartilhar escalas fixas"}
              >
                <Share2 className="w-5 h-5" />
                {!isMobile && <span className="ml-2">Compartilhar escala</span>}
              </Button>
              <Button
                onClick={() => {
                  setCreatePrefill(undefined);
                  setShowCreate(true);
                }}
                size={isMobile ? "icon" : "default"}
              >
                <Plus className="w-5 h-5" />
                {!isMobile && <span className="ml-2">Nova Escala</span>}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Gerencie escalas, ministérios e confirmações da igreja</p>
        </header>

        <div className="px-4 md:px-6 mb-3">
          <div className="inline-flex bg-muted rounded-full p-1 gap-1">
            {(
              [
                { key: "recurring", label: "Escalas Fixas" },
                { key: "schedules", label: "Escala Eventos" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setMainTab(t.key)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  mainTab === t.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {mainTab === "schedules" && (
          <div className="px-4 md:px-6 mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex bg-muted rounded-full p-1 gap-1">
              {(
                [
                  { key: "upcoming", label: `Próximas (${counts.upcoming})` },
                  { key: "drafts", label: `Rascunhos (${counts.drafts})` },
                  { key: "past", label: `Passadas (${counts.past})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    statusFilter === tab.key
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-4 md:px-6 mb-4 md:mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
            {ministries.map((ministry) => (
              <button
                key={ministry}
                onClick={() => setFilter(ministry)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                  filter === ministry
                    ? "sirvo-gradient-bg text-primary-foreground shadow-sirvo"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {ministry}
              </button>
            ))}
          </div>
        </div>

        {mainTab === "recurring" && (
          <div className="px-4 md:px-6 pb-24 md:pb-6 space-y-6">
            <RecurringScheduleConfig
              churchId={churchId}
              ministryFilter={filter}
              weekday={recurringWeekday}
              onWeekdayChange={setRecurringWeekday}
            />
          </div>
        )}

        {mainTab === "schedules" && (
          <div className="px-4 md:px-6 pb-24 md:pb-6">
            {loading || churchLoading ? (
              <LoadingSkeleton />
            ) : (
              <div className="space-y-4">
                {groupSchedules(filteredSchedules).map((group, index) => (
                  <div
                    key={group.key}
                    className="animate-slide-up opacity-0 relative"
                    style={{
                      animationDelay: `${index * 0.1}s`,
                      animationFillMode: "forwards",
                    }}
                  >
                    <GroupedScheduleCard
                      group={group}
                      isAdmin={true}
                      onViewSchedule={(scheduleId) => {
                        const s = filteredSchedules.find((x) => x.id === scheduleId);
                        if (s) handleView(s);
                      }}
                      onConfirm={handleConfirm}
                      onUnavailable={(id) => handleUnavailable(id)}
                      onPublishGroup={publishSchedules}
                      onDuplicate={handleDuplicate}
                      onEdit={openEditFromGroup}
                      onRemindPending={remindPending}
                      onDelete={() => handleDeleteGroup(group)}
                    />
                  </div>
                ))}
                {filteredSchedules.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Nenhuma escala de evento encontrada</p>
                    <Button
                      onClick={() => {
                        setCreatePrefill(undefined);
                        setShowCreate(true);
                      }}
                      className="mt-4"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Criar primeira escala
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <ShareWeekDialog
          open={showShareWeek}
          onOpenChange={setShowShareWeek}
          schedules={filter === "Todas" ? schedules : schedules.filter((s) => s.ministry === filter)}
        />

        {showShareRecurring && (
          <ShareRecurringDialog
            open={showShareRecurring}
            onOpenChange={setShowShareRecurring}
            churchId={churchId}
            ministryFilter={filter}
            selectedWeekday={recurringWeekday}
          />
        )}

        <EditEventDialog
          open={!!editEvent}
          onOpenChange={(o) => !o && setEditEvent(null)}
          eventId={editEvent?.id || null}
          initialTitle={editEvent?.title}
          initialDate={editEvent?.date}
          initialTime={editEvent?.time}
          initialLocation={editEvent?.location}
          onSaved={refetch}
        />

        <ScheduleDetailDialog
          schedule={selectedSchedule}
          open={showDetail}
          onOpenChange={setShowDetail}
          onConfirm={handleConfirm}
          onUnavailable={handleUnavailable}
          onDelete={handleDeleteClick}
          isAdmin={true}
          onRefresh={refetch}
          sameEventUserIds={[]}
        />

        {churchId && (
          <CreateScheduleDialog
            open={showCreate}
            onOpenChange={handleOpenCreate}
            onSuccess={refetch}
            churchId={churchId}
            prefill={createPrefill}
          />
        )}

        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Escala</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta escala? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {isMobile && <InstallPrompt />}
      </AppLayout>
    </ProtectedRoute>
  );
};

export default Planning;
