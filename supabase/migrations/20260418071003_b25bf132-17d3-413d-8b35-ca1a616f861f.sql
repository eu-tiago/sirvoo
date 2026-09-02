-- ============ SEO SETTINGS (singleton) ============
CREATE TABLE public.seo_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- General
  default_title text NOT NULL DEFAULT 'Sirvo - Gestão de Voluntários para Igrejas',
  default_description text NOT NULL DEFAULT 'Plataforma completa para escalas, ministérios e voluntários da sua igreja.',
  default_keywords text DEFAULT 'igreja, voluntários, escalas, ministérios, gestão',
  canonical_url text DEFAULT 'https://sirvo.app',
  allow_indexing boolean NOT NULL DEFAULT true,
  -- Open Graph
  og_title text,
  og_description text,
  og_image_url text,
  og_url text,
  -- Tracking / Verification
  google_search_console_id text,
  google_analytics_id text,
  domain_verification text,
  -- AI / LLM
  product_description text,
  faq jsonb DEFAULT '[]'::jsonb,
  institutional_context text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seo_settings ENABLE ROW LEVEL SECURITY;

-- Public read (used by edge function for HTML injection / sitemap)
CREATE POLICY "Public can read SEO settings"
  ON public.seo_settings FOR SELECT
  USING (true);

-- Only super admin can write
CREATE POLICY "Super admin can insert SEO settings"
  ON public.seo_settings FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'tiagotalmud@gmail.com'
  );

CREATE POLICY "Super admin can update SEO settings"
  ON public.seo_settings FOR UPDATE TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'tiagotalmud@gmail.com'
  );

CREATE POLICY "Super admin can delete SEO settings"
  ON public.seo_settings FOR DELETE TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'tiagotalmud@gmail.com'
  );

CREATE TRIGGER set_seo_settings_updated_at
  BEFORE UPDATE ON public.seo_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SEO PAGES ============
CREATE TABLE public.seo_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  h1 text,
  allow_indexing boolean NOT NULL DEFAULT true,
  include_in_sitemap boolean NOT NULL DEFAULT true,
  priority numeric(2,1) DEFAULT 0.5,
  changefreq text DEFAULT 'monthly',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seo_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read SEO pages"
  ON public.seo_pages FOR SELECT
  USING (true);

CREATE POLICY "Super admin can insert SEO pages"
  ON public.seo_pages FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'tiagotalmud@gmail.com'
  );

CREATE POLICY "Super admin can update SEO pages"
  ON public.seo_pages FOR UPDATE TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'tiagotalmud@gmail.com'
  );

CREATE POLICY "Super admin can delete SEO pages"
  ON public.seo_pages FOR DELETE TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'tiagotalmud@gmail.com'
  );

CREATE TRIGGER set_seo_pages_updated_at
  BEFORE UPDATE ON public.seo_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SEO ROBOTS (singleton) ============
CREATE TABLE public.seo_robots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL DEFAULT 'User-agent: *
Allow: /

Sitemap: https://sirvo.app/sitemap.xml',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seo_robots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read robots"
  ON public.seo_robots FOR SELECT USING (true);

CREATE POLICY "Super admin can insert robots"
  ON public.seo_robots FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'tiagotalmud@gmail.com'
  );

CREATE POLICY "Super admin can update robots"
  ON public.seo_robots FOR UPDATE TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'tiagotalmud@gmail.com'
  );

CREATE TRIGGER set_seo_robots_updated_at
  BEFORE UPDATE ON public.seo_robots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('seo-assets', 'seo-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view SEO assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'seo-assets');

CREATE POLICY "Super admin can upload SEO assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'seo-assets'
    AND (SELECT email FROM auth.users WHERE id = auth.uid()) = 'tiagotalmud@gmail.com'
  );

CREATE POLICY "Super admin can update SEO assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'seo-assets'
    AND (SELECT email FROM auth.users WHERE id = auth.uid()) = 'tiagotalmud@gmail.com'
  );

CREATE POLICY "Super admin can delete SEO assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'seo-assets'
    AND (SELECT email FROM auth.users WHERE id = auth.uid()) = 'tiagotalmud@gmail.com'
  );

-- ============ SEED DATA ============
INSERT INTO public.seo_settings (
  default_title, default_description, default_keywords, canonical_url,
  og_title, og_description, og_url,
  product_description, institutional_context
) VALUES (
  'Sirvo - Gestão de Voluntários para Igrejas',
  'Plataforma completa para escalas, ministérios e voluntários da sua igreja. Organize equipes, gere escalas automáticas e envie lembretes.',
  'igreja, voluntários, escalas, ministérios, gestão de igreja, escalas automáticas, sirvo',
  'https://sirvo.app',
  'Sirvo - Gestão de Voluntários para Igrejas',
  'Organize voluntários, escalas e ministérios em um só lugar. Plataforma feita para igrejas.',
  'https://sirvo.app',
  'Sirvo é uma plataforma SaaS de gestão de voluntários para igrejas. Permite cadastrar ministérios, criar escalas automaticamente, controlar disponibilidade dos voluntários, gerenciar trocas e enviar lembretes por push e e-mail.',
  'Sirvo nasceu para simplificar a vida de líderes e voluntários, reduzindo o tempo gasto em planilhas e mensagens manuais. É multi-tenant, seguro e otimizado para celular.'
);

INSERT INTO public.seo_robots (content) VALUES (
  'User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /admin
Disallow: /onboarding
Disallow: /profile

Sitemap: https://sirvo.app/sitemap.xml'
);

INSERT INTO public.seo_pages (path, title, description, h1, allow_indexing, include_in_sitemap, priority, changefreq) VALUES
  ('/', 'Sirvo - Gestão de Voluntários para Igrejas', 'Plataforma completa para escalas, ministérios e voluntários.', 'Gestão de Voluntários para Igrejas', true, true, 1.0, 'weekly'),
  ('/pricing', 'Planos e Preços - Sirvo', 'Conheça os planos do Sirvo: Gratuito, Básico e Standard. Comece grátis hoje.', 'Planos e Preços', true, true, 0.9, 'monthly'),
  ('/auth', 'Entrar - Sirvo', 'Acesse sua conta Sirvo.', 'Entrar', false, false, 0.3, 'yearly'),
  ('/termos', 'Termos de Uso - Sirvo', 'Termos de uso da plataforma Sirvo.', 'Termos de Uso', true, true, 0.3, 'yearly'),
  ('/privacidade', 'Política de Privacidade - Sirvo', 'Como tratamos seus dados na plataforma Sirvo.', 'Política de Privacidade', true, true, 0.3, 'yearly'),
  ('/ajuda', 'Suporte - Sirvo', 'Central de ajuda e suporte do Sirvo.', 'Suporte', true, true, 0.5, 'monthly');