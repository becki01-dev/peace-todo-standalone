import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import NotFound from "./pages/NotFound.tsx";
import FitLayout from "./fit/FitLayout";
import FitAuth from "./fit/pages/FitAuth";
import FitHistoryRoute from "./fit/pages/FitHistoryRoute";
import FitStats from "./fit/pages/FitStats";
import FitSettings from "./fit/pages/FitSettings";
import FitStrengthSession from "./fit/pages/FitStrengthSession";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/task" element={<Index />} />
            <Route path="/auth" element={<FitAuth />} />
            <Route path="/fit/auth" element={<Navigate to="/auth" replace />} />
            <Route path="/fit" element={<FitLayout />}>
              <Route index element={<FitHistoryRoute />} />
              <Route path="stats" element={<FitStats />} />
              <Route path="settings" element={<FitSettings />} />
              <Route path="strength/session" element={<FitStrengthSession />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
