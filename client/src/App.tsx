import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import BottomNav from "@/components/bottom-nav";
import LoginPage from "@/pages/login";
import PlanPage from "@/pages/plan";
import RoutePage from "@/pages/route";
import SummaryPage from "@/pages/summary";
import HistoryPage from "@/pages/history";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={LoginPage} />
      <Route path="/login" component={LoginPage} />
      
      {/* Protected routes */}
      <Route path="/plan">
        {isAuthenticated ? <PlanPage /> : <Redirect to="/login" />}
      </Route>
      <Route path="/route">
        {isAuthenticated ? <RoutePage /> : <Redirect to="/login" />}
      </Route>
      <Route path="/summary">
        {isAuthenticated ? <SummaryPage /> : <Redirect to="/login" />}
      </Route>
      <Route path="/history">
        {isAuthenticated ? <HistoryPage /> : <Redirect to="/login" />}
      </Route>
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="relative min-h-screen">
      <Router />
      {isAuthenticated && <BottomNav />}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppContent />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
