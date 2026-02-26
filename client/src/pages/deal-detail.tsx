import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Send, FileUp, Trash2, RefreshCw, ArrowLeft, MessageSquare,
  FolderOpen, FileText, BarChart3, Clock, Sparkles, Building2,
  DollarSign, Globe, Loader2, Pencil
} from "lucide-react";
import type { Deal, DealStage, Document, DealMessage, DealActivity } from "@shared/schema";

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const dealId = parseInt(id!);
  const [chatInput, setChatInput] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [showEditDeal, setShowEditDeal] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ name: "", category: "general" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: deal, isLoading: dealLoading } = useQuery<Deal>({
    queryKey: ["/api/deals", dealId],
  });

  const { data: stages = [] } = useQuery<DealStage[]>({ queryKey: ["/api/stages"] });
  const { data: documents = [] } = useQuery<Document[]>({ queryKey: ["/api/deals", dealId, "documents"] });
  const { data: messages = [] } = useQuery<DealMessage[]>({ queryKey: ["/api/deals", dealId, "messages"] });
  const { data: activities = [] } = useQuery<DealActivity[]>({ queryKey: ["/api/deals", dealId, "activities"] });

  const currentStage = stages.find((s) => s.id === deal?.stageId);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const sendMessage = useCallback(async () => {
    if (!chatInput.trim() || isStreaming) return;
    const content = chatInput.trim();
    setChatInput("");
    setIsStreaming(true);
    setStreamingContent("");

    queryClient.setQueryData<DealMessage[]>(["/api/deals", dealId, "messages"], (old = []) => [
      ...old,
      { id: -1, dealId, role: "user", content, createdAt: new Date() } as any,
    ]);

    try {
      const response = await fetch(`/api/deals/${dealId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.content) {
              fullResponse += event.content;
              setStreamingContent(fullResponse);
            }
            if (event.done) {
              setIsStreaming(false);
              setStreamingContent("");
              queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "messages"] });
            }
          } catch {}
        }
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
      setIsStreaming(false);
      setStreamingContent("");
    }
  }, [chatInput, dealId, isStreaming, toast]);

  const generateContent = useCallback(async (type: "summary" | "analysis") => {
    setIsStreaming(true);
    setStreamingContent("");
    const endpoint = type === "summary" ? "generate-summary" : "generate-analysis";

    try {
      const response = await fetch(`/api/deals/${dealId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.content) {
              fullContent += event.content;
              setStreamingContent(fullContent);
            }
            if (event.done) {
              setIsStreaming(false);
              setStreamingContent("");
              queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId] });
              queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "activities"] });
              toast({ title: "Generated", description: `${type === "summary" ? "Summary" : "Analysis"} has been generated.` });
            }
          } catch {}
        }
      }
    } catch {
      toast({ title: "Error", description: `Failed to generate ${type}`, variant: "destructive" });
      setIsStreaming(false);
      setStreamingContent("");
    }
  }, [dealId, toast]);

  const updateDealMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/deals/${dealId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "activities"] });
      setShowEditDeal(false);
      toast({ title: "Deal updated" });
    },
  });

  const deleteDealMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/deals/${dealId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      navigate("/");
      toast({ title: "Deal deleted" });
    },
  });

  const clearChatMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/deals/${dealId}/messages`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "messages"] });
      toast({ title: "Chat cleared" });
    },
  });

  const processDocMutation = useMutation({
    mutationFn: async (docId: number) => {
      const res = await apiRequest("POST", `/api/documents/${docId}/process`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "activities"] });
      toast({ title: "Document processed", description: "AI has analyzed the document and updated deal info." });
    },
    onError: () => toast({ title: "Error", description: "Failed to process document", variant: "destructive" }),
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: number) => apiRequest("DELETE", `/api/documents/${docId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "documents"] });
      toast({ title: "Document removed" });
    },
  });

  const formatCurrency = (val: string | null) => {
    if (!val) return "\u2014";
    const num = Number(val);
    return `$${num.toLocaleString()}M`;
  };

  if (dealLoading) {
    return (
      <div className="flex-1 p-6">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-medium mb-2">Deal not found</h2>
          <Button onClick={() => navigate("/")} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <div className="border-b px-6 py-3 flex items-center justify-between bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} data-testid="btn-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold" data-testid="text-deal-title">{deal.name}</h1>
              {currentStage && (
                <Badge style={{ backgroundColor: currentStage.color, color: "white" }} data-testid="badge-stage">
                  {currentStage.name}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              {deal.targetCompany && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{deal.targetCompany}</span>}
              {deal.geography && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{deal.geography}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={deal.stageId?.toString() || ""}
            onValueChange={(v) => updateDealMutation.mutate({ stageId: parseInt(v) })}
          >
            <SelectTrigger className="w-40 h-8 text-xs" data-testid="select-deal-stage">
              <SelectValue placeholder="Set stage" />
            </SelectTrigger>
            <SelectContent>
              {stages.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setShowEditDeal(true)} data-testid="btn-edit-deal">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => { if (confirm("Delete this deal?")) deleteDealMutation.mutate(); }} data-testid="btn-delete-deal">
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-shrink-0 px-6 pt-3 pb-2">
              <TabsList>
                <TabsTrigger value="chat" data-testid="tab-chat"><MessageSquare className="w-3.5 h-3.5 mr-1.5" />Chat</TabsTrigger>
                <TabsTrigger value="dataroom" data-testid="tab-dataroom"><FolderOpen className="w-3.5 h-3.5 mr-1.5" />Dataroom</TabsTrigger>
                <TabsTrigger value="summary" data-testid="tab-summary"><FileText className="w-3.5 h-3.5 mr-1.5" />Summary</TabsTrigger>
                <TabsTrigger value="analysis" data-testid="tab-analysis"><BarChart3 className="w-3.5 h-3.5 mr-1.5" />Analysis</TabsTrigger>
                <TabsTrigger value="activity" data-testid="tab-activity"><Clock className="w-3.5 h-3.5 mr-1.5" />Activity</TabsTrigger>
              </TabsList>
            </div>

            {activeTab === "chat" && (
              <div className="flex-1 flex flex-col overflow-hidden px-6 pb-4">
                <ScrollArea className="flex-1 pr-4">
                  <div className="space-y-4 py-4 max-w-3xl mx-auto">
                    {messages.length === 0 && !isStreaming && (
                      <div className="text-center py-12">
                        <Sparkles className="w-10 h-10 text-primary mx-auto mb-3" />
                        <h3 className="text-lg font-medium mb-1">AI Deal Assistant</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Ask questions about this deal, request analysis, or generate documents.
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {["Summarize what we know about this deal", "What are the key risks?", "Generate an investment memo outline", "What additional information do we need?"].map((prompt) => (
                            <Button
                              key={prompt}
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => { setChatInput(prompt); }}
                              data-testid={`btn-prompt-${prompt.slice(0, 10)}`}
                            >
                              {prompt}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-card border"
                        }`} data-testid={`msg-${msg.id}`}>
                          {msg.role === "assistant" ? (
                            <div className="prose-chat" dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }} />
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {isStreaming && streamingContent && activeTab === "chat" && (
                      <div className="flex justify-start">
                        <div className="max-w-[80%] rounded-lg px-4 py-3 text-sm bg-card border">
                          <div className="prose-chat" dangerouslySetInnerHTML={{ __html: formatMarkdown(streamingContent) }} />
                        </div>
                      </div>
                    )}
                    {isStreaming && !streamingContent && activeTab === "chat" && (
                      <div className="flex justify-start">
                        <div className="rounded-lg px-4 py-3 bg-card border flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Thinking...
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>
                <div className="flex items-center gap-2 max-w-3xl mx-auto w-full pt-2 border-t">
                  <Input
                    ref={inputRef}
                    data-testid="input-chat"
                    placeholder="Ask about this deal, request analysis, or generate documents..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    disabled={isStreaming}
                    className="flex-1"
                  />
                  <Button onClick={sendMessage} disabled={!chatInput.trim() || isStreaming} data-testid="btn-send">
                    <Send className="w-4 h-4" />
                  </Button>
                  {messages.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => clearChatMutation.mutate()} data-testid="btn-clear-chat">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {activeTab === "dataroom" && (
              <div className="flex-1 overflow-y-auto px-6 pb-4">
                <div className="max-w-3xl mx-auto py-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Dataroom</h2>
                    <Button onClick={() => setShowUpload(true)} size="sm" data-testid="btn-upload-doc">
                      <FileUp className="w-4 h-4 mr-1.5" />Upload Document
                    </Button>
                  </div>
                  {documents.length === 0 ? (
                    <div className="text-center py-12 border rounded-lg bg-card">
                      <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowUpload(true)}>
                        <FileUp className="w-4 h-4 mr-1.5" />Upload First Document
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <Card key={doc.id} className="p-3 flex items-center justify-between" data-testid={`doc-${doc.id}`}>
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="w-8 h-8 text-primary flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate" data-testid={`text-doc-name-${doc.id}`}>{doc.name}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline" className="text-xs">{doc.category}</Badge>
                                {doc.type && <span>{doc.type}</span>}
                                {doc.aiProcessed && <Badge variant="secondary" className="text-xs"><Sparkles className="w-2.5 h-2.5 mr-1" />Processed</Badge>}
                              </div>
                              {doc.aiSummary && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{doc.aiSummary}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                            {!doc.aiProcessed && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => processDocMutation.mutate(doc.id)}
                                disabled={processDocMutation.isPending}
                                data-testid={`btn-process-doc-${doc.id}`}
                              >
                                {processDocMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                                {processDocMutation.isPending ? "Processing..." : "Process"}
                              </Button>
                            )}
                            {doc.aiProcessed && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => processDocMutation.mutate(doc.id)}
                                disabled={processDocMutation.isPending}
                                title="Reprocess document"
                                data-testid={`btn-reprocess-doc-${doc.id}`}
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => deleteDocMutation.mutate(doc.id)} data-testid={`btn-delete-doc-${doc.id}`}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "summary" && (
              <div className="flex-1 overflow-y-auto px-6 pb-4">
                <div className="max-w-3xl mx-auto py-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Deal Summary</h2>
                    <Button onClick={() => generateContent("summary")} size="sm" disabled={isStreaming} data-testid="btn-generate-summary">
                      {isStreaming && activeTab === "summary" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                      {deal.aiSummary ? "Regenerate" : "Generate"} Summary
                    </Button>
                  </div>
                  <SummaryContextEditor
                    value={deal.summaryContext || ""}
                    onSave={(val) => updateDealMutation.mutate({ summaryContext: val || null })}
                    isPending={updateDealMutation.isPending}
                    label="Summary Context"
                    description="This context will be included every time a summary is generated for this deal. Use it to specify formatting preferences, focus areas, or recurring instructions."
                  />
                  {isStreaming && activeTab === "summary" && streamingContent ? (
                    <Card className="p-6 mt-4">
                      <div className="prose-chat text-sm" dangerouslySetInnerHTML={{ __html: formatMarkdown(streamingContent) }} />
                    </Card>
                  ) : deal.aiSummary ? (
                    <Card className="p-6 mt-4">
                      <div className="prose-chat text-sm" dangerouslySetInnerHTML={{ __html: formatMarkdown(deal.aiSummary) }} />
                    </Card>
                  ) : (
                    <div className="text-center py-12 border rounded-lg bg-card mt-4">
                      <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground mb-3">No summary generated yet</p>
                      <p className="text-xs text-muted-foreground mb-4">Upload documents and click Generate to create an AI-powered deal summary</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "analysis" && (
              <div className="flex-1 overflow-y-auto px-6 pb-4">
                <div className="max-w-3xl mx-auto py-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Investment Analysis</h2>
                    <Button onClick={() => generateContent("analysis")} size="sm" disabled={isStreaming} data-testid="btn-generate-analysis">
                      {isStreaming && activeTab === "analysis" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <BarChart3 className="w-4 h-4 mr-1.5" />}
                      {deal.aiAnalysis ? "Regenerate" : "Generate"} Analysis
                    </Button>
                  </div>
                  <SummaryContextEditor
                    value={deal.analysisContext || ""}
                    onSave={(val) => updateDealMutation.mutate({ analysisContext: val || null })}
                    isPending={updateDealMutation.isPending}
                    label="Analysis Context"
                    description="This context will be included every time an analysis is generated for this deal. Use it to specify analysis frameworks, comparison criteria, or recurring instructions."
                  />
                  {isStreaming && activeTab === "analysis" && streamingContent ? (
                    <Card className="p-6 mt-4">
                      <div className="prose-chat text-sm" dangerouslySetInnerHTML={{ __html: formatMarkdown(streamingContent) }} />
                    </Card>
                  ) : deal.aiAnalysis ? (
                    <Card className="p-6 mt-4">
                      <div className="prose-chat text-sm" dangerouslySetInnerHTML={{ __html: formatMarkdown(deal.aiAnalysis) }} />
                    </Card>
                  ) : (
                    <div className="text-center py-12 border rounded-lg bg-card mt-4">
                      <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground mb-3">No analysis generated yet</p>
                      <p className="text-xs text-muted-foreground mb-4">Upload documents and click Generate to create an AI-powered investment analysis</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "activity" && (
              <div className="flex-1 overflow-y-auto px-6 pb-4">
                <div className="max-w-3xl mx-auto py-4">
                  <h2 className="text-lg font-semibold mb-4">Activity Timeline</h2>
                  {activities.length === 0 ? (
                    <div className="text-center py-12 border rounded-lg bg-card">
                      <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No activity yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activities.map((activity) => (
                        <div key={activity.id} className="flex items-start gap-3" data-testid={`activity-${activity.id}`}>
                          <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                          <div>
                            <p className="text-sm">{activity.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(activity.createdAt).toLocaleDateString("en-US", {
                                month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit"
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Tabs>
        </div>

        <div className="w-72 border-l bg-card p-4 overflow-auto flex-shrink-0 hidden lg:block">
          <h3 className="text-sm font-semibold mb-3">Deal Info</h3>
          <div className="space-y-3">
            <InfoRow label="Valuation" value={formatCurrency(deal.valuation)} icon={<DollarSign className="w-3.5 h-3.5" />} />
            <InfoRow label="Revenue" value={formatCurrency(deal.revenue)} icon={<DollarSign className="w-3.5 h-3.5" />} />
            <InfoRow label="EBITDA" value={formatCurrency(deal.ebitda)} icon={<DollarSign className="w-3.5 h-3.5" />} />
            {deal.valuation && deal.ebitda && Number(deal.ebitda) > 0 && (
              <InfoRow label="EV/EBITDA" value={`${(Number(deal.valuation) / Number(deal.ebitda)).toFixed(1)}x`} icon={<BarChart3 className="w-3.5 h-3.5" />} />
            )}
            {deal.geography && <InfoRow label="Geography" value={deal.geography} icon={<Globe className="w-3.5 h-3.5" />} />}
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-2">Documents ({documents.length})</h3>
            {documents.slice(0, 5).map((doc) => (
              <div key={doc.id} className="flex items-center gap-2 text-xs py-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{doc.name}</span>
                {doc.aiProcessed && <Sparkles className="w-3 h-3 text-primary flex-shrink-0" />}
              </div>
            ))}
            {documents.length > 5 && <p className="text-xs text-muted-foreground mt-1">+{documents.length - 5} more</p>}
          </div>

          {deal.description && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold mb-2">Description</h3>
              <p className="text-xs text-muted-foreground">{deal.description}</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showUpload} onOpenChange={(open) => { setShowUpload(open); if (!open) { setSelectedFile(null); setUploadProgress(0); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document to Dataroom</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>File</Label>
              <input
                ref={fileInputRef}
                type="file"
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                data-testid="input-file"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setSelectedFile(file);
                  if (file && !uploadForm.name) {
                    setUploadForm((prev) => ({ ...prev, name: file.name }));
                  }
                }}
              />
            </div>
            <div>
              <Label>Document Name *</Label>
              <Input data-testid="input-doc-name" placeholder="e.g., Q3 Financial Statements" value={uploadForm.name} onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={uploadForm.category} onValueChange={(v) => setUploadForm({ ...uploadForm, category: v })}>
                <SelectTrigger data-testid="select-doc-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="financial">Financial Statements</SelectItem>
                  <SelectItem value="legal">Legal Documents</SelectItem>
                  <SelectItem value="operational">Operational</SelectItem>
                  <SelectItem value="market">Market Research</SelectItem>
                  <SelectItem value="pitch">Pitch Deck</SelectItem>
                  <SelectItem value="diligence">Due Diligence</SelectItem>
                  <SelectItem value="memo">Investment Memo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
            <Button
              className="w-full"
              onClick={async () => {
                if (!uploadForm.name.trim()) return;
                setIsUploading(true);
                setUploadProgress(10);
                try {
                  let objectPath = `/documents/${dealId}/${Date.now()}`;
                  if (selectedFile) {
                    setUploadProgress(20);
                    const urlRes = await fetch("/api/uploads/request-url", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: selectedFile.name, size: selectedFile.size, contentType: selectedFile.type || "application/octet-stream" }),
                    });
                    if (!urlRes.ok) throw new Error("Failed to get upload URL");
                    const { uploadURL, objectPath: path } = await urlRes.json();
                    objectPath = path;
                    setUploadProgress(40);
                    const uploadRes = await fetch(uploadURL, {
                      method: "PUT",
                      body: selectedFile,
                      headers: { "Content-Type": selectedFile.type || "application/octet-stream" },
                    });
                    if (!uploadRes.ok) throw new Error("Failed to upload file");
                    setUploadProgress(80);
                  }
                  await apiRequest("POST", `/api/deals/${dealId}/documents`, {
                    name: uploadForm.name,
                    category: uploadForm.category,
                    objectPath,
                    type: selectedFile?.type || null,
                    size: selectedFile?.size || null,
                  });
                  setUploadProgress(100);
                  queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "documents"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "activities"] });
                  setShowUpload(false);
                  setUploadForm({ name: "", category: "general" });
                  setSelectedFile(null);
                  setUploadProgress(0);
                  toast({ title: "Document uploaded", description: "File has been securely stored." });
                } catch (error) {
                  toast({ title: "Upload failed", description: "Could not upload the document.", variant: "destructive" });
                } finally {
                  setIsUploading(false);
                }
              }}
              disabled={!uploadForm.name.trim() || isUploading}
              data-testid="btn-submit-doc"
            >
              {isUploading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>
              ) : (
                <><FileUp className="w-4 h-4 mr-2" />Upload Document</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDeal} onOpenChange={setShowEditDeal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Deal</DialogTitle>
          </DialogHeader>
          <EditDealForm deal={deal} stages={stages} onSave={(data) => updateDealMutation.mutate(data)} isPending={updateDealMutation.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground flex items-center gap-1.5">{icon}{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}

function SummaryContextEditor({ value, onSave, isPending, label, description }: { value: string; onSave: (val: string) => void; isPending: boolean; label: string; description: string }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  useEffect(() => { setText(value); }, [value]);

  if (!editing) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-medium">{label}</h4>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} data-testid={`btn-edit-${label.toLowerCase().replace(/ /g, '-')}`}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {value ? (
          <p className="text-sm mt-2 whitespace-pre-wrap" data-testid={`text-${label.toLowerCase().replace(/ /g, '-')}`}>{value}</p>
        ) : (
          <p className="text-xs text-muted-foreground italic mt-2" data-testid={`text-${label.toLowerCase().replace(/ /g, '-')}-empty`}>No context set. Click edit to add instructions.</p>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h4 className="text-sm font-medium mb-1">{label}</h4>
      <p className="text-xs text-muted-foreground mb-2">{description}</p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="e.g., Always include a section on competitive landscape. Focus on SaaS metrics like ARR, NRR, and CAC payback."
        data-testid={`textarea-${label.toLowerCase().replace(/ /g, '-')}`}
      />
      <div className="flex gap-2 mt-2">
        <Button size="sm" onClick={() => { onSave(text); setEditing(false); }} disabled={isPending} data-testid={`btn-save-${label.toLowerCase().replace(/ /g, '-')}`}>
          {isPending ? "Saving..." : "Save"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setText(value); setEditing(false); }} data-testid={`btn-cancel-${label.toLowerCase().replace(/ /g, '-')}`}>Cancel</Button>
      </div>
    </Card>
  );
}

function EditDealForm({ deal, stages, onSave, isPending }: { deal: Deal; stages: DealStage[]; onSave: (data: any) => void; isPending: boolean }) {
  const [form, setForm] = useState({
    name: deal.name || "",
    description: deal.description || "",
    targetCompany: deal.targetCompany || "",
    geography: deal.geography || "",
    valuation: deal.valuation || "",
    revenue: deal.revenue || "",
    ebitda: deal.ebitda || "",
    stageId: deal.stageId?.toString() || "",
  });

  return (
    <div className="space-y-4 mt-2">
      <div>
        <Label>Deal Name</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Target Company</Label><Input value={form.targetCompany} onChange={(e) => setForm({ ...form, targetCompany: e.target.value })} /></div>
        <div><Label>Geography</Label><Input value={form.geography} onChange={(e) => setForm({ ...form, geography: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label>Valuation ($M)</Label><Input type="number" value={form.valuation} onChange={(e) => setForm({ ...form, valuation: e.target.value })} /></div>
        <div><Label>Revenue ($M)</Label><Input type="number" value={form.revenue} onChange={(e) => setForm({ ...form, revenue: e.target.value })} /></div>
        <div><Label>EBITDA ($M)</Label><Input type="number" value={form.ebitda} onChange={(e) => setForm({ ...form, ebitda: e.target.value })} /></div>
      </div>
      <div>
        <Label>Stage</Label>
        <Select value={form.stageId} onValueChange={(v) => setForm({ ...form, stageId: v })}>
          <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
          <SelectContent>
            {stages.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Description</Label>
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
      </div>
      <Button className="w-full" onClick={() => {
        const payload: any = { name: form.name };
        if (form.description) payload.description = form.description;
        if (form.targetCompany) payload.targetCompany = form.targetCompany;
        if (form.geography) payload.geography = form.geography;
        if (form.valuation) payload.valuation = form.valuation;
        if (form.revenue) payload.revenue = form.revenue;
        if (form.ebitda) payload.ebitda = form.ebitda;
        if (form.stageId) payload.stageId = parseInt(form.stageId);
        onSave(payload);
      }} disabled={isPending}>
        {isPending ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => {
      return `<ul>${match}</ul>`;
    })
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>");
}
