import { useState, useMemo } from "react";
import { useAdmin } from "@/lib/admin-store";
import type { Rule, RuleCategory, KBEntry, Workflow, WorkflowStep, Agent, AgentModel, WorkflowStatus } from "@/lib/admin-store";
import { useLocation } from "wouter";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Moon,
  Sun,
  Bot,
  BookOpen,
  ShieldCheck,
  Database,
  Workflow as WorkflowIcon,
  ChevronRight,
  Plus,
  X,
  Settings2,
  FileUp,
  Tags,
  FileSearch,
  Calculator,
  TrendingUp,
  FilePen,
  AlertTriangle,
  BarChart3,
  Lock,
  Eye,
  Pencil,
  CheckCircle2,
  Download,
  Cog,
  ArrowRight,
} from "lucide-react";

// ─── Icon map for agents ───
const agentIconMap: Record<string, React.ReactNode> = {
  FileUp: <FileUp className="h-4 w-4" />,
  Tags: <Tags className="h-4 w-4" />,
  FileSearch: <FileSearch className="h-4 w-4" />,
  ShieldCheck: <ShieldCheck className="h-4 w-4" />,
  Calculator: <Calculator className="h-4 w-4" />,
  BookOpen: <BookOpen className="h-4 w-4" />,
  TrendingUp: <TrendingUp className="h-4 w-4" />,
  FilePen: <FilePen className="h-4 w-4" />,
  AlertTriangle: <AlertTriangle className="h-4 w-4" />,
  BarChart3: <BarChart3 className="h-4 w-4" />,
};

// ─── Helpers ───

const categoryLabels: Record<RuleCategory, string> = {
  identification: "Identification",
  exemptions: "Exemptions",
  evaluation: "Évaluation",
  comptabilisation: "Comptabilisation",
  reporting: "Reporting",
};

const categoryColors: Record<RuleCategory, string> = {
  identification: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  exemptions: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  evaluation: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  comptabilisation: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  reporting: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
};

const ruleTypeLabels: Record<string, string> = {
  obligatoire: "Obligatoire",
  parametrable: "Paramétrable",
  recommande: "Recommandé",
};

