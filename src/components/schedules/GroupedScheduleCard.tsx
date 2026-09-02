import {
  Calendar,
  Clock,
  MapPin,
  ChevronRight,
  Check,
  X,
  Users,
  Copy,
  Send,
  FileText,
  Bell,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: string | null;
}

export interface ScheduleGroupItem {
  id: string;
  ministry: string;
  ministryColor: string;
  team: TeamMember[];
  userRole?: string;
  userAssignmentId?: string;
  userStatus?: string | null;
  status?: string;
  totalQuota?: number;
}

export interface ScheduleGroup {
  key: string;
  title: string;
  date: string;
  time: string;
  location?: string;
  eventId?: string;
  eventDate?: string;
  schedules: ScheduleGroupItem[];
}

interface GroupedScheduleCardProps {
  group: ScheduleGroup;
  onViewSchedule: (scheduleId: string) => void;
  onConfirm: (assignmentId: string) => void;
  onUnavailable: (assignmentId: string) => void;
  onPublishGroup?: (scheduleIds: string[]) => void;
  onDuplicate?: (group: ScheduleGroup) => void;
  onEdit?: (group: ScheduleGroup) => void;
  onDelete?: (group: ScheduleGroup) => void; // <--- Adicionado aqui
  onRemindPending?: (scheduleIds: string[]) => void;
  isAdmin?: boolean;
}

