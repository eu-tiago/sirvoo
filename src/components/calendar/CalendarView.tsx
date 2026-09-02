import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";

interface CalendarEvent {
  id: string;
  date: Date;
  title: string;
  ministry: string;
  color: string;
}

interface CalendarViewProps {
  events: CalendarEvent[];
  onDateClick?: (date: Date) => void;
  selectedDate?: Date;
}

export function CalendarView({ events, onDateClick, selectedDate }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const rows = [];
  let days = [];
  let day = startDate;

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      const dayEvents = events.filter((e) => isSameDay(e.date, day));
      const currentDay = day;

      days.push(
        <button
          key={day.toString()}
          onClick={() => onDateClick?.(currentDay)}
          className={`
            relative aspect-square p-1 flex flex-col items-center justify-start rounded-xl transition-all duration-200
            ${!isSameMonth(day, monthStart) ? "opacity-30" : ""}
            ${isToday(day) ? "bg-primary/10" : "hover:bg-muted"}
            ${selectedDate && isSameDay(day, selectedDate) ? "ring-2 ring-primary" : ""}
          `}
        >
          <span
            className={`
              text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
              ${isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground"}
            `}
          >
            {format(day, "d")}
          </span>
          {dayEvents.length > 0 && (
            <div className="flex gap-0.5 mt-1">
              {dayEvents.slice(0, 3).map((event) => (
                <div
                  key={event.id}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: event.color }}
                />
              ))}
            </div>
          )}
        </button>
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div key={day.toString()} className="grid grid-cols-7 gap-1">
        {days}
      </div>
    );
    days = [];
  }

  return (
    <div className="sirvo-card">
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-lg font-bold text-foreground capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((weekDay) => (
          <div
            key={weekDay}
            className="text-xs font-medium text-muted-foreground text-center py-2"
          >
            {weekDay}
          </div>
        ))}
      </div>

      <div className="space-y-1">{rows}</div>
    </div>
  );
}
