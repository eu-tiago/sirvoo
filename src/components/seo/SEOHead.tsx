import { Helmet } from "react-helmet-async";
import { useSEOSettings, useSEOPage } from "@/hooks/useSEO";

interface SEOHeadProps {
  path: string;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

/**
 * Injects per-page meta tags using settings from the database.
 * Falls back gracefully when no DB row exists.
 */
export function SEOHead({ path, fallbackTitle, fallbackDescription }: SEOHeadProps) {
  const { settings } = useSEOSettings();
  const page = useSEOPage(path);

  const title = page?.title || fallbackTitle || settings?.default_title || "Sirvo";
  const description =
    page?.description || fallbackDescription || settings?.default_description || "";
  const canonical = `${settings?.canonical_url || "https://sirvo.app"}${path === "/" ? "" : path}`;
  const indexable = (page?.allow_indexing ?? true) && (settings?.allow_indexing ?? true);

  const ogTitle = settings?.og_title || title;
  const ogDescription = settings?.og_description || description;
  const ogImage = settings?.og_image_url;

  // Build LLM-friendly structured data
  const structuredData: any = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings?.default_title || "Sirvo",
    url: settings?.canonical_url || "https://sirvo.app",
    description: settings?.product_description || description,
  };

  const faqStructured = settings?.faq && settings.faq.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: settings.faq.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  } : null;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {settings?.default_keywords && (
        <meta name="keywords" content={settings.default_keywords} />
      )}
      <link rel="canonical" href={canonical} />
      <meta name="robots" content={indexable ? "index, follow" : "noindex, nofollow"} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={ogTitle} />
      <meta property="og:description" content={ogDescription} />
      <meta property="og:url" content={settings?.og_url || canonical} />
      {ogImage && <meta property="og:image" content={ogImage} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={ogTitle} />
      <meta name="twitter:description" content={ogDescription} />
      {ogImage && <meta name="twitter:image" content={ogImage} />}

      {/* Verification */}
      {settings?.google_search_console_id && (
        <meta name="google-site-verification" content={settings.google_search_console_id} />
      )}
      {settings?.domain_verification && (
        <meta name="verification" content={settings.domain_verification} />
      )}

      {/* Google Analytics */}
      {settings?.google_analytics_id && (
        <>
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${settings.google_analytics_id}`} />
          <script>{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${settings.google_analytics_id}');
          `}</script>
        </>
      )}

      {/* Structured Data */}
      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      {faqStructured && (
        <script type="application/ld+json">{JSON.stringify(faqStructured)}</script>
      )}
    </Helmet>
  );
}
