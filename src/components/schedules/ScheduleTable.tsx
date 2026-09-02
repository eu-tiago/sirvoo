import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Eye, Trash2, Edit } from "lucide-react";
import { getInitials } from "@/lib/utils";


interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: string | null;
}

interface Schedule {
  id: string;
  title: string;
  date: string;
  time: string;
  ministry: string;
  ministryColor: string;
  team: TeamMember[];
  userRole?: string;
  userAssignmentId?: string;
  userStatus?: string | null;
}

interface ScheduleTableProps {
  schedules: Schedule[];
  onView: (schedule: Schedule) => void;
  onConfirm: (assignmentId: string) => void;
  onUnavailable: (assignmentId: string) => void;
  onDelete?: (scheduleId: string) => void;
  onEdit?: (schedule: Schedule) => void;
  isAdmin?: boolean;
}

export function ScheduleTable({
  schedules,
  onView,
  onConfirm,
  onUnavailable,
  onDelete,
  onEdit,
  isAdmin,
}: ScheduleTableProps) {
  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Confirmado</Badge>;
      case "unavailable":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Indisponível</Badge>;
      default:
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Pendente</Badge>;
    }
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Evento</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Horário</TableHead>
            <TableHead>Ministério</TableHead>
            <TableHead>Sua Função</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Equipe</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedules.map((schedule) => (
            <TableRow key={schedule.id} className="hover:bg-muted/30">
              <TableCell className="font-medium">{schedule.title}</TableCell>
              <TableCell>{schedule.date}</TableCell>
              <TableCell>{schedule.time}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: schedule.ministryColor }}
                  />
                  {schedule.ministry}
                </div>
              </TableCell>
              <TableCell>{schedule.userRole || "-"}</TableCell>
              <TableCell>
                {schedule.userRole ? getStatusBadge(schedule.userStatus || null) : "-"}
              </TableCell>
              <TableCell>
                <div className="flex -space-x-2">
                  {schedule.team.slice(0, 4).map((member, i) => (
                    <div
                      key={i}
                      className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-[10px] font-bold text-primary-foreground border-2 border-card"
                      title={member.name}
                    >
                      {getInitials(member.name)}
                    </div>
                  ))}
                  {schedule.team.length > 4 && (
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground border-2 border-card">
                      +{schedule.team.length - 4}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onView(schedule)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  {schedule.userAssignmentId && schedule.userStatus === "pending" && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => onConfirm(schedule.userAssignmentId!)}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => onUnavailable(schedule.userAssignmentId!)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                  {isAdmin && onEdit && (
                    <Button size="sm" variant="ghost" onClick={() => onEdit(schedule)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  )}
                  {isAdmin && onDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onDelete(schedule.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {schedules.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                Nenhuma escala encontrada
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