const ruleTypeColors: Record<string, string> = {
  obligatoire: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  parametrable: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  recommande: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const kbTypeLabels: Record<string, string> = {
  norme: "Norme",
  guide: "Guide",
  position: "Position",
  interne: "Interne",
  reglementation: "Réglementation",
};

const kbStatusLabels: Record<string, string> = {
  en_vigueur: "En vigueur",
  abroge: "Abrogé",
  projet: "Projet",
};

const kbStatusColors: Record<string, string> = {
  en_vigueur: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  abroge: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  projet: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
};

const workflowStatusLabels: Record<WorkflowStatus, string> = {
  actif: "Actif",
  brouillon: "Brouillon",
  inactif: "Inactif",
};

const workflowStatusColors: Record<WorkflowStatus, string> = {
  actif: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  brouillon: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  inactif: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const modelLabels: Record<AgentModel, string> = {
  "gpt-4o": "GPT-4o",
  "claude-3.5-sonnet": "Claude 3.5 Sonnet",
  "mistral-large": "Mistral Large",
  "gemini-1.5-pro": "Gemini 1.5 Pro",
};

// ════════════════════════════════════════
// MAIN ADMIN PAGE
// ════════════════════════════════════════

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const admin = useAdmin();
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState("workflows");

  // Workflow detail states
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [stepSheetWorkflowId, setStepSheetWorkflowId] = useState<string | null>(null);

  // Agent detail dialog
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Rule detail dialog
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);

  // KB detail dialog
  const [selectedKBId, setSelectedKBId] = useState<string | null>(null);

  const toggleDark = () => {
    setDarkMode((d) => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  };

  const selectedWorkflow = selectedWorkflowId ? admin.workflows.find((w) => w.id === selectedWorkflowId) : null;

  // Counters
  const activeAgents = admin.getActiveAgentsCount();
  const activeRules = admin.getActiveRulesCount();
  const workflowCount = admin.workflows.length;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
        {/* ═══ HEADER ═══ */}
        <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setLocation("/")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-teal-700 dark:bg-teal-600 flex items-center justify-center">
                  <span className="text-white font-bold text-xs">S</span>
                </div>
                <span className="font-semibold text-sm tracking-tight">SYNLAB <span className="text-muted-foreground font-normal">· IFRS 16</span></span>
              </div>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium hidden sm:inline-flex">Admin</Badge>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 text-xs text-muted-foreground">
              <div className="hidden md:flex items-center gap-4">
                <span className="flex items-center gap-1"><Bot className="h-3.5 w-3.5" />{activeAgents} agents actifs</span>
                <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{activeRules} règles actives</span>
                <span className="flex items-center gap-1"><WorkflowIcon className="h-3.5 w-3.5" />{workflowCount} workflows</span>
              </div>
              <Separator orientation="vertical" className="h-5 hidden md:block" />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleDark}>
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </header>

        {/* ═══ MAIN CONTENT ═══ */}
        <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5 h-10">
              <TabsTrigger value="workflows" className="text-xs sm:text-sm"><WorkflowIcon className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />Workflows</TabsTrigger>
              <TabsTrigger value="agents" className="text-xs sm:text-sm"><Bot className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />Agents</TabsTrigger>
              <TabsTrigger value="rules" className="text-xs sm:text-sm"><BookOpen className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />Référentiel</TabsTrigger>
              <TabsTrigger value="kb" className="text-xs sm:text-sm"><Database className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />Base KB</TabsTrigger>
              <TabsTrigger value="security" className="text-xs sm:text-sm"><Lock className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />Sécurité</TabsTrigger>
            </TabsList>

            {/* ═══════════════════════════════
                TAB 1: WORKFLOWS
            ═══════════════════════════════ */}
            <TabsContent value="workflows" className="space-y-6">
              {!selectedWorkflow ? (
                <WorkflowList
                  workflows={admin.workflows}
                  agents={admin.agents}
                  onSelect={(id) => setSelectedWorkflowId(id)}
                  onAddWorkflow={() => {
                    const newId = `wf-new-${Date.now()}`;
                    admin.addWorkflow({
                      id: newId,
                      name: "Nouveau workflow",
                      category: "Personnalisé",
                      description: "Workflow personnalisé",
                      status: "brouillon",
                      steps: [],
                    });
                    setSelectedWorkflowId(newId);
                  }}
                />
              ) : (
                <WorkflowDetail
                  workflow={selectedWorkflow}
                  admin={admin}
                  onBack={() => { setSelectedWorkflowId(null); setSelectedStepId(null); setStepSheetWorkflowId(null); }}
                  onSelectStep={(wfId, stepId) => { setStepSheetWorkflowId(wfId); setSelectedStepId(stepId); }}
                />
              )}
            </TabsContent>

            {/* ═══════════════════════════════
                TAB 2: AGENTS
            ═══════════════════════════════ */}
            <TabsContent value="agents" className="space-y-4">
              <AgentsGrid
                agents={admin.agents}
                workflows={admin.workflows}
                rules={admin.rules}
                kb={admin.kb}
                onToggle={admin.toggleAgent}
                onSelect={(id) => setSelectedAgentId(id)}
              />
            </TabsContent>

            {/* ═══════════════════════════════
                TAB 3: RÉFÉRENTIEL NORMATIF
            ═══════════════════════════════ */}
            <TabsContent value="rules" className="space-y-4">
              <RulesTab rules={admin.rules} onToggle={admin.toggleRule} onSelect={(id) => setSelectedRuleId(id)} />
            </TabsContent>

            {/* ═══════════════════════════════
                TAB 4: BASE DE CONNAISSANCES
            ═══════════════════════════════ */}
            <TabsContent value="kb" className="space-y-4">
              <KBTab kb={admin.kb} onSelect={(id) => setSelectedKBId(id)} onAdd={admin.addKBEntry} />
            </TabsContent>

            {/* ═══════════════════════════════
                TAB 5: SÉCURITÉ & HABILITATIONS
            ═══════════════════════════════ */}
            <TabsContent value="security" className="space-y-4">
              <SecurityTab />
            </TabsContent>
          </Tabs>
        </main>

        {/* ═══ STEP CONFIG SHEET (P1) ═══ */}
        <StepConfigSheet
          open={!!selectedStepId && !!stepSheetWorkflowId}
          onClose={() => { setSelectedStepId(null); setStepSheetWorkflowId(null); }}
          workflowId={stepSheetWorkflowId}
          stepId={selectedStepId}
          admin={admin}
        />

        {/* ═══ AGENT DETAIL DIALOG ═══ */}
        <AgentDetailDialog
          agentId={selectedAgentId}
          onClose={() => setSelectedAgentId(null)}
          admin={admin}
        />

        {/* ═══ RULE DETAIL DIALOG (P2) ═══ */}
        <RuleDetailDialog
          ruleId={selectedRuleId}
          onClose={() => setSelectedRuleId(null)}
          admin={admin}
        />

        {/* ═══ KB DETAIL DIALOG ═══ */}
        <KBDetailDialog
          kbId={selectedKBId}
          onClose={() => setSelectedKBId(null)}
          admin={admin}
        />
      </div>
    </TooltipProvider>
  );
}

