import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { CalendarView } from "@/components/calendar/CalendarView";
import { format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, MapPin, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useChurchId } from "@/hooks/useChurchId";
import { Skeleton } from "@/components/ui/skeleton";
import { DayScheduleList } from "@/components/calendar/DayScheduleList";
import { smartTitle, getWeekdayFromDateString } from "@/lib/scheduleLabel";


interface CalendarEventData {
  id: string;
  date: Date;
  title: string;
  ministry: string;
  color: string;
  time: string;
  location: string;
  team: number;
}

const CalendarPage = () => {
  const { churchId } = useChurchId();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [events, setEvents] = useState<CalendarEventData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (churchId) fetchEvents();
  }, [churchId]);

  const fetchEvents = async () => {
    if (!churchId) return;
    setLoading(true);
    try {
      // Fetch events with their schedules and ministry info
      const { data: eventsData } = await supabase
        .from("events")
        .select(`
          id,
          title,
          event_date,
          start_time,
          description,
          schedules (
            id,
            ministry_id,
            ministries (name, color),
            schedule_assignments (id)
          )
        `)
        .eq("church_id", churchId)
        .order("event_date", { ascending: true });

      if (!eventsData) {
        setEvents([]);
        return;
      }

      const transformed: CalendarEventData[] = eventsData.map((e: any) => {
        const schedule = e.schedules?.[0];
        const ministry = schedule?.ministries;
        const teamCount = schedule?.schedule_assignments?.length || 0;

        return {
          id: e.id,
          date: parseISO(e.event_date),
          title: smartTitle(e.title, getWeekdayFromDateString(e.event_date), e.start_time),
          ministry: ministry?.name || "Sem ministério",
          color: ministry?.color || "#5B7BFF",
          time: e.start_time?.slice(0, 5) || "",
          location: e.description || "",
          team: teamCount,
        };
      });

      setEvents(transformed);
    } catch (err) {
      console.error("Error fetching calendar events:", err);
    } finally {
      setLoading(false);
    }
  };

  const selectedEvents = selectedDate
    ? events.filter((e) => isSameDay(e.date, selectedDate))
    : [];

  return (
    <ProtectedRoute>
      <AppLayout>
        <header className="px-4 md:px-6 pt-6 md:pt-8 pb-4 md:pb-6">
          <h1 className="text-xl md:text-2xl font-bold text-foreground mb-1">Agenda</h1>
          <p className="text-sm text-muted-foreground">
            Eventos e escalas da sua igreja
          </p>
        </header>

        <div className="px-4 md:px-6 space-y-6 pb-24 md:pb-6">
          {loading ? (
            <Skeleton className="h-80 rounded-2xl" />
          ) : (
            <CalendarView
              events={events}
              selectedDate={selectedDate}
              onDateClick={setSelectedDate}
            />
          )}

          {/* Selected Date Events */}
          {selectedDate && (
            <div className="animate-slide-up">
              <h2 className="text-lg font-bold text-foreground mb-4">
                {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
              </h2>

              <DayScheduleList churchId={churchId} date={selectedDate} />
            </div>
          )}


          {!loading && events.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                Nenhum evento cadastrado. Crie uma escala para que os eventos apareçam aqui.
              </p>
            </div>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
};

export default CalendarPage;
