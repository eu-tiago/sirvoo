import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Church, Sparkles } from "lucide-react";
import sirvoLogo from "@/assets/sirvo-logo.png";

export default function Onboarding() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    city: "",
    state: "",
    address: "",
  });

  // Check if user already has a church
  useEffect(() => {
    const checkExistingChurch = async () => {
      if (authLoading) return;

      if (!user) {
        navigate("/auth");
        return;
      }

      try {
        const { data: membership } = await supabase
          .from("church_members")
          .select("church_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (membership) {
          navigate("/dashboard");
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error checking church:", error);
        setLoading(false);
      }
    };

    checkExistingChurch();
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.name.trim()) return;

    setSaving(true);
    try {
      const { data: newChurch, error: churchError } = await supabase
        .from("churches")
        .insert({
          name: formData.name.trim(),
          city: formData.city.trim() || null,
          state: formData.state.trim() || null,
          address: formData.address.trim() || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (churchError) throw churchError;

      const { error: memberError } = await supabase
        .from("church_members")
        .insert({
          church_id: newChurch.id,
          user_id: user.id,
          role: "admin",
        });

      if (memberError) throw memberError;

      const { error: roleError } = await supabase
        .from("user_roles")
        .update({ role: "admin" })
        .eq("user_id", user.id);

      if (roleError) {
        console.error("Error updating role:", roleError);
      }

      toast.success("Igreja criada com sucesso! Bem-vindo ao Sirvo!");
      navigate("/dashboard");
    } catch (error) {
      console.error("Error creating church:", error);
      const code = (error as { code?: string })?.code;
      if (code === "23505") {
        toast.error(
          "Esta igreja já está cadastrada no Sirvo. Peça ao administrador dela para te enviar um convite por e-mail."
        );
      } else {
        toast.error("Erro ao criar igreja. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  };


  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-4">
          <img src={sirvoLogo} alt="Sirvo" className="h-16 w-auto" />
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-medium">Configuração Inicial</span>
          </div>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Church className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Criar sua Igreja</CardTitle>
            <CardDescription>
              Para começar a usar o Sirvo, você precisa cadastrar sua igreja. 
              Você será o administrador desta conta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Igreja *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Igreja Batista Central"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    placeholder="São Paulo"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    placeholder="SP"
                    maxLength={2}
                    value={formData.state}
                    onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value.toUpperCase() }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  placeholder="Rua, número, bairro"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>

              <Button type="submit" className="w-full" disabled={saving || !formData.name.trim()}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  "Criar Igreja e Continuar"
                )}
              </Button>
            </form>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Você poderá convidar outros membros e líderes após criar sua igreja.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
