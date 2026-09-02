import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SEOSettings {
  id: string;
  default_title: string;
  default_description: string;
  default_keywords: string | null;
  canonical_url: string | null;
  allow_indexing: boolean;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  og_url: string | null;
  google_search_console_id: string | null;
  google_analytics_id: string | null;
  domain_verification: string | null;
  product_description: string | null;
  faq: Array<{ question: string; answer: string }>;
  institutional_context: string | null;
}

export interface SEOPage {
  id: string;
  path: string;
  title: string;
  description: string | null;
  h1: string | null;
  allow_indexing: boolean;
  include_in_sitemap: boolean;
  priority: number | null;
  changefreq: string | null;
}

export function useSEOSettings() {
  const [settings, setSettings] = useState<SEOSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("seo_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (data) {
        setSettings({
          ...data,
          faq: Array.isArray((data as any).faq) ? (data as any).faq : [],
        } as SEOSettings);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  return { settings, loading, setSettings };
}

export function useSEOPage(path: string) {
  const [page, setPage] = useState<SEOPage | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("seo_pages")
        .select("*")
        .eq("path", path)
        .maybeSingle();
      if (active && data) setPage(data as SEOPage);
    })();
    return () => { active = false; };
  }, [path]);

  return page;
}
