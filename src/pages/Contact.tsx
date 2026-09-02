import { useState } from "react";
import { z } from "zod";
import { LandingNav } from "@/components/landing/LandingNav";
import { Footer } from "@/components/landing/Footer";
import { SEOHead } from "@/components/seo/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, MessageSquare, Clock, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(100, "Nome muito longo"),
  email: z.string().trim().email("E-mail inválido").max(255, "E-mail muito longo"),
  phone: z.string().trim().max(30, "Telefone muito longo").optional(),
  subject: z.string().trim().min(3, "Informe o assunto").max(150, "Assunto muito longo"),
  message: z.string().trim().min(10, "Escreva ao menos 10 caracteres").max(2000, "Mensagem muito longa"),
});

const Contact = () => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });

  const update = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Verifique os dados do formulário");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "contact-message",
          recipientEmail: "suporte@sirvo.app",
          idempotencyKey: `contact-${parsed.data.email}-${Date.now()}`,
          templateData: parsed.data,
        },
      });
      if (error) throw error;
      toast.success("Mensagem enviada! Responderemos em breve.");
      setForm({ name: "", email: "", phone: "", subject: "", message: "" });
    } catch (err) {
      console.error("Erro ao enviar contato:", err);
      toast.error("Não foi possível enviar agora. Escreva para suporte@sirvo.app");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead path="/contato" />
      <LandingNav />

      <main className="pt-28 pb-16 px-4 sm:px-6">
        <div className="container mx-auto max-w-5xl">
          <header className="text-center mb-10">
            <h1 className="font-display font-black text-3xl sm:text-4xl md:text-5xl uppercase tracking-tight text-foreground">
              Fale com a gente
            </h1>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Dúvidas, sugestões ou suporte? Envie sua mensagem e nossa equipe responde no seu e-mail.
            </p>
          </header>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <Card>
                <CardContent className="p-5 flex items-start gap-3">
                  <Mail className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">E-mail</p>
                    <a
                      href="mailto:suporte@sirvo.app"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      suporte@sirvo.app
                    </a>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 flex items-start gap-3">
                  <Clock className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Atendimento</p>
                    <p className="text-sm text-muted-foreground">Segunda a sexta, 9h às 18h</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 flex items-start gap-3">
                  <MessageSquare className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Suporte</p>
                    <p className="text-sm text-muted-foreground">
                      Retornamos em até 1 dia útil.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="lg:col-span-2">
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome *</Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(e) => update("name", e.target.value)}
                        placeholder="Seu nome"
                        maxLength={100}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(e) => update("email", e.target.value)}
                        placeholder="voce@email.com"
                        maxLength={255}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={form.phone}
                        onChange={(e) => update("phone", e.target.value)}
                        placeholder="(00) 00000-0000"
                        maxLength={30}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject">Assunto *</Label>
                      <Input
                        id="subject"
                        value={form.subject}
                        onChange={(e) => update("subject", e.target.value)}
                        placeholder="Como podemos ajudar?"
                        maxLength={150}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Mensagem *</Label>
                    <Textarea
                      id="message"
                      value={form.message}
                      onChange={(e) => update("message", e.target.value)}
                      placeholder="Escreva sua mensagem..."
                      rows={6}
                      maxLength={2000}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
                    {loading ? "Enviando..." : "Enviar mensagem"}
                    {!loading && <Send className="ml-2 w-4 h-4" />}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Contact;
