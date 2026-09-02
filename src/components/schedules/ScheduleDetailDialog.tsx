import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, MapPin, Check, X, Trash2, Edit, ArrowLeftRight, Music, Plus, Link, ExternalLink, AlertTriangle, UserPlus } from "lucide-react";
import { useSwapRequest } from "@/hooks/useSwapRequest";
import { SwapRequestDialog } from "./SwapRequestDialog";
import { ManageScheduleMembers } from "./ManageScheduleMembers";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getInitials } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  status: string | null;
  userId?: string;
  originalUserId?: string | null;
  originalName?: string;
  substitutionStatus?: string | null;
  substitutionReason?: string | null;
}

interface Song {
  id: string;
  title: string;
  youtube_url?: string;
  chord_url?: string;
  notes?: string;
}

interface ScheduleDetailProps {
  schedule: {
    id: string;
    title: string;
    date: string;
    time: string;
    location?: string;
    ministry: string;
    ministryId: string;
    ministryColor: string;
    team: TeamMember[];
    userRole?: string;
    userAssignmentId?: string;
    userStatus?: string | null;
    status?: string;
    totalQuota?: number;
    eventId?: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (assignmentId: string) => void;
  onUnavailable: (assignmentId: string, reason?: string) => void;
  onDelete?: (scheduleId: string) => void;
  onEdit?: (schedule: any) => void;
  isAdmin?: boolean;
  onRefresh?: () => void;
  sameEventUserIds?: string[];
}

const isWorshipMinistry = (name: string) => {
  const n = name.toLowerCase();
  return n.includes("louvor") || n.includes("worship") || n.includes("música") || n.includes("musica") || n.includes("ministr");
};

export function ScheduleDetailDialog({
  schedule,
  open,
  onOpenChange,
  onConfirm,
  onUnavailable,
  onDelete,
  onEdit,
  isAdmin,
  onRefresh,
  sameEventUserIds = [],
}: ScheduleDetailProps) {
  const { toast } = useToast();
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [showManageMembers, setShowManageMembers] = useState(false);
  const { availableUsers, loading, swapping, fetchAvailableUsers, requestSwap } = useSwapRequest();
  const [songs, setSongs] = useState<Song[]>([]);
  const [showAddSong, setShowAddSong] = useState(false);
  const [newSong, setNewSong] = useState({ title: "", youtube_url: "", chord_url: "", notes: "" });
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);
  const [showUnavailDialog, setShowUnavailDialog] = useState(false);
  const [unavailReason, setUnavailReason] = useState("");
  const [approving, setApproving] = useState<TeamMember | null>(null);
  const [candidates, setCandidates] = useState<{ id: string; name: string }[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [savingSub, setSavingSub] = useState(false);

  const openApprove = async (member: TeamMember) => {
    if (!schedule) return;
    setApproving(member);
    setCandidatesLoading(true);
    try {
      const { data: mm } = await supabase
        .from("ministry_members")
        .select("user_id")
        .eq("ministry_id", schedule.ministryId);
      const taken = new Set(schedule.team.map((t) => t.userId).filter(Boolean) as string[]);
      const ids = (mm || []).map((m: any) => m.user_id).filter((id: string) => !taken.has(id));
      if (ids.length === 0) {
        setCandidates([]);
        return;
      }
      const { data: profiles } = await (supabase as any)
        .from("safe_profiles")
        .select("id, full_name")
        .in("id", ids);
      setCandidates(
        ((profiles || []) as any[])
          .map((p) => ({ id: p.id, name: p.full_name || "Sem nome" }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } finally {
      setCandidatesLoading(false);
    }
  };

  const approveSubstitution = async (replacementId: string) => {
    if (!approving) return;
    setSavingSub(true);
    try {
      const { error } = await supabase
        .from("schedule_assignments")
        .update({
          user_id: replacementId,
          original_user_id: approving.originalUserId || approving.userId,
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          substitution_status: "approved",
        })
        .eq("id", approving.id);
      if (error) throw error;
      toast({ title: "Substituição aprovada" });
      setApproving(null);
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Erro ao aprovar", description: e.message, variant: "destructive" });
    } finally {
      setSavingSub(false);
    }
  };

  const rejectSubstitution = async (member: TeamMember) => {
    const { error } = await supabase
      .from("schedule_assignments")
      .update({ substitution_status: "rejected" })
      .eq("id", member.id);
    if (error) {
      toast({ title: "Erro ao recusar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Substituição recusada" });
    onRefresh?.();
  };

  const showMusicSection = schedule && isWorshipMinistry(schedule.ministry);
  const openSlots = schedule ? Math.max(0, (schedule.totalQuota ?? schedule.team.length) - schedule.team.length) : 0;

  useEffect(() => {
    if (open && schedule && showMusicSection) {
      fetchSongs();
    }
  }, [open, schedule?.id, showMusicSection]);

  const fetchSongs = async () => {
    if (!schedule) return;
    const { data } = await supabase
      .from("schedule_songs")
      .select("*")
      .eq("schedule_id", schedule.id)
      .order("sort_order");
    if (data) setSongs(data);
  };

  const handleAddSong = async () => {
    if (!schedule || !newSong.title.trim()) return;
    const { error } = await supabase
      .from("schedule_songs")
      .insert({
        schedule_id: schedule.id,
        title: newSong.title.trim(),
        youtube_url: newSong.youtube_url.trim() || null,
        chord_url: newSong.chord_url.trim() || null,
        notes: newSong.notes.trim() || null,
        sort_order: songs.length,
      });
    if (error) {
      toast({ title: "Erro ao adicionar música", description: error.message, variant: "destructive" });
    } else {
      setNewSong({ title: "", youtube_url: "", chord_url: "", notes: "" });
      setShowAddSong(false);
      fetchSongs();
    }
  };

  const handleDeleteSong = async (songId: string) => {
    const { error } = await supabase.from("schedule_songs").delete().eq("id", songId);
    if (!error) fetchSongs();
  };

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;
    await supabase.from("schedule_assignments").delete().eq("id", memberToRemove.id);
    setMemberToRemove(null);
    onRefresh?.();
  };

  if (!schedule) return null;

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Confirmado</Badge>;
      case "pending_swap":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Troca Pendente</Badge>;
      case "unavailable":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Indisponível</Badge>;
      default:
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Pendente</Badge>;
    }
  };

  const handleSwapRequest = async () => {
    if (!schedule.ministryId) return;
    await fetchAvailableUsers(schedule.id, schedule.ministryId);
    setShowSwapDialog(true);
  };

  const handleRequestSwap = async (targetUserId: string, targetUserName: string) => {
    if (!schedule.userAssignmentId) return;
    const success = await requestSwap(
      schedule.userAssignmentId,
      schedule.id,
      targetUserId,
      targetUserName,
      `${schedule.title} - ${schedule.date}`
    );
    if (success) {
      setShowSwapDialog(false);
      onOpenChange(false);
      onRefresh?.();
    }
  };

  const handleConfirmUnavail = () => {
    if (schedule.userAssignmentId) {
      onUnavailable(schedule.userAssignmentId, unavailReason || undefined);
      setShowUnavailDialog(false);
      setUnavailReason("");
    }
  };

  const canRequestSwap = schedule.userRole &&
    schedule.userAssignmentId &&
    schedule.userStatus !== "pending_swap" &&
    schedule.userStatus !== "unavailable";

  const unavailableCount = schedule.team.filter((m) => m.status === "unavailable").length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: schedule.ministryColor }}
              />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {schedule.ministry}
              </span>
              {schedule.status === "draft" && (
                <Badge variant="outline" className="text-amber-600 border-amber-500/40 bg-amber-500/10 ml-auto">
                  Rascunho
                </Badge>
              )}
            </div>
            <DialogTitle className="text-xl">{schedule.title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>{schedule.date}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{schedule.time}</span>
              </div>
              {schedule.location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground col-span-2">
                  <MapPin className="w-4 h-4" />
                  <span>{schedule.location}</span>
                </div>
              )}
            </div>

