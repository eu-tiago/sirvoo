CREATE UNIQUE INDEX IF NOT EXISTS churches_unique_name_idx
  ON public.churches (lower(btrim(name)));