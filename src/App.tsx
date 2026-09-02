import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import AcceptInvite from "./pages/AcceptInvite";
import Dashboard from "./pages/Dashboard";
import Schedules from "./pages/Schedules";
import Planning from "./pages/Planning";
import Ministries from "./pages/Ministries";
import Calendar from "./pages/Calendar";
import Profile from "./pages/Profile";
import Availability from "./pages/Availability";
import Users from "./pages/Users";
import Worship from "./pages/Worship";
import Churches from "./pages/Churches";
import Install from "./pages/Install";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Support from "./pages/Support";
import Contact from "./pages/Contact";
import SwapRequests from "./pages/SwapRequests";
import Reports from "./pages/Reports";
import AdminFinancial from "./pages/AdminFinancial";
import AdminIntegrations from "./pages/AdminIntegrations";
import AdminSEO from "./pages/AdminSEO";
import AdminBroadcast from "./pages/AdminBroadcast";
import Unsubscribe from "./pages/Unsubscribe";
import SupabaseConnectionStatus from "./components/SupabaseConnectionStatus";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <SupabaseConnectionStatus />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/convite/:token" element={<AcceptInvite />} />
            <Route path="/install" element={<Install />} />
            <Route path="/termos" element={<Terms />} />
            <Route path="/privacidade" element={<Privacy />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/contato" element={<Contact />} />

            {/* Onboarding */}
            <Route path="/onboarding" element={<Onboarding />} />
            
            {/* Protected Routes */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/schedules" element={<Schedules />} />
            <Route path="/planejamento" element={<Planning />} />
            <Route path="/swap-requests" element={<SwapRequests />} />
            <Route path="/relatorios" element={<Reports />} />
            <Route path="/ministries" element={<Ministries />} />
            <Route path="/louvor" element={<Worship />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/disponibilidade" element={<Availability />} />

            <Route path="/users" element={<Users />} />
            <Route path="/churches" element={<Churches />} />
            <Route path="/ajuda" element={<Support />} />
            <Route path="/admin/financeiro" element={<AdminFinancial />} />
            <Route path="/admin/integracoes" element={<AdminIntegrations />} />
            <Route path="/admin/seo" element={<AdminSEO />} />
            <Route path="/admin/comunicados" element={<AdminBroadcast />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
