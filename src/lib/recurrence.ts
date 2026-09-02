export const WEEKDAYS = [
  { value: 0, label: "Domingo", short: "Dom" },
  { value: 1, label: "Segunda-feira", short: "Seg" },
  { value: 2, label: "Terça-feira", short: "Ter" },
  { value: 3, label: "Quarta-feira", short: "Qua" },
  { value: 4, label: "Quinta-feira", short: "Qui" },
  { value: 5, label: "Sexta-feira", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
] as const;

export const OCCURRENCES = [
  { value: 1, label: "Semana 1" },
  { value: 2, label: "Semana 2" },
  { value: 3, label: "Semana 3" },
  { value: 4, label: "Semana 4" },
  { value: 5, label: "Semana 5" },
] as const;

/**
 * Ocorrência do dia da semana dentro do mês (1..5), com o domingo como corte.
 */
export function occurrenceOfMonth(date: Date): number {
  return Math.floor((date.getDate() - 1) / 7) + 1;
}

/**
 * Rodízio contínuo de 4 equipes.
 * Em meses com 5 ocorrências, a equipe da 1ª semana cobre a 5ª semana e o ciclo
 * segue deslocado no mês seguinte. Em meses com 4 semanas, o padrão se mantém.
 */
export function rotatingOccurrence(date: Date): number {
  const anchor = Date.UTC(2026, 0, 1);
  const d = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const idx = Math.floor((d - anchor) / (7 * 24 * 60 * 60 * 1000));
  return (((idx % 4) + 4) % 4) + 1;
}

/** Data do mês (year, month 0-based) em que o rodízio atinge `occurrence` para `weekday` */
export function rotatingDateInMonth(
  year: number,
  month: number,
  weekday: number,
  occurrence: number,
): Date | null {
  return occurrencesInMonth(year, month, weekday).find((d) => rotatingOccurrence(d) === occurrence) ?? null;
}


/** Todas as datas do mês (year, month 0-based) que caem em weekday */
export function occurrencesInMonth(year: number, month: number, weekday: number): Date[] {
  const out: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    if (d.getDay() === weekday) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/**
 * Data da N-ésima ocorrência de um dia da semana no mês.
 * Retorna null quando o mês não possui essa ocorrência (ex.: 5º sábado).
 */
export function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  occurrence: number
): Date | null {
  const all = occurrencesInMonth(year, month, weekday);
  return all.find((d) => occurrenceOfMonth(d) === occurrence) ?? null;
}

export function weekdayLabel(weekday: number): string {
  return WEEKDAYS.find((w) => w.value === weekday)?.label ?? "";
}

export function occurrenceLabel(occurrence: number): string {
  return OCCURRENCES.find((o) => o.value === occurrence)?.label ?? "";
}

/** Verifica se uma data corresponde à regra fixa (dia da semana + ocorrência) */
export function matchesRecurrence(date: Date, weekday: number, occurrence: number): boolean {
  return date.getDay() === weekday && occurrenceOfMonth(date) === occurrence;
}

/**
 * Próxima data (>= hoje) em que uma regra fixa (weekday + occurrence) acontece.
 * Considera o fallback da 5ª semana. Retorna null se não houver nos próximos 120 dias.
 */
export function nextRecurrenceDate(
  weekday: number,
  occurrence: number,
  from: Date = new Date(),
): Date | null {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 120; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d.getDay() !== weekday) continue;
    const occ = rotatingOccurrence(d);
    const matches = occ === occurrence || (occurrenceOfMonth(d) === 5 && occurrence === 5);
    if (matches) return d;
  }
  return null;
}
