import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PreviewProps {
  title: string;
  description: string;
  url: string;
  ogImage?: string | null;
}

export function SEOPreview({ title, description, url, ogImage }: PreviewProps) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Google Preview */}
      <Card>
        <CardHeader><CardTitle className="text-base">Google</CardTitle></CardHeader>
        <CardContent className="bg-card p-4 rounded-xl border">
          <div className="text-xs text-muted-foreground truncate">{url}</div>
          <div className="text-xl text-[#1a0dab] dark:text-[#8ab4f8] truncate mt-1 hover:underline cursor-pointer">
            {title || "Sem título"}
          </div>
          <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {description || "Sem descrição"}
          </div>
        </CardContent>
      </Card>

      {/* Open Graph Preview */}
      <Card>
        <CardHeader><CardTitle className="text-base">Facebook / WhatsApp</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-xl overflow-hidden border">
            {ogImage ? (
              <img src={ogImage} alt="OG" className="w-full h-40 object-cover" />
            ) : (
              <div className="w-full h-40 bg-muted flex items-center justify-center text-muted-foreground text-sm">
                Sem imagem OG
              </div>
            )}
            <div className="p-3 bg-muted/30">
              <div className="text-[11px] uppercase text-muted-foreground truncate">{url}</div>
              <div className="font-bold text-sm mt-1 truncate">{title || "Sem título"}</div>
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{description || "Sem descrição"}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
