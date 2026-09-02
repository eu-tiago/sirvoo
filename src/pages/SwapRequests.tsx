import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useSwapRequests, SwapRequest } from "@/hooks/useSwapRequests";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeftRight, Check, X, Calendar, Music, Loader2, User, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const SwapRequests = () => {
  const { directRequests, ministryRequests, loading, processing, acceptSwap, rejectSwap } = useSwapRequests();

  const hasAny = directRequests.length > 0 || ministryRequests.length > 0;

  return (
    <ProtectedRoute>
      <AppLayout>
        <header className="px-4 md:px-6 pt-6 md:pt-8 pb-4 md:pb-6">
          <div className="flex items-center gap-3 mb-2">
            <ArrowLeftRight className="w-6 h-6 text-primary" />
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              Solicitações de Troca
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Gerencie as solicitações de troca de escala
          </p>
        </header>

        <div className="px-4 md:px-6 pb-24 md:pb-6 space-y-6">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 rounded-2xl" />
              ))}
            </div>
          ) : !hasAny ? (
            <div className="text-center py-16">
              <ArrowLeftRight className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">
                Nenhuma solicitação pendente
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Quando alguém solicitar uma troca com você, aparecerá aqui.
              </p>
            </div>
          ) : (
            <>
              {/* Direct requests section */}
              {directRequests.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-4 h-4 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                      Para você
                    </h2>
                    <Badge variant="secondary" className="text-xs">
                      {directRequests.length}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Solicitações enviadas diretamente para você
                  </p>
                  <div className="space-y-3">
                    {directRequests.map((req) => (
                      <SwapRequestCard
                        key={req.id}
                        request={req}
                        processing={processing}
                        onAccept={() => acceptSwap(req)}
                        onReject={() => rejectSwap(req)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Ministry requests section */}
              {ministryRequests.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-secondary" />
                    <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                      Da equipe
                    </h2>
                    <Badge variant="outline" className="text-xs">
                      {ministryRequests.length}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Solicitações abertas no seu ministério
                  </p>
                  <div className="space-y-3">
                    {ministryRequests.map((req) => (
                      <SwapRequestCard
                        key={req.id}
                        request={req}
                        processing={processing}
                        onAccept={() => acceptSwap(req)}
                        onReject={() => rejectSwap(req)}
                        isMinistry
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
};

function SwapRequestCard({
  request,
  processing,
  onAccept,
  onReject,
  isMinistry = false,
}: {
  request: SwapRequest;
  processing: boolean;
  onAccept: () => void;
  onReject: () => void;
  isMinistry?: boolean;
}) {
  const formattedDate = request.schedule_date
    ? format(new Date(request.schedule_date), "dd MMM yyyy", { locale: ptBR })
    : "";

  return (
    <Card className={isMinistry ? "border-secondary/20" : "border-primary/10"}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0 ${
                isMinistry
                  ? "bg-gradient-to-br from-secondary to-accent"
                  : "bg-gradient-to-br from-primary to-secondary"
              }`}>
                {request.requester_name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">
                  {request.requester_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isMinistry ? "busca troca na equipe" : "quer trocar com você"}
                </p>
              </div>
            </div>
          </div>
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 shrink-0">
            Pendente
          </Badge>
        </div>

        <div className="p-3 rounded-lg bg-muted/50 space-y-1">
          <p className="text-sm font-medium text-foreground">
            {request.schedule_title}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {formattedDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formattedDate}
              </span>
            )}
            {request.ministry_name && (
              <span className="flex items-center gap-1">
                <Music className="w-3 h-3" />
                {request.ministry_name}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={onAccept}
            disabled={processing}
            className="flex-1"
            size="sm"
          >
            {processing ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Check className="w-4 h-4 mr-1" />
            )}
            Aceitar
          </Button>
          <Button
            variant="outline"
            onClick={onReject}
            disabled={processing}
            className="flex-1"
            size="sm"
          >
            {processing ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <X className="w-4 h-4 mr-1" />
            )}
            Recusar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default SwapRequests;
