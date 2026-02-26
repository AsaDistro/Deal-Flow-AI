import { Link, useLocation } from "wouter";
import { LayoutDashboard, Plus, FolderOpen, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useEffect } from "react";
import type { Deal, DealStage } from "@shared/schema";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();

  const { data: deals = [] } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });

  const { data: stages = [] } = useQuery<DealStage[]>({
    queryKey: ["/api/stages"],
  });

  const recentDeals = deals.slice(0, 8);

  return (
    <>
      <div className="p-4 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <FolderOpen className="w-4 h-4 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-sidebar-foreground">DealFlow AI</h1>
          <p className="text-xs text-muted-foreground">M&A Intelligence</p>
        </div>
      </div>

      <Separator />

      <div className="p-3">
        <Link href="/">
          <Button
            variant={location === "/" ? "secondary" : "ghost"}
            className="w-full justify-start gap-2 text-sm"
            data-testid="nav-dashboard"
            onClick={onNavigate}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Button>
        </Link>
      </div>

      <Separator />

      <div className="p-3 flex-1 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent Deals</span>
          <Link href="/?new=true">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" data-testid="btn-new-deal-sidebar" onClick={onNavigate}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-0.5">
            {recentDeals.map((deal) => {
              const stage = stages.find((s) => s.id === deal.stageId);
              const isActive = location === `/deals/${deal.id}`;
              return (
                <Link key={deal.id} href={`/deals/${deal.id}`}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className="w-full justify-start gap-2 text-sm h-auto py-2 px-3"
                    data-testid={`nav-deal-${deal.id}`}
                    onClick={onNavigate}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: stage?.color || "#6366f1" }}
                    />
                    <span className="truncate text-left">{deal.name}</span>
                  </Button>
                </Link>
              );
            })}
            {recentDeals.length === 0 && (
              <p className="text-xs text-muted-foreground px-3 py-4">No deals yet. Create your first deal to get started.</p>
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}

export default function AppSidebar() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location]);

  if (isMobile) {
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          className="fixed top-3 left-3 z-50 md:hidden"
          onClick={() => setOpen(true)}
          data-testid="btn-mobile-menu"
        >
          <Menu className="w-5 h-5" />
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-64 p-0 flex flex-col">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <div className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col flex-shrink-0 hidden md:flex" data-testid="app-sidebar">
      <SidebarContent />
    </div>
  );
}