export function GroupedScheduleCard({
  group,
  onViewSchedule,
  onConfirm,
  onUnavailable,
  onPublishGroup,
  onDuplicate,
  onEdit,
  onDelete, // <--- Recebido nas props
  onRemindPending,
  isAdmin,
}: GroupedScheduleCardProps) {
  const allMembers = group.schedules.flatMap((s) => s.team);
  const confirmed = allMembers.filter((m) => m.status === "confirmed").length;
  const pending = allMembers.filter((m) => !m.status || m.status === "pending").length;
  const declined = allMembers.filter((m) => m.status === "unavailable").length;
  const totalQuota = group.schedules.reduce((acc, s) => acc + (s.totalQuota ?? s.team.length), 0);
  const openSlots = Math.max(0, totalQuota - allMembers.length);
  const userSchedules = group.schedules.filter((s) => s.userRole);
  const hasDraft = group.schedules.some((s) => s.status === "draft");
  const draftIds = group.schedules.filter((s) => s.status === "draft").map((s) => s.id);

  return (
    <div className="sirvo-card">
      {/* Event header */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-foreground truncate">{group.title}</h3>
            {hasDraft && (
              <Badge variant="outline" className="text-amber-600 border-amber-500/40 bg-amber-500/10">
                <FileText className="w-3 h-3 mr-1" /> Rascunho
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {group.date}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {group.time}
            </span>
            {group.location && (
              <span className="flex items-center gap-1.5 min-w-0">
                <MapPin className="w-4 h-4 shrink-0" />
                <span className="truncate">{group.location}</span>
              </span>
            )}
          </div>
        </div>
        {isAdmin && (onEdit || onDuplicate || onDelete) && (
          <div className="flex items-center gap-1 shrink-0">
            {onEdit && (
              <Button size="sm" variant="ghost" onClick={() => onEdit(group)} title="Editar escala">
                <Pencil className="w-4 h-4" />
              </Button>
            )}
            {onDuplicate && (
              <Button size="sm" variant="ghost" onClick={() => onDuplicate(group)} title="Duplicar escala">
                <Copy className="w-4 h-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(group)}
                title="Excluir escala de evento"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Status counters */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/10">
          <Check className="w-3 h-3 mr-1" /> {confirmed} confirmado(s)
        </Badge>
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/10">
          {pending} pendente(s)
        </Badge>
        {declined > 0 && (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/10">
            {declined} recusado(s)
          </Badge>
        )}
        {openSlots > 0 && (
          <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 hover:bg-orange-500/10">
            {openSlots} vaga(s) em aberto
          </Badge>
        )}
        <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
          <Users className="w-3 h-3" />
          {group.schedules.length} ministério(s)
        </span>
      </div>

      {/* Admin actions */}
      {isAdmin && hasDraft && onPublishGroup && (
        <div className="mb-2">
          <Button size="sm" className="w-full" onClick={() => onPublishGroup(draftIds)}>
            <Send className="w-4 h-4 mr-2" />
            Publicar e notificar voluntários
          </Button>
        </div>
      )}
      {isAdmin && !hasDraft && pending > 0 && onRemindPending && (
        <div className="mb-2">
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => onRemindPending(group.schedules.map((s) => s.id))}
          >
            <Bell className="w-4 h-4 mr-2" />
            Lembrar {pending} pendente(s)
          </Button>
        </div>
      )}

      {/* User's roles */}
      {userSchedules.length > 0 && (
        <div className="mb-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
          <p className="text-xs text-muted-foreground mb-2">Sua participação</p>
          <div className="space-y-2">
            {userSchedules.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.ministryColor }} />
                  <span className="text-sm font-semibold text-foreground truncate">{s.ministry}</span>
                  <span className="text-xs text-muted-foreground truncate">— {s.userRole}</span>
                </div>
                {s.userStatus === "pending" && s.userAssignmentId && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        onConfirm(s.userAssignmentId!);
                      }}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnavailable(s.userAssignmentId!);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                {s.userStatus === "confirmed" && (
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20 shrink-0">Confirmado</Badge>
                )}
                {s.userStatus === "unavailable" && (
                  <Badge className="bg-red-500/10 text-red-500 border-red-500/20 shrink-0">Indisponível</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ministries list */}
      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-xs text-muted-foreground mb-2">Ministérios escalados</p>
        {group.schedules.map((s) => {
          const confirmedMembers = s.team.filter((m) => m.status === "confirmed");
          const pendingMembers = s.team.filter((m) => !m.status || m.status === "pending");
          const sConfirmed = confirmedMembers.length;
          const sOpen = Math.max(0, (s.totalQuota ?? s.team.length) - s.team.length);
          const visible = sConfirmed > 0 ? confirmedMembers : pendingMembers;
          return (
            <button
              key={s.id}
              onClick={() => onViewSchedule(s.id)}
              className="w-full flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left group"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.ministryColor }} />
                <span className="text-sm font-medium text-foreground truncate">{s.ministry}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {sConfirmed > 0 ? `${sConfirmed} confirmado(s)` : `${pendingMembers.length} aguardando`}
                  {sOpen > 0 ? ` · ${sOpen} vaga(s)` : ""}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0 max-w-[60%]">
                <div className="flex flex-wrap items-center justify-end gap-1">
                  {sConfirmed > 0
                    ? visible.slice(0, 4).map((m, i) => (
                        <span
                          key={`c-${i}`}
                          className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium max-w-[160px] truncate"
                          title={m.name}
                        >
                          {m.name}
                        </span>
                      ))
                    : visible.slice(0, 4).map((m, i) => (
                        <div
                          key={`p-${i}`}
                          className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-[10px] font-bold text-primary-foreground border-2 border-card"
                          title={m.name}
                        >
                          {getInitials(m.name)}
                        </div>
                      ))}
                  {visible.length > 4 && (
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium text-muted-foreground border-2 border-card">
                      +{visible.length - 4}
                    </div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function groupSchedules<
  T extends {
    id: string;
    title: string;
    date: string;
    time: string;
    location?: string;
    ministry: string;
    ministryColor: string;
    team: TeamMember[];
    userRole?: string;
    userAssignmentId?: string;
    userStatus?: string | null;
    status?: string;
    totalQuota?: number;
    eventId?: string;
    eventDate?: string;
  },
>(schedules: T[]): ScheduleGroup[] {
  const map = new Map<string, ScheduleGroup>();
  for (const s of schedules) {
    const key = s.eventId ? `evt:${s.eventId}` : `${s.title}|${s.date}|${s.time}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        title: s.title,
        date: s.date,
        time: s.time,
        location: s.location,
        eventId: s.eventId,
        eventDate: s.eventDate,
        schedules: [],
      });
    }
    map.get(key)!.schedules.push({
      id: s.id,
      ministry: s.ministry,
      ministryColor: s.ministryColor,
      team: s.team,
      userRole: s.userRole,
      userAssignmentId: s.userAssignmentId,
      userStatus: s.userStatus,
      status: s.status,
      totalQuota: s.totalQuota,
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    const dateA = a.eventDate || a.date;
    const dateB = b.eventDate || b.date;
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    const dateCompare = dateA.localeCompare(dateB);
    if (dateCompare !== 0) return dateCompare;
    return (a.time || "").localeCompare(b.time || "");
  });
}