            {/* Open slots / substitution alert */}
            {isAdmin && (openSlots > 0 || unavailableCount > 0) && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-amber-700 dark:text-amber-400">
                    Substituição necessária
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {openSlots > 0 && `${openSlots} vaga(s) em aberto. `}
                    {unavailableCount > 0 && `${unavailableCount} pessoa(s) indisponível(is).`}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowManageMembers(true)}>
                  <UserPlus className="w-3 h-3 mr-1" /> Escalar
                </Button>
              </div>
            )}

            {/* User Role */}
            {schedule.userRole && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-xs text-muted-foreground mb-1">Sua função</p>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-primary">{schedule.userRole}</p>
                  {getStatusBadge(schedule.userStatus || null)}
                </div>
              </div>
            )}

            {/* Team */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-foreground">
                  Equipe ({schedule.team.length}{schedule.totalQuota ? `/${schedule.totalQuota}` : ""})
                </p>
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => setShowManageMembers(!showManageMembers)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Gerenciar
                  </Button>
                )}
              </div>

              {showManageMembers && isAdmin && (
                <ManageScheduleMembers
                  scheduleId={schedule.id}
                  ministryId={schedule.ministryId}
                  currentTeam={schedule.team}
                  sameEventUserIds={sameEventUserIds}
                  onUpdate={() => {
                    setShowManageMembers(false);
                    onRefresh?.();
                  }}
                />
              )}

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {schedule.team.map((member) => (
                  <div
                    key={member.id}
                    className="p-3 rounded-lg bg-muted/50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-primary-foreground" title={member.name}>
                          {getInitials(member.name)}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-foreground">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{member.role}</p>
                          {member.substitutionStatus === "approved" &&
                            member.originalName &&
                            member.originalUserId !== member.userId && (
                              <p className="text-xs text-muted-foreground">
                                Substituto — original: {member.originalName}
                              </p>
                            )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {member.substitutionStatus === "pending" ? (
                          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                            Substituição pendente
                          </Badge>
                        ) : (
                          getStatusBadge(member.status)
                        )}
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive h-7 w-7 p-0"
                            onClick={() => setMemberToRemove({ id: member.id, name: member.name })}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {member.substitutionStatus === "pending" && (
                      <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-2">
                        {member.substitutionReason && (
                          <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
                            Motivo: {member.substitutionReason}
                          </p>
                        )}
                        {isAdmin && (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => openApprove(member)}>
                              <Check className="w-3 h-3 mr-1" /> Aprovar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => rejectSubstitution(member)}>
                              <X className="w-3 h-3 mr-1" /> Recusar
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Songs - only for worship ministries */}
            {showMusicSection && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Music className="w-4 h-4" />
                    Músicas ({songs.length})
                  </p>
                  {isAdmin && (
                    <Button size="sm" variant="ghost" onClick={() => setShowAddSong(!showAddSong)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {showAddSong && (
                  <div className="space-y-2 p-3 rounded-lg border border-border mb-3">
                    <Input placeholder="Nome da música" value={newSong.title} onChange={(e) => setNewSong(s => ({ ...s, title: e.target.value }))} />
                    <Input placeholder="Link do YouTube (opcional)" value={newSong.youtube_url} onChange={(e) => setNewSong(s => ({ ...s, youtube_url: e.target.value }))} />
                    <Input placeholder="Link da cifra (opcional)" value={newSong.chord_url} onChange={(e) => setNewSong(s => ({ ...s, chord_url: e.target.value }))} />
                    <Input placeholder="Observação (opcional)" value={newSong.notes} onChange={(e) => setNewSong(s => ({ ...s, notes: e.target.value }))} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddSong} disabled={!newSong.title.trim()}>Adicionar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowAddSong(false)}>Cancelar</Button>
                    </div>
                  </div>
                )}

                {songs.length > 0 ? (
                  <div className="space-y-2">
                    {songs.map((song) => (
                      <div key={song.id} className="p-3 rounded-lg bg-muted/50">
                        <div className="flex items-start justify-between">
                          <p className="font-medium text-sm">{song.title}</p>
                          {isAdmin && (
                            <Button size="sm" variant="ghost" className="text-destructive h-6 w-6 p-0" onClick={() => handleDeleteSong(song.id)}>
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        {song.notes && <p className="text-xs text-muted-foreground mt-1">{song.notes}</p>}
                        <div className="flex gap-3 mt-2">
                          {song.youtube_url && (
                            <a href={song.youtube_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                              <ExternalLink className="w-3 h-3" /> YouTube
                            </a>
                          )}
                          {song.chord_url && (
                            <a href={song.chord_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                              <Link className="w-3 h-3" /> Cifra
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  !showAddSong && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nenhuma música adicionada
                    </p>
                  )
                )}
              </div>
            )}

            {/* User Actions */}
            {schedule.userAssignmentId && schedule.userStatus === "pending" && (
              <div className="flex gap-3 pt-4 border-t border-border">
                <Button onClick={() => onConfirm(schedule.userAssignmentId!)} className="flex-1">
                  <Check className="w-4 h-4 mr-2" />
                  Confirmar
                </Button>
                <Button variant="outline" onClick={() => setShowUnavailDialog(true)} className="flex-1">
                  <X className="w-4 h-4 mr-2" />
                  Não posso
                </Button>
              </div>
            )}

            {canRequestSwap && (
              <div className="pt-4 border-t border-border">
                <Button variant="outline" onClick={handleSwapRequest} className="w-full">
                  <ArrowLeftRight className="w-4 h-4 mr-2" />
                  Solicitar Troca
                </Button>
              </div>
            )}

            {isAdmin && (
              <div className="flex gap-3 pt-4 border-t border-border">
                {onEdit && (
                  <Button variant="outline" onClick={() => onEdit(schedule)} className="flex-1">
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                )}
                {onDelete && (
                  <Button variant="destructive" onClick={() => onDelete(schedule.id)} className="flex-1">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SwapRequestDialog
        open={showSwapDialog}
        onOpenChange={setShowSwapDialog}
        availableUsers={availableUsers}
        loading={loading}
        swapping={swapping}
        onRequestSwap={handleRequestSwap}
      />

      {/* Remove member confirmation */}
      <AlertDialog open={!!memberToRemove} onOpenChange={(o) => !o && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover da escala?</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToRemove?.name} será removido(a) desta escala. Esta ação pode ser desfeita re-adicionando o voluntário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveMember}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unavailable with reason */}
      <Dialog open={showUnavailDialog} onOpenChange={setShowUnavailDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Não posso participar</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-sm">Motivo (opcional)</Label>
            <Textarea
              value={unavailReason}
              onChange={(e) => setUnavailReason(e.target.value)}
              placeholder="Ex: viagem, compromisso pessoal..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              O líder será notificado para escalar um substituto.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowUnavailDialog(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleConfirmUnavail} className="flex-1">
                Confirmar
              </Button>
            </div>
          </div>
      </DialogContent>
      </Dialog>

      {/* Aprovar substituição — escolher substituto */}
      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escolher substituto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {approving?.name} não poderá participar
              {approving?.substitutionReason ? `: ${approving.substitutionReason}` : "."}
            </p>
            {candidatesLoading ? (
              <p className="text-sm text-muted-foreground">Carregando candidatos...</p>
            ) : candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum voluntário disponível neste ministério.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2">
                {candidates.map((c) => (
                  <button
                    key={c.id}
                    disabled={savingSub}
                    onClick={() => approveSubstitution(c.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted transition-colors text-left disabled:opacity-50"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                      {getInitials(c.name)}
                    </div>
                    <span className="text-sm font-medium text-foreground">{c.name}</span>
                  </button>
                ))}
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={() => setApproving(null)}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
