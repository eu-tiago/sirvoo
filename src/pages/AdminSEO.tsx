import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { SEOPreview } from "@/components/admin/seo/SEOPreview";
import {
  Search, Globe, Share2, FileText, Bot, Eye, Plus, Trash2, Pencil,
  Download, Upload, Loader2, AlertTriangle, CheckCircle2, Image as ImageIcon,
} from "lucide-react";

const TITLE_MAX = 60;
const DESC_MAX = 160;

type Settings = any;
type PageRow = {
  id: string;
  path: string;
  title: string;
  description: string | null;
  h1: string | null;
  allow_indexing: boolean;
  include_in_sitemap: boolean;
  priority: number | null;
  changefreq: string | null;
};

export default function AdminSEO() {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [robots, setRobots] = useState<{ id: string; content: string } | null>(null);
  const [faqDraft, setFaqDraft] = useState<Array<{ question: string; answer: string }>>([]);
  const [uploadingOG, setUploadingOG] = useState(false);

  // Page dialog
  const [pageDialogOpen, setPageDialogOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<PageRow | null>(null);

  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!user || !isSuperAdmin) return;
    loadAll();
  }, [authLoading, roleLoading, user, isSuperAdmin]);

  async function loadAll() {
    setLoading(true);
    const [s, p, r] = await Promise.all([
      supabase.from("seo_settings").select("*").limit(1).maybeSingle(),
      supabase.from("seo_pages").select("*").order("path"),
      supabase.from("seo_robots").select("*").limit(1).maybeSingle(),
    ]);
    if (s.data) {
      setSettings(s.data);
      setFaqDraft(Array.isArray((s.data as any).faq) ? (s.data as any).faq : []);
    }
    if (p.data) setPages(p.data as PageRow[]);
    if (r.data) setRobots(r.data as any);
    setLoading(false);
  }

  if (authLoading || roleLoading) {
    return <AppLayout><div className="p-6"><Skeleton className="h-96" /></div></AppLayout>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    const payload = { ...settings, faq: faqDraft };
    delete payload.created_at;
    delete payload.updated_at;
    const { error } = await supabase
      .from("seo_settings")
      .update(payload)
      .eq("id", settings.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configurações salvas" });
    }
  }

  async function uploadOGImage(file: File) {
    if (!file) return;
    setUploadingOG(true);
    const ext = file.name.split(".").pop();
    const path = `og-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("seo-assets").upload(path, file, {
      cacheControl: "3600", upsert: false,
    });
    if (upErr) {
      setUploadingOG(false);
      toast({ title: "Erro upload", description: upErr.message, variant: "destructive" });
      return;
    }
    const { data: pub } = supabase.storage.from("seo-assets").getPublicUrl(path);
    setSettings({ ...settings, og_image_url: pub.publicUrl });
    setUploadingOG(false);
    toast({ title: "Imagem carregada", description: "Lembre de salvar." });
  }

  async function saveRobots() {
    if (!robots) return;
    const { error } = await supabase
      .from("seo_robots")
      .update({ content: robots.content })
      .eq("id", robots.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "robots.txt salvo" });
  }

  async function generateAndDownloadSitemap() {
    const baseUrl = (settings?.canonical_url || "https://sirvo.app").replace(/\/$/, "");
    const items = pages
      .filter((p) => p.include_in_sitemap && p.allow_indexing)
      .map((p) => `  <url>
    <loc>${baseUrl}${p.path}</loc>
    <changefreq>${p.changefreq || "monthly"}</changefreq>
    <priority>${p.priority ?? 0.5}</priority>
  </url>`).join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>`;
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "sitemap.xml"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "sitemap.xml baixado" });
  }

  function downloadRobots() {
    const blob = new Blob([robots?.content || ""], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "robots.txt"; a.click();
    URL.revokeObjectURL(url);
  }

  async function savePage(p: Partial<PageRow>) {
    if (!p.path || !p.title) {
      toast({ title: "Path e Título são obrigatórios", variant: "destructive" });
      return;
    }
    if (editingPage) {
      const { error } = await supabase
        .from("seo_pages").update(p).eq("id", editingPage.id);
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      const { error } = await supabase.from("seo_pages").insert(p as any);
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
    setPageDialogOpen(false); setEditingPage(null);
    await loadAll();
    toast({ title: "Página salva" });
  }

  async function deletePage(id: string) {
    if (!confirm("Remover esta página?")) return;
    const { error } = await supabase.from("seo_pages").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { await loadAll(); toast({ title: "Página removida" }); }
  }

  if (loading || !settings) {
    return <AppLayout><div className="p-6"><Skeleton className="h-96" /></div></AppLayout>;
  }

  const titleLen = settings.default_title?.length || 0;
  const descLen = settings.default_description?.length || 0;

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight">SEO Manager</h1>
            <p className="text-muted-foreground mt-1">
              Centralize todas as configurações de SEO da aplicação.
            </p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Bot className="w-3 h-3" /> Otimizado para Google + LLMs
          </Badge>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="general"><Globe className="w-4 h-4 mr-1" />Geral</TabsTrigger>
            <TabsTrigger value="og"><Share2 className="w-4 h-4 mr-1" />Open Graph</TabsTrigger>
            <TabsTrigger value="pages"><FileText className="w-4 h-4 mr-1" />Páginas</TabsTrigger>
            <TabsTrigger value="sitemap"><Search className="w-4 h-4 mr-1" />Sitemap & Robots</TabsTrigger>
            <TabsTrigger value="tracking">Tracking</TabsTrigger>
            <TabsTrigger value="ai"><Bot className="w-4 h-4 mr-1" />SEO para IA</TabsTrigger>
            <TabsTrigger value="preview"><Eye className="w-4 h-4 mr-1" />Preview</TabsTrigger>
          </TabsList>

          {/* GERAL */}
          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configurações Gerais</CardTitle>
                <CardDescription>Aplicado em toda a aplicação como padrão.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Título padrão (meta title)</Label>
                    <span className={`text-xs ${titleLen > TITLE_MAX ? "text-destructive" : "text-muted-foreground"}`}>
                      {titleLen}/{TITLE_MAX}
                    </span>
                  </div>
                  <Input
                    value={settings.default_title || ""}
                    onChange={(e) => setSettings({ ...settings, default_title: e.target.value })}
                  />
                  {titleLen > TITLE_MAX && (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3" /> Título muito longo, pode ser cortado no Google.
                    </p>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Descrição padrão (meta description)</Label>
                    <span className={`text-xs ${descLen > DESC_MAX ? "text-destructive" : "text-muted-foreground"}`}>
                      {descLen}/{DESC_MAX}
                    </span>
                  </div>
                  <Textarea
                    rows={3}
                    value={settings.default_description || ""}
                    onChange={(e) => setSettings({ ...settings, default_description: e.target.value })}
                  />
                  {descLen > DESC_MAX && (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3" /> Descrição muito longa.
                    </p>
                  )}
                </div>
                <div>
                  <Label>Palavras-chave principais</Label>
                  <Input
                    placeholder="separadas por vírgula"
                    value={settings.default_keywords || ""}
                    onChange={(e) => setSettings({ ...settings, default_keywords: e.target.value })}
                  />
                </div>
                <div>
                  <Label>URL canônica padrão</Label>
                  <Input
                    placeholder="https://sirvo.app"
                    value={settings.canonical_url || ""}
                    onChange={(e) => setSettings({ ...settings, canonical_url: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl border p-4">
                  <div>
                    <Label className="text-base">Permitir indexação</Label>
                    <p className="text-sm text-muted-foreground">
                      Quando desativado, todas as páginas recebem noindex.
                    </p>
                  </div>
                  <Switch
                    checked={settings.allow_indexing}
                    onCheckedChange={(v) => setSettings({ ...settings, allow_indexing: v })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* OPEN GRAPH */}
          <TabsContent value="og" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Open Graph / Social</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Título OG</Label>
                  <Input
                    value={settings.og_title || ""}
                    onChange={(e) => setSettings({ ...settings, og_title: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Descrição OG</Label>
                  <Textarea
                    rows={3}
                    value={settings.og_description || ""}
                    onChange={(e) => setSettings({ ...settings, og_description: e.target.value })}
                  />
                </div>
                <div>
                  <Label>URL OG</Label>
                  <Input
                    value={settings.og_url || ""}
                    onChange={(e) => setSettings({ ...settings, og_url: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Imagem OG</Label>
                  <div className="flex gap-3 items-start mt-2">
                    {settings.og_image_url ? (
                      <img src={settings.og_image_url} alt="OG" className="w-40 h-24 object-cover rounded-lg border" />
                    ) : (
                      <div className="w-40 h-24 bg-muted rounded-lg flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="space-y-2 flex-1">
                      <Input
                        type="file" accept="image/*"
                        onChange={(e) => e.target.files?.[0] && uploadOGImage(e.target.files[0])}
                        disabled={uploadingOG}
                      />
                      <Input
                        placeholder="ou cole uma URL"
                        value={settings.og_image_url || ""}
                        onChange={(e) => setSettings({ ...settings, og_image_url: e.target.value })}
                      />
                      {uploadingOG && <Loader2 className="w-4 h-4 animate-spin" />}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PÁGINAS */}
          <TabsContent value="pages" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>SEO por Página</CardTitle>
                  <CardDescription>Configure título, descrição e indexação por rota.</CardDescription>
                </div>
                <Button onClick={() => { setEditingPage(null); setPageDialogOpen(true); }}>
                  <Plus className="w-4 h-4" /> Nova página
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>URL</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Indexar</TableHead>
                      <TableHead>Sitemap</TableHead>
                      <TableHead className="w-[120px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pages.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.path}</TableCell>
                        <TableCell className="max-w-xs truncate">{p.title}</TableCell>
                        <TableCell>
                          {p.allow_indexing ? (
                            <Badge variant="outline" className="text-success border-success/30">
                              <CheckCircle2 className="w-3 h-3 mr-1" />Sim
                            </Badge>
                          ) : (<Badge variant="outline">Não</Badge>)}
                        </TableCell>
                        <TableCell>{p.include_in_sitemap ? "Sim" : "Não"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon-sm" variant="ghost" onClick={() => { setEditingPage(p); setPageDialogOpen(true); }}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="icon-sm" variant="ghost" onClick={() => deletePage(p.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SITEMAP & ROBOTS */}
          <TabsContent value="sitemap" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sitemap.xml</CardTitle>
                <CardDescription>
                  Gerado dinamicamente em <code>/sitemap.xml</code> (via edge function).
                  Inclui apenas páginas marcadas como indexáveis e que pedem inclusão no sitemap.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={generateAndDownloadSitemap}>
                  <Download className="w-4 h-4" /> Baixar sitemap.xml
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>robots.txt</CardTitle>
                <CardDescription>Conteúdo servido em <code>/robots.txt</code>.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  rows={10} className="font-mono text-sm"
                  value={robots?.content || ""}
                  onChange={(e) => robots && setRobots({ ...robots, content: e.target.value })}
                />
                <div className="flex gap-2">
                  <Button onClick={saveRobots}>Salvar robots.txt</Button>
                  <Button variant="outline" onClick={downloadRobots}>
                    <Download className="w-4 h-4" /> Baixar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TRACKING */}
          <TabsContent value="tracking" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Performance e Indexação</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Google Search Console (verification ID)</Label>
                  <Input
                    placeholder="código do meta tag de verificação"
                    value={settings.google_search_console_id || ""}
                    onChange={(e) => setSettings({ ...settings, google_search_console_id: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Google Analytics (Measurement ID)</Label>
                  <Input
                    placeholder="G-XXXXXXXXXX"
                    value={settings.google_analytics_id || ""}
                    onChange={(e) => setSettings({ ...settings, google_analytics_id: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Verificação de domínio (custom)</Label>
                  <Input
                    value={settings.domain_verification || ""}
                    onChange={(e) => setSettings({ ...settings, domain_verification: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* IA */}
          <TabsContent value="ai" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>SEO para IA (LLMs)</CardTitle>
                <CardDescription>
                  Conteúdo estruturado consumido por ChatGPT, Gemini, Perplexity, etc.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Descrição estruturada do produto</Label>
                  <Textarea
                    rows={4}
                    value={settings.product_description || ""}
                    onChange={(e) => setSettings({ ...settings, product_description: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Contexto institucional</Label>
                  <Textarea
                    rows={4}
                    value={settings.institutional_context || ""}
                    onChange={(e) => setSettings({ ...settings, institutional_context: e.target.value })}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>FAQ</Label>
                    <Button size="sm" variant="outline" onClick={() => setFaqDraft([...faqDraft, { question: "", answer: "" }])}>
                      <Plus className="w-4 h-4" /> Adicionar
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {faqDraft.map((f, i) => (
                      <div key={i} className="border rounded-xl p-3 space-y-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Pergunta"
                            value={f.question}
                            onChange={(e) => {
                              const c = [...faqDraft]; c[i] = { ...c[i], question: e.target.value }; setFaqDraft(c);
                            }}
                          />
                          <Button size="icon-sm" variant="ghost" onClick={() => setFaqDraft(faqDraft.filter((_, j) => j !== i))}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                        <Textarea
                          rows={2} placeholder="Resposta"
                          value={f.answer}
                          onChange={(e) => {
                            const c = [...faqDraft]; c[i] = { ...c[i], answer: e.target.value }; setFaqDraft(c);
                          }}
                        />
                      </div>
                    ))}
                    {faqDraft.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhuma pergunta cadastrada.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PREVIEW */}
          <TabsContent value="preview" className="space-y-4">
            <SEOPreview
              title={settings.default_title}
              description={settings.default_description}
              url={settings.canonical_url || "https://sirvo.app"}
              ogImage={settings.og_image_url}
            />
          </TabsContent>
        </Tabs>

        {/* Save bar (sticky) */}
        <div className="sticky bottom-4 z-10 flex justify-end">
          <Button size="lg" onClick={saveSettings} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Salvar configurações
          </Button>
        </div>
      </div>

      {/* Page edit dialog */}
      <PageDialog
        open={pageDialogOpen}
        onOpenChange={setPageDialogOpen}
        page={editingPage}
        onSave={savePage}
      />
    </AppLayout>
  );
}

function PageDialog({
  open, onOpenChange, page, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  page: PageRow | null;
  onSave: (p: Partial<PageRow>) => void;
}) {
  const [form, setForm] = useState<Partial<PageRow>>({});
  useEffect(() => {
    setForm(page || { path: "", title: "", description: "", h1: "", allow_indexing: true, include_in_sitemap: true, priority: 0.5, changefreq: "monthly" });
  }, [page, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{page ? "Editar página" : "Nova página"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>URL (path)</Label>
            <Input placeholder="/sobre" value={form.path || ""} onChange={(e) => setForm({ ...form, path: e.target.value })} />
          </div>
          <div>
            <Label>Meta title</Label>
            <Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label>Meta description</Label>
            <Textarea rows={2} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <Label>H1 principal</Label>
            <Input value={form.h1 || ""} onChange={(e) => setForm({ ...form, h1: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between border rounded-lg p-3">
              <Label>Indexar</Label>
              <Switch checked={!!form.allow_indexing} onCheckedChange={(v) => setForm({ ...form, allow_indexing: v })} />
            </div>
            <div className="flex items-center justify-between border rounded-lg p-3">
              <Label>No sitemap</Label>
              <Switch checked={!!form.include_in_sitemap} onCheckedChange={(v) => setForm({ ...form, include_in_sitemap: v })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSave(form)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
