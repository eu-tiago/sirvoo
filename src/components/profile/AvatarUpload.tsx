import { useState, useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface AvatarUploadProps {
  currentAvatarUrl?: string;
  userName: string;
  onUploadComplete: (url: string) => void;
}

export function AvatarUpload({ currentAvatarUrl, userName, onUploadComplete }: AvatarUploadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast({
        title: "Formato inválido",
        description: "Apenas imagens JPG e PNG são permitidas",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 1MB)
    if (file.size > 1048576) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo é 1MB",
        variant: "destructive",
      });
      return;
    }

    // Validate image dimensions
    const img = new Image();
    img.src = URL.createObjectURL(file);
    
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    if (img.width > 720 || img.height > 720) {
      toast({
        title: "Dimensões inválidas",
        description: "A imagem deve ter no máximo 720x720 pixels",
        variant: "destructive",
      });
      URL.revokeObjectURL(img.src);
      return;
    }

    URL.revokeObjectURL(img.src);

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      onUploadComplete(publicUrl);
      
      toast({
        title: "Foto atualizada",
        description: "Sua foto de perfil foi alterada com sucesso",
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "Erro ao enviar foto",
        description: "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative">
      <div className="w-24 h-24 rounded-3xl bg-card shadow-sirvo-lg overflow-hidden ring-4 ring-card">
        {currentAvatarUrl ? (
          <img src={currentAvatarUrl} alt={userName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <span className="text-3xl font-bold text-primary-foreground">
              {initials}
            </span>
          </div>
        )}
      </div>
      
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {uploading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Camera className="w-5 h-5" />
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}