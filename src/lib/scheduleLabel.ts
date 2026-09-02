// Nomes inteligentes para escalas com base no dia da semana e horário.
// Domingo AM -> "Domingo - Manhã" | Domingo PM -> "Domingo - Noite"
// Sábado -> "Culto de Jovens"

export function getSmartScheduleLabel(
  weekday: number | null | undefined,
  time?: string | null,
): string | null {
  if (weekday === null || weekday === undefined || Number.isNaN(weekday)) return null;

  const hour = parseInt((time || "").slice(0, 2), 10);
  const isMorning = Number.isNaN(hour) ? true : hour < 12;

  if (weekday === 0) return isMorning ? "Domingo - Manhã" : "Domingo - Noite";
  if (weekday === 6) return "Culto de Jovens";
  return null;
}

export function getWeekdayFromDateString(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("T")[0].split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getDay();
}

// Aplica o nome inteligente apenas quando o título é automático ("Escala ...").
export function smartTitle(
  currentTitle: string,
  weekday: number | null | undefined,
  time?: string | null,
): string {
  const isAuto = !currentTitle || /^escala\b/i.test(currentTitle.trim());
  if (!isAuto) return currentTitle;
  return getSmartScheduleLabel(weekday, time) || currentTitle;
}
