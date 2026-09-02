import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useUserRole } from "@/hooks/useUserRole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Music } from "lucide-react";
import { RepertoireTab } from "@/components/worship/RepertoireTab";
import { PlaylistsTab } from "@/components/worship/PlaylistsTab";
import { EventRepertoireTab } from "@/components/worship/EventRepertoireTab";
import { TeamTab } from "@/components/worship/TeamTab";
import { LibraryTab } from "@/components/worship/LibraryTab";
import { RehearsalsTab } from "@/components/worship/RehearsalsTab";
import { Navigate } from "react-router-dom";

const Worship = () => {
  const { role, isSuperAdmin, loading } = useUserRole();
  if (loading) return null;

  const canAccess = isSuperAdmin || role === "admin" || role === "ministry_leader";
  if (!canAccess) return <Navigate to="/dashboard" replace />;

  const canEdit = canAccess;

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto pb-24">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Music className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Louvor</h1>
              <p className="text-sm text-muted-foreground">Repertório, playlists, ensaios e equipes</p>
            </div>
          </div>

          <Tabs defaultValue="repertorio" className="space-y-4">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="repertorio">Repertório</TabsTrigger>
              <TabsTrigger value="playlists">Playlists</TabsTrigger>
              <TabsTrigger value="evento">Repertório do Evento</TabsTrigger>
              <TabsTrigger value="equipe">Equipe</TabsTrigger>
              <TabsTrigger value="ensaios">Ensaios</TabsTrigger>
              <TabsTrigger value="biblioteca">Biblioteca</TabsTrigger>
            </TabsList>
            <TabsContent value="repertorio"><RepertoireTab canEdit={canEdit} /></TabsContent>
            <TabsContent value="playlists"><PlaylistsTab canEdit={canEdit} /></TabsContent>
            <TabsContent value="evento"><EventRepertoireTab canEdit={canEdit} /></TabsContent>
            <TabsContent value="equipe"><TeamTab /></TabsContent>
            <TabsContent value="ensaios"><RehearsalsTab /></TabsContent>
            <TabsContent value="biblioteca"><LibraryTab /></TabsContent>
          </Tabs>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
};

export default Worship;