// ════════════════════════════════════════
// WORKFLOW LIST
// ════════════════════════════════════════

function WorkflowList({
  workflows,
  agents,
  onSelect,
  onAddWorkflow,
}: {
  workflows: Workflow[];
  agents: Agent[];
  onSelect: (id: string) => void;
  onAddWorkflow: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Workflows IFRS 16</h2>
          <p className="text-sm text-muted-foreground">Pipelines de traitement automatisé des contrats de location</p>
        </div>
        <Button size="sm" onClick={onAddWorkflow}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Créer un workflow
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {workflows.map((wf) => {
          const uniqueAgents = new Set(wf.steps.map((s) => s.agentConfig.agentId));
          return (
            <Card
              key={wf.id}
              className="cursor-pointer hover:border-teal-300 dark:hover:border-teal-700 transition-colors group"
              onClick={() => onSelect(wf.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 min-w-0">
                    <CardTitle className="text-base leading-tight">{wf.name}</CardTitle>
                    <CardDescription className="text-xs">{wf.category}</CardDescription>
                  </div>
                  <Badge className={`shrink-0 text-[10px] ${workflowStatusColors[wf.status]}`} variant="secondary">
                    {workflowStatusLabels[wf.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{wf.description}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{wf.steps.length} étapes</span>
                  <span>{uniqueAgents.size} agents</span>
                </div>
                {/* Agent avatars */}
                <div className="flex -space-x-1.5 mt-3">
                  {Array.from(uniqueAgents).slice(0, 6).map((agentId) => {
                    const agent = agents.find((a) => a.id === agentId);
                    if (!agent) return null;
                    return (
                      <Tooltip key={agentId}>
                        <TooltipTrigger asChild>
                          <div
                            className="h-6 w-6 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center text-white text-[9px] font-bold"
                            style={{ backgroundColor: agent.color }}
                          >
                            {agent.name.charAt(agent.name.indexOf("d'") >= 0 ? agent.name.indexOf("d'") + 2 : agent.name.lastIndexOf(" ") + 1)}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top"><p className="text-xs">{agent.name}</p></TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                <div className="flex justify-end mt-2">
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-teal-600 transition-colors" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// WORKFLOW DETAIL + PIPELINE
// ════════════════════════════════════════

function WorkflowDetail({
  workflow,
  admin,
  onBack,
  onSelectStep,
}: {
  workflow: Workflow;
  admin: ReturnType<typeof useAdmin>;
  onBack: () => void;
  onSelectStep: (workflowId: string, stepId: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Breadcrumb + status */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onBack}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Retour
            </Button>
            <Badge className={`text-[10px] ${workflowStatusColors[workflow.status]}`} variant="secondary">
              {workflowStatusLabels[workflow.status]}
            </Badge>
          </div>
          <h2 className="text-xl font-semibold">{workflow.name}</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">{workflow.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={workflow.status}
            onValueChange={(val) => admin.updateWorkflow(workflow.id, { status: val as WorkflowStatus })}
          >
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="actif">Actif</SelectItem>
              <SelectItem value="brouillon">Brouillon</SelectItem>
              <SelectItem value="inactif">Inactif</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Pipeline visualization */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Pipeline d'exécution</CardTitle>
          <CardDescription className="text-xs">Cliquez sur un agent pour configurer ses règles et sources de connaissances</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <div className="flex items-center gap-2 py-4 px-2 min-w-max">
              {workflow.steps.map((step, idx) => {
                const agent = admin.getAgentById(step.agentConfig.agentId);
                const rulesCount = step.agentConfig.assignedRuleIds.length;
                const kbCount = step.agentConfig.assignedKBIds.length;
                return (
                  <div key={step.id} className="flex items-center gap-2">
                    {/* Step bubble */}
                    <div className="relative group">
                      <button
                        onClick={() => onSelectStep(workflow.id, step.id)}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-teal-400 dark:hover:border-teal-600 hover:shadow-md transition-all min-w-[120px] max-w-[160px]"
                      >
                        <div
                          className="h-10 w-10 rounded-full flex items-center justify-center text-white shadow-sm"
                          style={{ backgroundColor: agent?.color || "#6b7280" }}
                        >
                          {agent ? agentIconMap[agent.icon] || <Bot className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                        </div>
                        <span className="text-[11px] font-medium text-center leading-tight">{step.label}</span>
                        <span className="text-[10px] text-muted-foreground">{agent?.name || "—"}</span>
                        <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                          <span>{rulesCount} règle{rulesCount !== 1 ? "s" : ""}</span>
                          <span>{kbCount} KB</span>
                        </div>
                      </button>
                      {/* Remove step × button */}
                      {workflow.steps.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); admin.removeWorkflowStep(workflow.id, step.id); }}
                          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                      {/* Step number */}
                      <div className="absolute -top-2 -left-1 h-4 w-4 rounded-full bg-gray-700 dark:bg-gray-300 text-white dark:text-gray-900 text-[9px] font-bold flex items-center justify-center">
                        {step.order}
                      </div>
                    </div>
                    {/* Arrow between steps */}
                    {idx < workflow.steps.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-gray-300 dark:text-gray-600 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          {workflow.steps.length === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground">Aucune étape configurée. Ajoutez un agent pour commencer.</div>
          )}
        </CardContent>
      </Card>

      {/* Steps table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Détail des étapes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px] text-xs">#</TableHead>
                <TableHead className="text-xs">Étape</TableHead>
                <TableHead className="text-xs">Agent</TableHead>
                <TableHead className="text-xs">Modèle</TableHead>
                <TableHead className="text-xs text-center">Règles</TableHead>
                <TableHead className="text-xs text-center">KB</TableHead>
                <TableHead className="text-xs w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflow.steps.map((step) => {
                const agent = admin.getAgentById(step.agentConfig.agentId);
                return (
                  <TableRow key={step.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50" onClick={() => onSelectStep(workflow.id, step.id)}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{step.order}</TableCell>
                    <TableCell className="text-xs font-medium">{step.label}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full flex items-center justify-center text-white text-[8px]" style={{ backgroundColor: agent?.color || "#6b7280" }}>
                          {agent ? agentIconMap[agent.icon] || <Bot className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                        </div>
                        <span className="text-xs">{agent?.name || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{agent ? modelLabels[agent.model] : "—"}</TableCell>
                    <TableCell className="text-center text-xs">{step.agentConfig.assignedRuleIds.length}</TableCell>
                    <TableCell className="text-center text-xs">{step.agentConfig.assignedKBIds.length}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); onSelectStep(workflow.id, step.id); }}>
                        <Settings2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════
// STEP CONFIG SHEET (P1: per-agent-per-step rules/KB)
// ════════════════════════════════════════

function StepConfigSheet({
  open,
  onClose,
  workflowId,
  stepId,
  admin,
}: {
  open: boolean;
  onClose: () => void;
  workflowId: string | null;
  stepId: string | null;
  admin: ReturnType<typeof useAdmin>;
}) {
  const workflow = workflowId ? admin.workflows.find((w) => w.id === workflowId) : null;
  const step = workflow?.steps.find((s) => s.id === stepId);
  const agent = step ? admin.getAgentById(step.agentConfig.agentId) : null;

  // Group rules by category
  const rulesByCategory = useMemo(() => {
    const groups: Record<RuleCategory, Rule[]> = {
      identification: [],
      exemptions: [],
      evaluation: [],
      comptabilisation: [],
      reporting: [],
    };
    admin.rules.forEach((r) => groups[r.category].push(r));
    return groups;
  }, [admin.rules]);

  if (!workflow || !step || !agent) {
    return (
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Configuration de l'étape</SheetTitle>
            <SheetDescription>Chargement…</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  const assignedRules = step.agentConfig.assignedRuleIds;
  const assignedKBs = step.agentConfig.assignedKBIds;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-800">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: agent.color }}>
                {agentIconMap[agent.icon] || <Bot className="h-4 w-4" />}
              </div>
              <div>
                <SheetTitle className="text-base">{step.label}</SheetTitle>
                <SheetDescription className="text-xs">{agent.name} · {modelLabels[agent.model]}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <p className="text-xs text-muted-foreground mt-2">{agent.role}</p>
        </div>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            {/* P1: Assigned Rules */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5 text-teal-600" />
                Règles assignées à cette étape
              </h4>
              <div className="space-y-3">
                {(Object.keys(rulesByCategory) as RuleCategory[]).map((cat) => {
                  const catRules = rulesByCategory[cat];
                  if (catRules.length === 0) return null;
                  return (
                    <div key={cat}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{categoryLabels[cat]}</p>
                      <div className="space-y-1">
                        {catRules.map((rule) => {
                          const checked = assignedRules.includes(rule.id);
                          return (
                            <label key={rule.id} className="flex items-start gap-2 py-1 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(val) => {
                                  if (val) {
                                    admin.assignRuleToStep(workflow.id, step.id, rule.id);
                                  } else {
                                    admin.unassignRuleFromStep(workflow.id, step.id, rule.id);
                                  }
                                }}
                                className="mt-0.5"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-mono text-muted-foreground">{rule.code}</span>
                                  <span className="text-xs font-medium">{rule.title}</span>
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* P1: Assigned KB */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-teal-600" />
                Sources de connaissances assignées
              </h4>
              <div className="space-y-1">
                {admin.kb.map((entry) => {
                  const checked = assignedKBs.includes(entry.id);
                  return (
                    <label key={entry.id} className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(val) => {
                          if (val) {
                            admin.assignKBToStep(workflow.id, step.id, entry.id);
                          } else {
                            admin.unassignKBFromStep(workflow.id, step.id, entry.id);
                          }
                        }}
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-medium">{entry.title}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">{kbTypeLabels[entry.type]}</Badge>
                          <span className="text-[10px] text-muted-foreground">{entry.source}</span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{assignedRules.length} règle{assignedRules.length !== 1 ? "s" : ""} · {assignedKBs.length} source{assignedKBs.length !== 1 ? "s" : ""} KB</span>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onClose}>Fermer</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ════════════════════════════════════════
// AGENTS GRID (TAB 2)
// ════════════════════════════════════════

function AgentsGrid({
  agents,
  workflows,
  rules,
  kb,
  onToggle,
  onSelect,
}: {
  agents: Agent[];
  workflows: Workflow[];
  rules: Rule[];
  kb: KBEntry[];
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Agents IA</h2>
        <p className="text-sm text-muted-foreground">10 agents spécialisés dans le traitement IFRS 16</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {agents.map((agent) => {
          const wfCount = workflows.filter((w) => w.steps.some((s) => s.agentConfig.agentId === agent.id)).length;
          const rulesCount = new Set(workflows.flatMap((w) => w.steps.filter((s) => s.agentConfig.agentId === agent.id).flatMap((s) => s.agentConfig.assignedRuleIds))).size;
          const kbCount = new Set(workflows.flatMap((w) => w.steps.filter((s) => s.agentConfig.agentId === agent.id).flatMap((s) => s.agentConfig.assignedKBIds))).size;
          return (
            <Card
              key={agent.id}
              className={`cursor-pointer transition-all hover:shadow-md ${!agent.enabled ? "opacity-50" : ""}`}
              onClick={() => onSelect(agent.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center text-white shadow-sm"
                      style={{ backgroundColor: agent.color }}
                    >
                      {agentIconMap[agent.icon] || <Bot className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{agent.name}</p>
                      <p className="text-[10px] text-muted-foreground">{modelLabels[agent.model]}</p>
                    </div>
                  </div>
                  <Switch
                    checked={agent.enabled}
                    onCheckedChange={() => onToggle(agent.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="scale-75"
                  />
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{agent.role}</p>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{wfCount} workflow{wfCount !== 1 ? "s" : ""}</span>
                  <span>{rulesCount} règle{rulesCount !== 1 ? "s" : ""}</span>
                  <span>{kbCount} KB</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// AGENT DETAIL DIALOG
// ════════════════════════════════════════

function AgentDetailDialog({
  agentId,
  onClose,
  admin,
}: {
  agentId: string | null;
  onClose: () => void;
  admin: ReturnType<typeof useAdmin>;
}) {
  const agent = agentId ? admin.getAgentById(agentId) : null;

  if (!agent) {
    return (
      <Dialog open={!!agentId} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Agent</DialogTitle></DialogHeader></DialogContent>
      </Dialog>
    );
  }

  const wfCount = admin.workflows.filter((w) => w.steps.some((s) => s.agentConfig.agentId === agent.id)).length;
  const allRuleIds = new Set(admin.workflows.flatMap((w) => w.steps.filter((s) => s.agentConfig.agentId === agent.id).flatMap((s) => s.agentConfig.assignedRuleIds)));
  const allKBIds = new Set(admin.workflows.flatMap((w) => w.steps.filter((s) => s.agentConfig.agentId === agent.id).flatMap((s) => s.agentConfig.assignedKBIds)));

  return (
    <Dialog open={!!agentId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: agent.color }}>
              {agentIconMap[agent.icon] || <Bot className="h-5 w-5" />}
            </div>
            <div>
              <DialogTitle className="text-base">{agent.name}</DialogTitle>
              <p className="text-xs text-muted-foreground">{agent.role}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground">{agent.description}</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Modèle</label>
              <Select
                value={agent.model}
                onValueChange={(val) => admin.updateAgent(agent.id, { model: val as AgentModel })}
              >
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="claude-3.5-sonnet">Claude 3.5 Sonnet</SelectItem>
                  <SelectItem value="mistral-large">Mistral Large</SelectItem>
                  <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Statut</label>
              <div className="flex items-center gap-2 mt-2">
                <Switch
                  checked={agent.enabled}
                  onCheckedChange={() => admin.toggleAgent(agent.id)}
                />
                <span className="text-xs">{agent.enabled ? "Actif" : "Inactif"}</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{wfCount}</p>
              <p className="text-[10px] text-muted-foreground">Workflows</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{allRuleIds.size}</p>
              <p className="text-[10px] text-muted-foreground">Règles assignées</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{allKBIds.size}</p>
              <p className="text-[10px] text-muted-foreground">Sources KB</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════
// RULES TAB (TAB 3)  —  P2 enrichment
// ════════════════════════════════════════

function RulesTab({
  rules,
  onToggle,
  onSelect,
}: {
  rules: Rule[];
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const grouped = useMemo(() => {
    const g: Record<RuleCategory, Rule[]> = {
      identification: [],
      exemptions: [],
      evaluation: [],
      comptabilisation: [],
      reporting: [],
    };
    rules.forEach((r) => g[r.category].push(r));
    return g;
  }, [rules]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Référentiel normatif IFRS 16</h2>
        <p className="text-sm text-muted-foreground">23 règles enrichies avec instructions de traitement, formules et critères de validation</p>
      </div>

      <Accordion type="multiple" defaultValue={Object.keys(grouped)} className="space-y-2">
        {(Object.keys(grouped) as RuleCategory[]).map((cat) => {
          const catRules = grouped[cat];
          if (catRules.length === 0) return null;
          return (
            <AccordionItem key={cat} value={cat} className="border rounded-lg bg-white dark:bg-gray-900/50 px-4">
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] ${categoryColors[cat]}`} variant="secondary">{categoryLabels[cat]}</Badge>
                  <span className="text-sm font-medium">{catRules.length} règle{catRules.length !== 1 ? "s" : ""}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1 pb-2">
                  {catRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center gap-3 py-2 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer group"
                      onClick={() => onSelect(rule.id)}
                    >
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={() => onToggle(rule.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="scale-75 shrink-0"
                      />
                      <span className="text-xs font-mono text-muted-foreground w-[100px] shrink-0">{rule.code}</span>
                      <span className="text-xs font-medium flex-1 min-w-0 truncate">{rule.title}</span>
                      <Badge className={`text-[9px] px-1.5 py-0 shrink-0 ${ruleTypeColors[rule.type]}`} variant="secondary">
                        {ruleTypeLabels[rule.type]}
                      </Badge>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

// ════════════════════════════════════════
// RULE DETAIL DIALOG (P2: full enrichment)
// ════════════════════════════════════════

function RuleDetailDialog({
  ruleId,
  onClose,
  admin,
}: {
  ruleId: string | null;
  onClose: () => void;
  admin: ReturnType<typeof useAdmin>;
}) {
  const rule = ruleId ? admin.getRuleById(ruleId) : null;

  if (!rule) {
    return (
      <Dialog open={!!ruleId} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Règle</DialogTitle></DialogHeader></DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={!!ruleId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm text-muted-foreground">{rule.code}</span>
                <Badge className={`text-[10px] ${categoryColors[rule.category]}`} variant="secondary">{categoryLabels[rule.category]}</Badge>
                <Badge className={`text-[10px] ${ruleTypeColors[rule.type]}`} variant="secondary">{ruleTypeLabels[rule.type]}</Badge>
              </div>
              <DialogTitle className="text-base leading-snug">{rule.title}</DialogTitle>
            </div>
            <Switch
              checked={rule.enabled}
              onCheckedChange={() => admin.toggleRule(rule.id)}
            />
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 pb-4">
            {/* Description & Reference */}
            <div>
              <p className="text-sm text-muted-foreground">{rule.description}</p>
              <p className="text-xs text-muted-foreground mt-1">Réf. : {rule.reference}</p>
            </div>

            <Separator />

            {/* P2: Instructions de traitement */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400 mb-2 flex items-center gap-1.5">
                <Settings2 className="h-3.5 w-3.5" />
                Instructions de traitement
              </h4>
              <div className="bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                <pre className="text-xs leading-relaxed whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-200">{rule.instructionsTraitement}</pre>
              </div>
            </div>

            {/* Formules de calcul */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Calculator className="h-3.5 w-3.5" />
                Formules de calcul
              </h4>
              <div className="bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono text-gray-800 dark:text-gray-200">{rule.formulesCalcul}</pre>
              </div>
            </div>

            {/* Critères de validation */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Critères de validation
              </h4>
              <div className="bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                <pre className="text-xs leading-relaxed whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-200">{rule.criteresValidation}</pre>
              </div>
            </div>

            {/* Format d'entrée & sortie */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                  Format d'entrée
                </h4>
                <div className="bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                  <pre className="text-[11px] leading-relaxed whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-200">{rule.formatEntree}</pre>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5" />
                  Format de sortie
                </h4>
                <div className="bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                  <pre className="text-[11px] leading-relaxed whitespace-pre-wrap font-mono text-gray-800 dark:text-gray-200">{rule.formatSortie}</pre>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════
// KB TAB (TAB 4)
// ════════════════════════════════════════

function KBTab({
  kb,
  onSelect,
  onAdd,
}: {
  kb: KBEntry[];
  onSelect: (id: string) => void;
  onAdd: (entry: KBEntry) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Base de connaissances</h2>
          <p className="text-sm text-muted-foreground">Sources normatives, réglementaires et internes alimentant les agents</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            onAdd({
              id: `kb-new-${Date.now()}`,
              title: "Nouvelle source",
              type: "interne",
              status: "en_vigueur",
              source: "SYNLAB",
              description: "Description de la source",
              contenu: "",
              dateEffet: new Date().toISOString().split("T")[0],
            });
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Ajouter une source
        </Button>
      </div>

      <div className="space-y-2">
        {kb.map((entry) => (
          <Card
            key={entry.id}
            className="cursor-pointer hover:border-teal-300 dark:hover:border-teal-700 transition-colors"
            onClick={() => onSelect(entry.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{entry.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{entry.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{kbTypeLabels[entry.type]}</Badge>
                    <Badge className={`text-[9px] px-1.5 py-0 ${kbStatusColors[entry.status]}`} variant="secondary">{kbStatusLabels[entry.status]}</Badge>
                    <span className="text-[10px] text-muted-foreground">{entry.source}</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// KB DETAIL DIALOG
// ════════════════════════════════════════

function KBDetailDialog({
  kbId,
  onClose,
  admin,
}: {
  kbId: string | null;
  onClose: () => void;
  admin: ReturnType<typeof useAdmin>;
}) {
  const entry = kbId ? admin.getKBById(kbId) : null;

  if (!entry) {
    return (
      <Dialog open={!!kbId} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Source</DialogTitle></DialogHeader></DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={!!kbId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-[10px]">{kbTypeLabels[entry.type]}</Badge>
            <Badge className={`text-[10px] ${kbStatusColors[entry.status]}`} variant="secondary">{kbStatusLabels[entry.status]}</Badge>
          </div>
          <DialogTitle className="text-base">{entry.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground">{entry.description}</p>

          <Separator />

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Contenu</h4>
            <div className="bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
              <p className="text-xs leading-relaxed text-gray-800 dark:text-gray-200">{entry.contenu || "Aucun contenu renseigné"}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-semibold text-muted-foreground">Source</span>
              <p className="mt-0.5">{entry.source}</p>
            </div>
            <div>
              <span className="font-semibold text-muted-foreground">Date d'effet</span>
              <p className="mt-0.5">{entry.dateEffet}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════
// SECURITY TAB (TAB 5)
// ════════════════════════════════════════

const roles = ["Comptable", "Contrôleur", "DAF", "Auditeur"] as const;

const permissions = [
  { key: "read", label: "Lecture", icon: <Eye className="h-3.5 w-3.5" /> },
  { key: "write", label: "Écriture", icon: <Pencil className="h-3.5 w-3.5" /> },
  { key: "validate", label: "Validation", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  { key: "export", label: "Export", icon: <Download className="h-3.5 w-3.5" /> },
  { key: "configure", label: "Configuration", icon: <Cog className="h-3.5 w-3.5" /> },
] as const;

type RoleName = (typeof roles)[number];
type PermKey = (typeof permissions)[number]["key"];

const defaultMatrix: Record<RoleName, Record<PermKey, boolean>> = {
  Comptable: { read: true, write: true, validate: false, export: true, configure: false },
  Contrôleur: { read: true, write: true, validate: true, export: true, configure: false },
  DAF: { read: true, write: true, validate: true, export: true, configure: true },
  Auditeur: { read: true, write: false, validate: false, export: true, configure: false },
};

function SecurityTab() {
  const [matrix, setMatrix] = useState(defaultMatrix);

  const toggle = (role: RoleName, perm: PermKey) => {
    setMatrix((prev) => ({
      ...prev,
      [role]: { ...prev[role], [perm]: !prev[role][perm] },
    }));
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Sécurité & habilitations</h2>
        <p className="text-sm text-muted-foreground">Matrice des permissions par rôle — contrôle d'accès à la plateforme IFRS 16</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-[140px]">Rôle</TableHead>
                {permissions.map((p) => (
                  <TableHead key={p.key} className="text-xs text-center">
                    <div className="flex flex-col items-center gap-1">
                      {p.icon}
                      <span>{p.label}</span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role}>
                  <TableCell className="font-medium text-sm">{role}</TableCell>
                  {permissions.map((p) => (
                    <TableCell key={p.key} className="text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={matrix[role][p.key]}
                          onCheckedChange={() => toggle(role, p.key)}
                        />
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Role descriptions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { role: "Comptable", desc: "Saisie des baux, génération des écritures, consultation des tableaux d'amortissement." },
          { role: "Contrôleur", desc: "Validation des traitements, vérification des règles appliquées, approbation des écritures." },
          { role: "DAF", desc: "Administration complète, configuration des workflows, accès à tous les rapports et paramètres." },
          { role: "Auditeur", desc: "Consultation en lecture seule, export des données pour piste d'audit, vérification de conformité." },
        ].map(({ role, desc }) => (
          <Card key={role}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-sm font-semibold">{role}</p>
              </div>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
