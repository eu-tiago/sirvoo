# Escalas Fixas Recorrentes

Evolução do módulo de escalas atual: adicionar "escalas fixas" (voluntário + ministério + função + dia da semana + ocorrência no mês), sem recriar nada do que já existe.

## Como vai funcionar

1. **Cadastro da escala fixa** — nova aba "Escalas Fixas" dentro do Planejamento (área do líder/admin), com um formulário simples: voluntário, ministério, função (opcional), dia da semana, ocorrência (1ª a 5ª) e período de validade (início/fim opcionais).
2. **Geração automática** — sempre que existir um evento na igreja cujo dia bata com a regra (ex.: 1º sábado), o voluntário é incluído automaticamente na escala daquele ministério, com status "pendente" como qualquer outra escalação. A 5ª ocorrência só gera quando o mês realmente tem 5 daquele dia.
3. **Calendário/Agenda e cards** — as escalações vindas de escala fixa recebem um selo "Fixa" para diferenciar das manuais. Nada muda no visual geral.
4. **Trocas** — a troca passa a valer só para aquela data: o responsável original fica registrado e o card mostra "João → substituto Carlos". A escala fixa não é alterada, então no mês seguinte João volta a aparecer normalmente.
5. **Duplicidade** — regra única no banco impede duas escalas fixas iguais (mesmo voluntário, ministério, função, dia e ocorrência); ao repetir, o registro existente é atualizado.
6. **Dados atuais** — nada é apagado nem migrado. Escalas e escalações existentes continuam exatamente como estão; a recorrência é uma camada nova por cima.

## Detalhes técnicos

**Banco (migração aditiva)**
- Nova tabela `recurring_assignments`: `church_id`, `ministry_id`, `user_id`, `role_id` (nullable), `weekday` (0-6), `occurrence` (1-5), `start_date`, `end_date`, `active`, timestamps. GRANTs + RLS (leitura para membros da igreja; escrita para admin/líder da igreja). Índice único em `(church_id, ministry_id, user_id, coalesce(role_id,...), weekday, occurrence)`.
- `schedule_assignments`: colunas novas `recurring_id uuid` (origem) e `original_user_id uuid` (responsável original). Trigger preenche `original_user_id = user_id` no insert quando nulo.
- Função `public.occurrence_of_month(d date) → int` (ordem da ocorrência do dia da semana no mês).
- Função `public.apply_recurring_assignments(_schedule_id uuid)` (SECURITY DEFINER): dado um schedule, calcula weekday/ocorrência da data do evento e insere as escalações fixas correspondentes que ainda não existem (idempotente, respeita validade e indisponibilidade registrada em `volunteer_availability`).
- Trigger `AFTER INSERT ON schedules` chamando essa função; trigger em `events` para reprocessar quando a data do evento muda.
- RPC `sync_recurring_for_range(_church_id, _from date, _to date)` para aplicar às escalas já existentes de um período (botão "Sincronizar mês").

**Frontend**
- `src/hooks/useRecurringAssignments.ts` — CRUD da nova tabela.
- `src/components/schedules/RecurringAssignmentsPanel.tsx` + `RecurringAssignmentDialog.tsx` — lista e formulário, reaproveitando os componentes de UI atuais.
- `src/pages/Planning.tsx` — nova aba "Escalas Fixas" ao lado de Próximas/Rascunhos/Passadas, sem mexer no restante.
- `src/hooks/useSchedules.ts` — passa a trazer `recurring_id` e `original_user_id` no time.
- `GroupedScheduleCard.tsx` / `ScheduleDetailDialog.tsx` — selo "Fixa" e exibição "Original → Substituto".
- `useSwapRequests.ts` (acceptSwap) — mantém `original_user_id`, altera só a ocorrência.
- `src/lib/recurrence.ts` — helpers de ocorrência/dia da semana usados também no calendário.

**Validação**: testes com um mês de 4 sábados e outro de 5 sábados, além de domingos, confirmando geração correta e ausência da 5ª quando não existe.
