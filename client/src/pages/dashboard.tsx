import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Building2, DollarSign, MapPin, FolderOpen } from "lucide-react";
import type { Deal, DealStage } from "@shared/schema";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [newDeal, setNewDeal] = useState({
    name: "", description: "", targetCompany: "",
    geography: "", valuation: "", revenue: "", ebitda: "", stageId: "",
  });

  const { data: stages = [], isLoading: stagesLoading } = useQuery<DealStage[]>({
    queryKey: ["/api/stages"],
  });

  const { data: deals = [], isLoading: dealsLoading } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });

  const seedStagesMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/stages/seed"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/stages"] }),
  });

  useEffect(() => {
    if (!stagesLoading && stages.length === 0) {
      seedStagesMutation.mutate();
    }
  }, [stagesLoading, stages.length]);

  const createDealMutation = useMutation({
    mutationFn: async (deal: any) => {
      const res = await apiRequest("POST", "/api/deals", deal);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      setShowNewDeal(false);
      setNewDeal({ name: "", description: "", targetCompany: "", geography: "", valuation: "", revenue: "", ebitda: "", stageId: "" });
      toast({ title: "Deal created", description: `"${data.name}" has been added to your pipeline.` });
      navigate(`/deals/${data.id}`);
    },
    onError: () => toast({ title: "Error", description: "Failed to create deal", variant: "destructive" }),
  });

  const filteredDeals = deals.filter((deal) => {
    const matchesSearch = !searchQuery || deal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.targetCompany?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = filterStage === "all" || deal.stageId === parseInt(filterStage);
    return matchesSearch && matchesStage;
  });

  const dealsByStage = stages.map((stage) => ({
    stage,
    deals: filteredDeals.filter((d) => d.stageId === stage.id),
  }));

  const unstagedDeals = filteredDeals.filter((d) => !d.stageId);

  const handleCreateDeal = () => {
    if (!newDeal.name.trim()) return;
    const payload: any = { name: newDeal.name };
    if (newDeal.description) payload.description = newDeal.description;
    if (newDeal.targetCompany) payload.targetCompany = newDeal.targetCompany;
    if (newDeal.geography) payload.geography = newDeal.geography;
    if (newDeal.valuation) payload.valuation = newDeal.valuation;
    if (newDeal.revenue) payload.revenue = newDeal.revenue;
    if (newDeal.ebitda) payload.ebitda = newDeal.ebitda;
    if (newDeal.stageId) payload.stageId = parseInt(newDeal.stageId);
    createDealMutation.mutate(payload);
  };

  const formatCurrency = (val: string | null) => {
    if (!val) return null;
    const num = Number(val);
    return `$${num.toLocaleString()}M`;
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Deal Pipeline</h1>
            <p className="text-muted-foreground text-sm mt-1">{deals.length} active deals across {stages.length} stages</p>
          </div>

          <Dialog open={showNewDeal} onOpenChange={setShowNewDeal}>
            <DialogTrigger asChild>
              <Button data-testid="btn-new-deal">
                <Plus className="w-4 h-4 mr-2" />
                New Deal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Deal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>Deal Name *</Label>
                  <Input data-testid="input-deal-name" placeholder="e.g., Project Atlas" value={newDeal.name} onChange={(e) => setNewDeal({ ...newDeal, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Target Company</Label>
                    <Input data-testid="input-target-company" placeholder="Target Co." value={newDeal.targetCompany} onChange={(e) => setNewDeal({ ...newDeal, targetCompany: e.target.value })} />
                  </div>
                  <div>
                    <Label>Geography</Label>
                    <Input data-testid="input-geography" placeholder="e.g., North America" value={newDeal.geography} onChange={(e) => setNewDeal({ ...newDeal, geography: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Valuation ($M)</Label>
                    <Input data-testid="input-valuation" type="number" placeholder="0" value={newDeal.valuation} onChange={(e) => setNewDeal({ ...newDeal, valuation: e.target.value })} />
                  </div>
                  <div>
                    <Label>Revenue ($M)</Label>
                    <Input data-testid="input-revenue" type="number" placeholder="0" value={newDeal.revenue} onChange={(e) => setNewDeal({ ...newDeal, revenue: e.target.value })} />
                  </div>
                  <div>
                    <Label>EBITDA ($M)</Label>
                    <Input data-testid="input-ebitda" type="number" placeholder="0" value={newDeal.ebitda} onChange={(e) => setNewDeal({ ...newDeal, ebitda: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Stage</Label>
                  <Select value={newDeal.stageId} onValueChange={(v) => setNewDeal({ ...newDeal, stageId: v })}>
                    <SelectTrigger data-testid="select-stage"><SelectValue placeholder="Select stage" /></SelectTrigger>
                    <SelectContent>
                      {stages.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea data-testid="input-description" placeholder="Brief deal description..." value={newDeal.description} onChange={(e) => setNewDeal({ ...newDeal, description: e.target.value })} rows={3} />
                </div>
                <Button data-testid="btn-submit-deal" className="w-full" onClick={handleCreateDeal} disabled={!newDeal.name.trim() || createDealMutation.isPending}>
                  {createDealMutation.isPending ? "Creating..." : "Create Deal"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input data-testid="input-search" className="pl-9" placeholder="Search deals..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <Select value={filterStage} onValueChange={setFilterStage}>
            <SelectTrigger className="w-48" data-testid="select-filter-stage"><SelectValue placeholder="Filter by stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {dealsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : (
          <div className="space-y-6">
            {dealsByStage.map(({ stage, deals: stageDeals }) => (
              stageDeals.length > 0 && (
                <div key={stage.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground" data-testid={`text-stage-${stage.id}`}>
                      {stage.name}
                    </h2>
                    <Badge variant="secondary" className="text-xs">{stageDeals.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {stageDeals.map((deal) => (
                      <Card
                        key={deal.id}
                        className="p-4 cursor-pointer hover-elevate transition-colors"
                        onClick={() => navigate(`/deals/${deal.id}`)}
                        data-testid={`card-deal-${deal.id}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-sm" data-testid={`text-deal-name-${deal.id}`}>{deal.name}</h3>
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{ borderColor: stage.color, color: stage.color }}
                          >
                            {stage.name}
                          </Badge>
                        </div>
                        {deal.targetCompany && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                            <Building2 className="w-3 h-3" />
                            <span>{deal.targetCompany}</span>
                          </div>
                        )}
                        {deal.geography && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                            <MapPin className="w-3 h-3" />
                            <span>{deal.geography}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-2 pt-2 border-t">
                          {deal.valuation && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">EV: </span>
                              <span className="font-medium">{formatCurrency(deal.valuation)}</span>
                            </div>
                          )}
                          {deal.revenue && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">Rev: </span>
                              <span className="font-medium">{formatCurrency(deal.revenue)}</span>
                            </div>
                          )}
                          {deal.ebitda && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">EBITDA: </span>
                              <span className="font-medium">{formatCurrency(deal.ebitda)}</span>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            ))}
            {unstagedDeals.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-muted-foreground" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Unassigned</h2>
                  <Badge variant="secondary" className="text-xs">{unstagedDeals.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {unstagedDeals.map((deal) => (
                    <Card key={deal.id} className="p-4 cursor-pointer hover-elevate transition-colors" onClick={() => navigate(`/deals/${deal.id}`)} data-testid={`card-deal-${deal.id}`}>
                      <h3 className="font-semibold text-sm mb-1">{deal.name}</h3>
                      {deal.targetCompany && <p className="text-xs text-muted-foreground">{deal.targetCompany}</p>}
                    </Card>
                  ))}
                </div>
              </div>
            )}
            {filteredDeals.length === 0 && !dealsLoading && (
              <div className="text-center py-16">
                <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-1">No deals yet</h3>
                <p className="text-muted-foreground text-sm mb-4">Create your first deal to start building your pipeline</p>
                <Button onClick={() => setShowNewDeal(true)} data-testid="btn-new-deal-empty">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Deal
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
