import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppSidebar, { MobileSidebarProvider, useMobileSidebar } from "@/components/app-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import Dashboard from "@/pages/dashboard";
import DealDetail from "@/pages/deal-detail";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/deals/:id" component={DealDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function MobileMenuButton() {
  const isMobile = useIsMobile();
  const { open } = useMobileSidebar();

  if (!isMobile) return null;

  return (
    <div className="flex-shrink-0 border-b bg-card px-3 py-2 md:hidden">
      <Button variant="ghost" size="sm" onClick={open} data-testid="btn-mobile-menu">
        <Menu className="w-5 h-5" />
      </Button>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <MobileSidebarProvider>
          <div className="flex h-screen overflow-hidden">
            <AppSidebar />
            <div className="flex-1 min-w-0 flex flex-col">
              <MobileMenuButton />
              <div className="flex-1 min-h-0">
                <Router />
              </div>
            </div>
          </div>
        </MobileSidebarProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
