import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const { data: settings } = await supabase
      .from("seo_settings")
      .select("canonical_url")
      .limit(1)
      .maybeSingle();

    const baseUrl = (settings?.canonical_url || "https://sirvo.app").replace(/\/$/, "");

    const { data: pages } = await supabase
      .from("seo_pages")
      .select("path, priority, changefreq, updated_at, include_in_sitemap, allow_indexing")
      .eq("include_in_sitemap", true)
      .eq("allow_indexing", true);

    const urls = (pages || []).map((p: any) => {
      const lastmod = new Date(p.updated_at).toISOString().split("T")[0];
      return `  <url>
    <loc>${baseUrl}${p.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${p.changefreq || "monthly"}</changefreq>
    <priority>${p.priority ?? 0.5}</priority>
  </url>`;
    }).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

    return new Response(xml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml; charset=utf-8" },
    });
  } catch (err) {
    return new Response(`Error: ${(err as Error).message}`, {
      status: 500,
      headers: corsHeaders,
    });
  }
});
