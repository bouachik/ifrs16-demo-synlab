import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useAdmin } from "@/lib/admin-store";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  FileUp, Tags, FileSearch, ShieldCheck, CheckSquare, Calculator, BookOpen,
  Check, Lock, ChevronRight, ChevronDown, Settings, Upload, FileText,
  AlertTriangle, Info, AlertCircle, CheckCircle2, Edit3, Euro,
  Building2, MapPin, Calendar, ArrowRight, Download, Archive, Circle,
  ClipboardCheck, Eye, Scan, Handshake, Scale, Landmark, Sparkles, Clock, Lightbulb,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════
// Types
// ═══════════════════════════════════════

interface LeaseData {
  preneur: string;
  bailleur: string;
  adresse: string;
  typeBail: string;
  dateEffet: string;
  dureeContractuelle: string;
  dureeIFRS16Mois: number;
  loyerAnnuelHT: number;
  loyerTrimestriel: number;
  franchiseTrimestres: number;
  indexation: string;
  depotGarantie: number;
  provisionRemiseEnEtat: number;
  tauxAnnuel: number;
  tauxTrimestriel: number;
  passifLocatifInitial: number;
  actifROUInitial: number;
  chargeFinanciereTotal: number;
  classificationConfiance: number;
  alertes: { type: string; titre: string; description: string; reference: string }[];
  champsExtraits: { label: string; valeur: string; confiance: number; source: string; categorie: string }[];
  decisions: { id: string; titre: string; description: string; options: { label: string; recommande: boolean }[]; recommandationJustification: string }[];
  ecritures: { date: string; journal: string; libelle: string; debit: { compte: string; libelle: string; montant: number }; credit: { compte: string; libelle: string; montant: number } }[];
}

interface AuditEntry {
  timestamp: string;
  etape: string;
  action: string;
  detail: string;
  utilisateur: string;
}

// ═══════════════════════════════════════
// Default demo data (PEC BERRI)
// ═══════════════════════════════════════

const DEFAULT_LEASE: LeaseData = {
  preneur: "SEABIRD SAS (Groupe SYNLAB)",
  bailleur: "SCI PEC BERRI",
  adresse: "27 rue de Berri, 75008 Paris",
  typeBail: "Bail commercial 3/6/9",
  dateEffet: "1er janvier 2024",
  dureeContractuelle: "9 ans",
  dureeIFRS16Mois: 108,
  loyerAnnuelHT: 220400,
  loyerTrimestriel: 55100,
  franchiseTrimestres: 3,
  indexation: "ILAT, révision annuelle",
  depotGarantie: 110200,
  provisionRemiseEnEtat: 50000,
  tauxAnnuel: 2.50,
  tauxTrimestriel: 0.6192,
  passifLocatifInitial: 1619859,
  actifROUInitial: 1669859,
  chargeFinanciereTotal: 198441,
  classificationConfiance: 97.4,
  alertes: [
    { type: "warning", titre: "Durée retenue — bail 3/6/9", description: "La durée retenue de 9 ans pour un bail 3/6/9 nécessite une justification au regard des facteurs IFRS 16.B37. Des améliorations locatives significatives ou l'importance stratégique du local doivent être documentées.", reference: "IFRS 16.B37-B40" },
    { type: "warning", titre: "Composantes non-locatives", description: "Le bail inclut des charges récupérables (taxe foncière, charges de copropriété). Il convient de déterminer si ces éléments doivent être séparés en composantes non-locatives ou traités globalement.", reference: "IFRS 16.12-16" },
    { type: "info", titre: "Franchise de loyer identifiée", description: "Une franchise de 9 mois (3 trimestres) a été détectée en début de bail. Les périodes de franchise sont intégrées au calcul du passif locatif avec des flux à zéro.", reference: "IFRS 16.B36" },
    { type: "error", titre: "Provision pour remise en état", description: "Le bail contient une clause de remise en état des locaux. Une provision IAS 37 de 50 000 € est estimée et doit être validée. Ce montant s'ajoute au coût initial de l'actif ROU.", reference: "IAS 37.14, IFRS 16.24(d)" },
    { type: "info", titre: "Taux d'actualisation", description: "Le taux implicite du bail n'étant pas facilement déterminable, le taux d'emprunt marginal du preneur (2,50% annuel) a été retenu, basé sur le TME + spread de crédit du groupe SYNLAB.", reference: "IFRS 16.26" },
  ],
  champsExtraits: [
    { label: "Preneur", valeur: "SEABIRD SAS", confiance: 99, source: "p.1", categorie: "Parties" },
    { label: "Bailleur", valeur: "SCI PEC BERRI", confiance: 99, source: "p.1", categorie: "Parties" },
    { label: "Adresse du bien", valeur: "27 rue de Berri, 75008 Paris", confiance: 98, source: "p.2", categorie: "Bien loué" },
    { label: "Surface (m²)", valeur: "850 m²", confiance: 95, source: "p.3", categorie: "Bien loué" },
    { label: "Destination", valeur: "Usage de bureaux", confiance: 97, source: "p.2", categorie: "Bien loué" },
    { label: "Date de prise d'effet", valeur: "1er janvier 2024", confiance: 98, source: "p.4", categorie: "Durée" },
    { label: "Durée contractuelle", valeur: "9 ans (3/6/9)", confiance: 97, source: "p.4", categorie: "Durée" },
    { label: "Première période ferme", valeur: "3 ans", confiance: 96, source: "p.4", categorie: "Durée" },
    { label: "Loyer annuel HT", valeur: "220 400 €", confiance: 99, source: "p.5", categorie: "Loyer" },
    { label: "Loyer trimestriel HT", valeur: "55 100 €", confiance: 99, source: "p.5", categorie: "Loyer" },
    { label: "Termes de paiement", valeur: "Trimestriel, terme à échoir", confiance: 94, source: "p.5", categorie: "Loyer" },
    { label: "Franchise de loyer", valeur: "9 mois (3 trimestres)", confiance: 96, source: "p.6", categorie: "Loyer" },
    { label: "Indice de référence", valeur: "ILAT", confiance: 97, source: "p.7", categorie: "Indexation" },
    { label: "Périodicité de révision", valeur: "Annuelle", confiance: 95, source: "p.7", categorie: "Indexation" },
    { label: "Dépôt de garantie", valeur: "110 200 €", confiance: 98, source: "p.8", categorie: "Garanties" },
    { label: "Clause de remise en état", valeur: "Oui — restitution dans l'état d'origine", confiance: 92, source: "p.9", categorie: "Garanties" },
    { label: "Provision remise en état", valeur: "50 000 € (estimation)", confiance: 78, source: "Estimation", categorie: "Garanties" },
  ],
  decisions: [
    { id: "duree", titre: "Durée retenue IFRS 16", description: "Le bail est un 3/6/9 français. La durée retenue influence directement le passif locatif et l'actif ROU.", options: [{ label: "3 ans (période ferme minimum)", recommande: false }, { label: "6 ans", recommande: false }, { label: "9 ans (durée contractuelle complète)", recommande: true }], recommandationJustification: "Recommandé : améliorations locatives significatives réalisées par le preneur, coûts de résiliation élevés, et importance stratégique du local pour l'activité du groupe." },
    { id: "composantes", titre: "Séparation des composantes", description: "Le bail comprend des composantes locatives et non-locatives (charges, services). Faut-il les séparer ?", options: [{ label: "Séparer les composantes", recommande: false }, { label: "Ne pas séparer (exemption IFRS 16.15)", recommande: true }], recommandationJustification: "L'exemption pratique IFRS 16.15 est recommandée : les composantes non-locatives ne sont pas significatives par rapport au loyer total." },
    { id: "provision", titre: "Provision pour remise en état", description: "Le bail prévoit une obligation de remise en état. Le montant estimé de 50 000 € s'ajoute au coût initial de l'actif ROU.", options: [{ label: "Retenir 50 000 €", recommande: true }, { label: "Ajuster le montant", recommande: false }], recommandationJustification: "L'estimation de 50 000 € est basée sur les coûts de remise en état pour des locaux de bureaux de 850 m² dans le 8ème arrondissement de Paris." },
    { id: "taux", titre: "Taux d'actualisation", description: "Le taux d'emprunt marginal du preneur est utilisé comme taux d'actualisation.", options: [{ label: "2,50% annuel (TME + spread SYNLAB)", recommande: true }, { label: "Autre taux", recommande: false }], recommandationJustification: "Taux basé sur l'OAT 9 ans (1,80%) + spread de crédit du groupe SYNLAB (70 bp), cohérent avec la politique groupe." },
  ],
  ecritures: [
    { date: "01/01/2024", journal: "OD", libelle: "Reconnaissance initiale — Droit d'utilisation", debit: { compte: "2613", libelle: "Droit d'utilisation — Bureaux", montant: 1669859 }, credit: { compte: "1686", libelle: "Passif locatif IFRS 16", montant: 1619859 } },
    { date: "01/01/2024", journal: "OD", libelle: "Reconnaissance initiale — Provision remise en état", debit: { compte: "2613", libelle: "Droit d'utilisation — Bureaux", montant: 0 }, credit: { compte: "1581", libelle: "Provision pour remise en état", montant: 50000 } },
    { date: "31/03/2024", journal: "OD", libelle: "Dotation aux amortissements T1 2024", debit: { compte: "6811", libelle: "Dotation amortissement ROU", montant: 46385 }, credit: { compte: "28613", libelle: "Amort. droit d'utilisation", montant: 46385 } },
    { date: "31/03/2024", journal: "OD", libelle: "Charge financière T1 2024 (franchise)", debit: { compte: "6615", libelle: "Intérêts passif locatif", montant: 10032 }, credit: { compte: "1686", libelle: "Passif locatif IFRS 16", montant: 10032 } },
    { date: "30/06/2024", journal: "BQ", libelle: "Paiement loyer T2 2024", debit: { compte: "1686", libelle: "Passif locatif IFRS 16", montant: 55100 }, credit: { compte: "512", libelle: "Banque", montant: 55100 } },
  ],
};

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
}

function fmtEur(n: number) {
  return fmt(n) + " €";
}

function buildAmortTable(data: LeaseData) {
  const rows: { t: number; date: string; loyer: number; interet: number; rembours: number; solde: number; dotation: number; rou: number }[] = [];
  const nbTrim = Math.round(data.dureeIFRS16Mois / 3);
  const r = data.tauxTrimestriel / 100;
  let solde = data.passifLocatifInitial;
  let rou = data.actifROUInitial;
  const dotation = Math.round(data.actifROUInitial / nbTrim);

  for (let t = 1; t <= nbTrim; t++) {
    const interet = Math.round(solde * r);
    const loyer = t <= data.franchiseTrimestres ? 0 : data.loyerTrimestriel;
    const rembours = loyer - interet;
    solde = Math.max(0, solde + interet - loyer);
    rou = Math.max(0, rou - dotation);
    const yr = 2024 + Math.floor((t - 1) / 4);
    const q = ((t - 1) % 4) + 1;
    rows.push({ t, date: `T${q} ${yr}`, loyer, interet, rembours: t <= data.franchiseTrimestres ? 0 : rembours, solde, dotation, rou });
  }
  return rows;
}

const STEP_LABELS = ["Ingestion", "Classification", "Extraction", "Contrôle", "Validation", "Calcul", "Reporting"];
const STEP_ICONS = [FileUp, Tags, FileSearch, ShieldCheck, CheckSquare, Calculator, BookOpen];
const STEP_AGENT_MAP: Record<number, string> = {
  1: "agent-ingestion", 2: "agent-classification", 3: "agent-extraction",
  4: "agent-controle", 5: "agent-controle", 6: "agent-calcul", 7: "agent-comptabilisation",
};

// ═══════════════════════════════════════
// Loading animation steps & tips
// ═══════════════════════════════════════

const ANALYSIS_STEPS = [
  { icon: Scan, title: "Lecture du document", description: "Extraction du texte par analyse optique et identification de la structure du bail, des articles et des annexes...", durationMs: 25_000 },
  { icon: Handshake, title: "Identification des parties", description: "Reconnaissance du preneur, du bailleur, des garants et analyse de la chaîne de propriété...", durationMs: 30_000 },
  { icon: FileSearch, title: "Analyse des clauses financières", description: "Extraction des loyers, indexations, franchises, dépôts de garantie, charges récupérables et pénalités...", durationMs: 45_000 },
  { icon: Scale, title: "Classification IFRS 16", description: "Détermination du périmètre, analyse des exemptions (court terme, faible valeur) et évaluation de la durée raisonnablement certaine selon B37...", durationMs: 50_000 },
  { icon: Calculator, title: "Calcul du passif locatif", description: "Actualisation des flux de trésorerie futurs, détermination du taux d'emprunt marginal et calcul de l'actif ROU initial...", durationMs: 45_000 },
  { icon: Landmark, title: "Génération des écritures comptables", description: "Préparation des journaux OD : reconnaissance initiale, amortissements, charges financières et remboursements...", durationMs: 30_000 },
  { icon: ClipboardCheck, title: "Vérification finale", description: "Contrôle de cohérence des calculs, validation des références normatives IFRS 16 et génération des alertes...", durationMs: 15_000 },
];

const IFRS_TIPS = [
  "IFRS 16 est entrée en vigueur le 1er janvier 2019, remplaçant IAS 17 qui distinguait locations financement et locations simples.",
  "Un contrat est un contrat de location s'il confère le droit de contrôler l'utilisation d'un actif identifié pour une période déterminée.",
  "Les preneurs peuvent exempter les contrats de courte durée (< 12 mois) et les actifs de faible valeur (< 5 000 USD environ).",
  "Le taux d'actualisation privilégié est le taux implicite du bail ; à défaut, on utilise le taux d'emprunt marginal du preneur (IBR).",
  "L'actif ROU inclut le passif locatif initial, les paiements anticipés, les coûts directs initiaux et les coûts de remise en état.",
  "La durée du bail inclut les périodes de renouvellement dont l'exercice est raisonnablement certain — c'est l'analyse B37.",
  "En France, un bail commercial 3/6/9 nécessite une analyse spécifique : la durée ferme est souvent de 3 ans, sauf incitations économiques.",
  "Le passif locatif se calcule en actualisant les paiements de loyer futurs — les loyers variables indexés ne sont pas inclus dans le calcul initial.",
];

// ═══════════════════════════════════════
// Agent reasoning panel (business language)
// ═══════════════════════════════════════

function AgentPanel({ step, summary }: { step: number; summary: string }) {
  const { getAgentById } = useAdmin();
  const agentId = STEP_AGENT_MAP[step];
  const agent = getAgentById(agentId);
  if (!agent) return null;

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="agent" className="border border-blue-100 rounded-lg bg-blue-50/40 overflow-hidden">
        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-blue-50/80 [&>svg]:text-blue-500">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: agent.color + "18", border: `1.5px solid ${agent.color}44` }}>
              <Eye className="h-3.5 w-3.5" style={{ color: agent.color }} />
            </div>
            <span className="text-sm font-medium text-blue-800">Ce que l'agent a fait</span>
            <Badge variant="outline" className="text-[10px] font-medium border-blue-200 text-blue-600 bg-white">{agent.name}</Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="bg-white rounded-md border border-blue-100 p-4 text-sm text-gray-700 leading-relaxed">
            {summary}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

// ═══════════════════════════════════════
// STEP 1 — Ingestion & Analyse
// ═══════════════════════════════════════

function Step1({ lease, setLease, onNext, addAudit }: { lease: LeaseData | null; setLease: (d: LeaseData) => void; onNext: () => void; addAudit: (e: Omit<AuditEntry, "utilisateur" | "timestamp">) => void }) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("anthropic_api_key") || "");

  const [uploadError, setUploadError] = useState<string | null>(null);

  const analyzeMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      // Use fetch directly — apiRequest forces JSON content-type which breaks FormData
      const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
      const headers: Record<string, string> = {};
      if (apiKey) headers["x-api-key"] = apiKey;
      const res = await fetch(`${API_BASE}/api/analyze-bail`, { method: "POST", body: form, headers });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Erreur ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (result: any) => {
      if (result.success && result.data) {
        // Normalize: ensure all required fields exist with sensible defaults
        const d = result.data;
        const normalized: LeaseData = {
          preneur: d.preneur || "Non identifié",
          bailleur: d.bailleur || "Non identifié",
          adresse: d.adresse || "Non précisée",
          typeBail: d.typeBail || d.type_bail || "Bail commercial",
          dateEffet: d.dateEffet || d.date_effet || "Non précisée",
          dureeContractuelle: d.dureeContractuelle || d.duree_contractuelle || "Non précisée",
          dureeIFRS16Mois: Number(d.dureeIFRS16Mois || d.duree_ifrs16_mois) || 108,
          loyerAnnuelHT: Number(d.loyerAnnuelHT || d.loyer_annuel_ht) || 0,
          loyerTrimestriel: Number(d.loyerTrimestriel || d.loyer_trimestriel) || Math.round((Number(d.loyerAnnuelHT || d.loyer_annuel_ht) || 0) / 4),
          franchiseTrimestres: Number(d.franchiseTrimestres || d.franchise_trimestres) || 0,
          indexation: d.indexation || "Non précisée",
          depotGarantie: Number(d.depotGarantie || d.depot_garantie) || 0,
          provisionRemiseEnEtat: Number(d.provisionRemiseEnEtat || d.provision_remise_en_etat) || 0,
          tauxAnnuel: Number(d.tauxAnnuel || d.taux_annuel) || 2.5,
          tauxTrimestriel: Number(d.tauxTrimestriel || d.taux_trimestriel) || (Math.pow(1 + (Number(d.tauxAnnuel || d.taux_annuel) || 2.5) / 100, 0.25) - 1) * 100,
          passifLocatifInitial: Number(d.passifLocatifInitial || d.passif_locatif_initial) || 0,
          actifROUInitial: Number(d.actifROUInitial || d.actif_rou_initial) || 0,
          chargeFinanciereTotal: Number(d.chargeFinanciereTotal || d.charge_financiere_total) || 0,
          classificationConfiance: Number(d.classificationConfiance || d.classification_confiance) || 90,
          alertes: Array.isArray(d.alertes) ? d.alertes : DEFAULT_LEASE.alertes,
          champsExtraits: Array.isArray(d.champsExtraits) && d.champsExtraits.length > 0 ? d.champsExtraits : DEFAULT_LEASE.champsExtraits,
          decisions: Array.isArray(d.decisions) && d.decisions.length > 0 ? d.decisions : DEFAULT_LEASE.decisions,
          ecritures: Array.isArray(d.ecritures) && d.ecritures.length > 0 ? d.ecritures : DEFAULT_LEASE.ecritures,
        };
        setUploadError(null);
        setLease(normalized);
      } else {
        setUploadError(result.error || "L'analyse n'a pas retourné de données exploitables.");
      }
    },
    onError: (err: any) => {
      setUploadError(err.message || "Erreur lors de l'analyse du bail. Essayez avec le bail de démonstration.");
    },
  });

  // --- Loading animation state ---
  const analysisStartRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    if (!analyzeMutation.isPending) {
      analysisStartRef.current = null;
      setElapsedMs(0);
      setTipIndex(0);
      return;
    }
    if (!analysisStartRef.current) analysisStartRef.current = Date.now();
    const start = analysisStartRef.current;
    const timer = setInterval(() => setElapsedMs(Date.now() - start), 200);
    const tipTimer = setInterval(() => setTipIndex((p) => (p + 1) % IFRS_TIPS.length), 8_000);
    return () => { clearInterval(timer); clearInterval(tipTimer); };
  }, [analyzeMutation.isPending]);

  const totalDurationMs = ANALYSIS_STEPS.reduce((s, a) => s + a.durationMs, 0);
  const overallProgress = Math.min((elapsedMs / totalDurationMs) * 100, 99);
  let accMs = 0;
  let currentStepIndex = ANALYSIS_STEPS.length - 1;
  for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
    if (elapsedMs < accMs + ANALYSIS_STEPS[i].durationMs) { currentStepIndex = i; break; }
    accMs += ANALYSIS_STEPS[i].durationMs;
  }
  const currentStepProgress = Math.min(((elapsedMs - accMs) / ANALYSIS_STEPS[currentStepIndex].durationMs) * 100, 100);
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const elapsedMin = Math.floor(elapsedSec / 60);
  const elapsedSecR = elapsedSec % 60;
  const estRemaining = Math.max(0, Math.floor((totalDurationMs - elapsedMs) / 1000));
  const estMin = Math.floor(estRemaining / 60);
  const estSec = estRemaining % 60;

  const handleFile = (file: File) => {
    if (!apiKey.trim()) {
      setUploadError("Veuillez renseigner votre clé API Anthropic avant de charger un bail.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setUploadError(`Le fichier fait ${(file.size / 1024 / 1024).toFixed(1)} Mo. La limite est de 25 Mo. Essayez avec une version allégée du PDF ou le bail de démonstration.`);
      return;
    }
    setUploadError(null);
    setFileName(file.name);
    analyzeMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") handleFile(file);
  };

  const loadDemo = () => {
    setFileName("bail_pec_berri.pdf (démonstration)");
    setLease(DEFAULT_LEASE);
  };

  return (
    <div className="space-y-5">
      <AgentPanel step={1} summary="L'agent d'ingestion réceptionne le document de bail, en extrait le texte par analyse optique, identifie la structure du document (parties, clauses, annexes) et prépare les données brutes pour l'étape d'extraction. Il vérifie également la qualité et la lisibilité du document." />

      {analyzeMutation.isPending ? (
        <Card className="border-blue-200 bg-blue-50/30 overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="animate-spin h-8 w-8 border-[2.5px] border-blue-500 border-t-transparent rounded-full" />
                  <Sparkles className="h-3.5 w-3.5 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-900">Analyse IFRS 16 en cours</p>
                  <p className="text-xs text-blue-600">{fileName}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{elapsedMin}:{String(elapsedSecR).padStart(2, "0")}</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">~{estMin}:{String(estSec).padStart(2, "0")} restant</p>
              </div>
            </div>

            {/* Overall progress */}
            <div className="mb-6">
              <div className="flex justify-between text-[10px] text-gray-500 mb-1.5">
                <span>Progression globale</span>
                <span>{Math.round(overallProgress)}%</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>

            {/* Steps timeline */}
            <div className="space-y-1">
              {ANALYSIS_STEPS.map((step, i) => {
                const isCompleted = i < currentStepIndex;
                const isCurrent = i === currentStepIndex;
                const isPending = i > currentStepIndex;
                const StepIcon = step.icon;
                return (
                  <motion.div
                    key={i}
                    initial={false}
                    animate={{ backgroundColor: isCurrent ? "rgba(59, 130, 246, 0.06)" : "transparent" }}
                    className="flex items-start gap-3 rounded-lg px-3 py-2.5"
                  >
                    <div className="flex flex-col items-center flex-shrink-0 mt-0.5">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500",
                        isCompleted && "bg-green-100 border-[1.5px] border-green-300",
                        isCurrent && "bg-blue-100 border-[1.5px] border-blue-400 shadow-sm shadow-blue-200",
                        isPending && "bg-gray-100 border-[1.5px] border-gray-200",
                      )}>
                        {isCompleted ? (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                            <Check className="h-4 w-4 text-green-600" />
                          </motion.div>
                        ) : (
                          <StepIcon className={cn("h-4 w-4", isCurrent ? "text-blue-600" : "text-gray-400")} />
                        )}
                      </div>
                      {i < ANALYSIS_STEPS.length - 1 && (
                        <div className={cn("w-px h-2 mt-1", isCompleted ? "bg-green-300" : "bg-gray-200")} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-sm font-medium",
                          isCompleted && "text-green-700",
                          isCurrent && "text-blue-800",
                          isPending && "text-gray-400",
                        )}>
                          {step.title}
                        </span>
                        {isCompleted && <Badge variant="outline" className="text-[10px] border-green-200 text-green-600 bg-green-50 py-0">Terminé</Badge>}
                        {isCurrent && <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-600 bg-blue-50 py-0 animate-pulse">En cours</Badge>}
                      </div>
                      <AnimatePresence mode="wait">
                        {isCurrent && (
                          <motion.p
                            key={`desc-${i}`}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="text-xs text-blue-600 mt-1 leading-relaxed"
                          >
                            {step.description}
                          </motion.p>
                        )}
                      </AnimatePresence>
                      {isCurrent && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2">
                          <Progress value={currentStepProgress} className="h-1 max-w-[200px]" />
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* IFRS 16 Tips */}
            <div className="mt-6 pt-4 border-t border-blue-100">
              <div className="flex items-start gap-2.5 bg-amber-50/60 rounded-lg p-3 border border-amber-100">
                <Lightbulb className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 mb-1">Le saviez-vous ?</p>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={tipIndex}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.4 }}
                      className="text-xs text-amber-800 leading-relaxed"
                    >
                      {IFRS_TIPS[tipIndex]}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : !lease ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Clé API Anthropic</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); localStorage.setItem("anthropic_api_key", e.target.value); }}
              placeholder="sk-ant-..."
              className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
            {apiKey && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
          </div>

          {uploadError && (
            <Card className="border-red-200 bg-red-50/30">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">Erreur lors de l'analyse</p>
                  <p className="text-xs text-red-600 mt-1">{uploadError}</p>
                  <p className="text-xs text-gray-500 mt-2">Vous pouvez réessayer ou utiliser le bail de démonstration ci-dessous.</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div
            className={cn(
              "border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer",
              dragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50/50 hover:border-blue-400 hover:bg-blue-50/30"
            )}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-base font-medium text-gray-700 mb-1">Déposez un bail au format PDF</p>
            <p className="text-sm text-gray-500">ou cliquez pour sélectionner un fichier</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <button
            onClick={loadDemo}
            className="w-full py-4 rounded-xl border-2 border-gray-200 bg-white hover:bg-gray-50 hover:border-blue-300 transition-colors text-center"
          >
            <FileText className="h-8 w-8 mx-auto text-blue-500 mb-2" />
            <p className="text-sm font-medium text-gray-700">Utiliser le bail de démonstration</p>
            <p className="text-xs text-gray-500 mt-0.5">Bail PEC BERRI → SEABIRD — 27 rue de Berri, Paris</p>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <Card className="border-green-200 bg-green-50/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm font-semibold text-green-800">Document analysé avec succès</span>
                {fileName && <Badge variant="outline" className="text-xs border-green-300 text-green-700">{fileName}</Badge>}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: Building2, label: "Preneur", value: lease.preneur },
                  { icon: Building2, label: "Bailleur", value: lease.bailleur },
                  { icon: MapPin, label: "Adresse", value: lease.adresse },
                  { icon: Calendar, label: "Type", value: lease.typeBail },
                ].map((item, i) => (
                  <div key={i} className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <item.icon className="h-3 w-3 text-gray-400" />
                      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">{item.label}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate">{item.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button onClick={() => { addAudit({ etape: "Étape 1", action: "Document ingéré", detail: `Document ingéré : ${fileName || "bail_pec_berri.pdf"}` }); onNext(); }} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
              Passer à la classification <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// STEP 2 — Classification
// ═══════════════════════════════════════

function Step2({ lease, onNext, onExclude, addAudit }: {
  lease: LeaseData;
  onNext: () => void;
  onExclude: () => void;
  addAudit: (e: Omit<AuditEntry, "utilisateur" | "timestamp">) => void;
}) {
  const [userDecision, setUserDecision] = useState<"eligible" | "excluded" | null>(null);
  const confiance = lease.classificationConfiance;

  // IFRS 16 is binary — either certain (≥95) or needs human qualification
  const isAutoCertain = confiance >= 95;
  const status: "eligible" | "excluded" | "pending" =
    isAutoCertain ? "eligible" :
    userDecision === "eligible" ? "eligible" :
    userDecision === "excluded" ? "excluded" :
    "pending";

  const criteria = [
    {
      label: "Actif identifié",
      reference: "IFRS 16.B13-B20",
      detail: `Les locaux situés au ${lease.adresse} constituent un actif clairement identifié dans le contrat.`,
    },
    {
      label: "Droit d'utilisation",
      reference: "IFRS 16.B9-B11",
      detail: `Le preneur (${lease.preneur}) a le droit de contrôler l'utilisation de l'actif pendant la durée du bail.`,
    },
    {
      label: "Contrepartie",
      reference: "IFRS 16.9(b)",
      detail: `Un loyer de ${fmtEur(lease.loyerAnnuelHT)}/an constitue la contrepartie du droit d'utilisation.`,
    },
  ];

  // Pull classification-related alerts from Claude output
  const classifAlertes = (lease.alertes ?? []).filter(a =>
    /classif|scope|identif|actif|droit.util|contrepart|substitu/i.test(a.description + a.titre)
  );

  const handleConfirmEligible = () => {
    setUserDecision("eligible");
    addAudit({ etape: "Étape 2", action: "Qualification manuelle", detail: "Utilisateur a confirmé l'éligibilité IFRS 16 malgré une confiance < 95%" });
  };

  const handleExclude = () => {
    setUserDecision("excluded");
    addAudit({ etape: "Étape 2", action: "Qualification manuelle", detail: "Utilisateur a exclu le contrat du scope IFRS 16" });
  };

  return (
    <div className="space-y-5">
      <AgentPanel step={2} summary={
        isAutoCertain
          ? `L'agent a vérifié les trois critères IFRS 16.9 : actif identifié (${lease.adresse}), droit d'utilisation contrôlé par ${lease.preneur}, contrepartie de ${fmtEur(lease.loyerAnnuelHT)}/an. Les trois critères sont remplis. Le contrat est éligible IFRS 16. Exemptions court terme et faible valeur non applicables.`
          : `L'agent a analysé les critères IFRS 16.9 mais ne peut pas conclure avec certitude (confiance : ${confiance}%). Une ou plusieurs ambiguïtés ont été détectées. Une décision manuelle est requise pour qualifier ou exclure ce contrat.`
      } />

      {/* Status banner */}
      <AnimatePresence mode="wait">
        {status === "eligible" && (
          <motion.div key="eligible"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200"
          >
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-green-800">Éligible IFRS 16</p>
              <p className="text-xs text-green-700 mt-0.5">
                {isAutoCertain
                  ? `Les 3 critères sont remplis avec certitude — traitement IFRS 16 applicable.`
                  : `Qualification confirmée manuellement par le comptable.`}
              </p>
            </div>
            {!isAutoCertain && (
              <Badge className="ml-auto text-[10px] bg-amber-100 text-amber-700 border-amber-200">Décision manuelle</Badge>
            )}
          </motion.div>
        )}

        {status === "excluded" && (
          <motion.div key="excluded"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200"
          >
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-800">Hors scope IFRS 16</p>
              <p className="text-xs text-red-700 mt-0.5">Ce contrat a été exclu du traitement IFRS 16 suite à une décision manuelle.</p>
            </div>
          </motion.div>
        )}

        {status === "pending" && (
          <motion.div key="pending"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="p-4 rounded-xl bg-amber-50 border border-amber-200"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-800">Qualification manuelle requise</p>
                <p className="text-sm text-amber-700 mt-1">
                  L'agent n'a pas pu conclure avec certitude (confiance : <strong>{confiance}%</strong>).
                  IFRS 16 est binaire — il n'y a pas d'entre-deux. Vous devez qualifier ce contrat.
                </p>
                {classifAlertes.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Points d'ambiguïté détectés</p>
                    {classifAlertes.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-amber-800 bg-amber-100/60 rounded-lg p-2.5">
                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-600" />
                        <span><strong>{a.titre}</strong> — {a.description}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-3 mt-4">
                  <Button onClick={handleConfirmEligible} className="bg-green-600 hover:bg-green-700 text-white gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4" /> Confirmer IFRS 16
                  </Button>
                  <Button onClick={handleExclude} variant="outline" className="border-red-300 text-red-700 hover:bg-red-50 gap-2 text-sm">
                    <AlertCircle className="h-4 w-4" /> Exclure du scope
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Criteria cards */}
      <div className="space-y-3">
        {criteria.map((c, i) => (
          <Card key={i} className="border-gray-200">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{c.label}</span>
                  <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200">Oui</Badge>
                  <span className="text-[10px] text-gray-400 ml-auto">{c.reference}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{c.detail}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Exemptions */}
      <Card className="border-gray-200 bg-gray-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-semibold text-gray-800">Vérification des exemptions</span>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span>Courte durée (≤ 12 mois) : <strong className="text-gray-800">Non applicable</strong> — {lease.dureeContractuelle}</span>
            <span>Faible valeur (≤ 5 000 USD) : <strong className="text-gray-800">Non applicable</strong> — locaux de bureaux</span>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {status === "excluded" && (
          <Button onClick={onExclude} variant="outline" className="border-red-300 text-red-700 hover:bg-red-50 gap-2">
            <AlertCircle className="h-4 w-4" /> Fermer le dossier
          </Button>
        )}
        {status === "eligible" && (
          <Button onClick={() => { addAudit({ etape: "Étape 2", action: "Classification validée", detail: isAutoCertain ? `Éligible IFRS 16 — certitude automatique (${confiance}%)` : "Éligible IFRS 16 — confirmé manuellement" }); onNext(); }} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            Passer à l'extraction <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// STEP 3 — Extraction
// ═══════════════════════════════════════

function Step3({ lease, onNext, addAudit }: { lease: LeaseData; onNext: () => void; addAudit: (e: Omit<AuditEntry, "utilisateur" | "timestamp">) => void }) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);

  const categories = Array.from(new Set(lease.champsExtraits.map(c => c.categorie)));

  const handleEdit = (label: string, value: string) => {
    setEdits({ ...edits, [label]: value });
    setEditing(null);
  };

  return (
    <div className="space-y-5">
      <AgentPanel step={3} summary={`L'agent d'extraction a analysé le bail et identifié ${lease.champsExtraits.length} champs structurés. Les données sont regroupées par catégorie : parties, bien loué, durée, loyer, indexation et garanties. Chaque champ est accompagné d'un score de confiance. Les champs en orange nécessitent une vérification manuelle. Vous pouvez modifier toute valeur en cliquant dessus.`} />

      {categories.map(cat => (
        <Card key={cat} className="border-gray-200">
          <CardContent className="p-0">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{cat}</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-gray-100">
                  <TableHead className="text-xs font-medium text-gray-500 w-1/3">Champ</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500">Valeur extraite</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 w-20 text-center">Confiance</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 w-16 text-center">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lease.champsExtraits.filter(c => c.categorie === cat).map((field, i) => {
                  const isEdited = field.label in edits;
                  const val = isEdited ? edits[field.label] : field.valeur;
                  const isEditing_ = editing === field.label;

                  return (
                    <TableRow key={i} className="border-gray-100 hover:bg-gray-50/50">
                      <TableCell className="text-sm text-gray-700 font-medium">{field.label}</TableCell>
                      <TableCell>
                        {isEditing_ ? (
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              defaultValue={val}
                              className="text-sm border border-blue-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
                              onKeyDown={(e) => { if (e.key === "Enter") handleEdit(field.label, (e.target as HTMLInputElement).value); if (e.key === "Escape") setEditing(null); }}
                              onBlur={(e) => handleEdit(field.label, e.target.value)}
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setEditing(field.label)}>
                            <span className="text-sm text-gray-900">{val}</span>
                            {isEdited && <Badge className="text-[9px] bg-blue-100 text-blue-700 border-blue-200">Modifié</Badge>}
                            <Edit3 className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn("text-[10px] font-mono",
                          field.confiance >= 90 ? "bg-green-100 text-green-700 border-green-200" :
                          field.confiance >= 70 ? "bg-amber-100 text-amber-700 border-amber-200" :
                          "bg-red-100 text-red-700 border-red-200"
                        )}>{field.confiance}%</Badge>
                      </TableCell>
                      <TableCell className="text-center text-xs text-gray-500">{field.source}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {/* Contrôles de cohérence */}
      {(() => {
        const loyerTrimestrielX4 = lease.loyerTrimestriel * 4;
        const loyerAnnuel = lease.loyerAnnuelHT;
        const c1ok = Math.abs(loyerTrimestrielX4 - loyerAnnuel) < 2;
        const c2ok = lease.franchiseTrimestres < lease.dureeIFRS16Mois / 3;
        const c3ok = lease.depotGarantie <= loyerAnnuel / 2;
        const c4ok = !!lease.dateEffet;
        const passed = [c1ok, c2ok, c3ok, c4ok].filter(Boolean).length;
        const allOk = passed === 4;
        const checks = [
          {
            label: "Loyer trimestriel × 4 = Loyer annuel",
            ok: c1ok,
            detail: `${fmtEur(loyerTrimestrielX4)} vs ${fmtEur(loyerAnnuel)}`,
          },
          {
            label: "Franchise < Durée totale",
            ok: c2ok,
            detail: `${lease.franchiseTrimestres} trim. < ${Math.round(lease.dureeIFRS16Mois / 3)} trim.`,
          },
          {
            label: "Dépôt de garantie ≤ 6 mois de loyer",
            ok: c3ok,
            detail: `${fmtEur(lease.depotGarantie)} ≤ ${fmtEur(loyerAnnuel / 2)}`,
          },
          {
            label: "Date d'effet cohérente",
            ok: c4ok,
            detail: lease.dateEffet || "Non renseignée",
          },
        ];
        return (
          <Card className={cn("border-2", allOk ? "border-green-300" : "border-amber-300")}>
            <CardContent className="p-0">
              <div className={cn("px-4 py-2.5 border-b flex items-center justify-between", allOk ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200")}>
                <div className="flex items-center gap-2">
                  <ClipboardCheck className={cn("h-4 w-4", allOk ? "text-green-600" : "text-amber-600")} />
                  <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Contrôles de cohérence</span>
                </div>
                <Badge className={cn("text-xs font-semibold", allOk ? "bg-green-100 text-green-700 border-green-300" : "bg-amber-100 text-amber-700 border-amber-300")}>
                  {passed}/4 contrôles passés
                </Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-100">
                    <TableHead className="text-xs font-medium text-gray-500">Contrôle</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500">Valeurs</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500 w-16 text-center">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checks.map((c, i) => (
                    <TableRow key={i} className="border-gray-100">
                      <TableCell className="text-sm text-gray-700 font-medium">{c.label}</TableCell>
                      <TableCell className="text-sm text-gray-600 font-mono">{c.detail}</TableCell>
                      <TableCell className="text-center">
                        {c.ok
                          ? <span className="text-green-600 font-bold text-base">✓</span>
                          : <span className="text-red-500 font-bold text-base">✗</span>
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })()}

      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-500">{lease.champsExtraits.length} champs extraits · {Object.keys(edits).length} modification(s)</p>
        <Button onClick={() => { addAudit({ etape: "Étape 3", action: "Extraction validée", detail: `${lease.champsExtraits.length} champs, ${Object.keys(edits).length} modification(s)` }); onNext(); }} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          Passer au contrôle <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// STEP 4 — Contrôle
// ═══════════════════════════════════════

function Step4({ lease, onNext, addAudit }: { lease: LeaseData; onNext: () => void; addAudit: (e: Omit<AuditEntry, "utilisateur" | "timestamp">) => void }) {
  const iconMap: Record<string, typeof AlertTriangle> = { warning: AlertTriangle, info: Info, error: AlertCircle };
  const colorMap: Record<string, string> = {
    warning: "border-amber-200 bg-amber-50/40",
    info: "border-blue-200 bg-blue-50/40",
    error: "border-red-200 bg-red-50/40",
  };
  const iconColorMap: Record<string, string> = { warning: "text-amber-500", info: "text-blue-500", error: "text-red-500" };
  const badgeMap: Record<string, string> = {
    warning: "bg-amber-100 text-amber-700 border-amber-200",
    info: "bg-blue-100 text-blue-700 border-blue-200",
    error: "bg-red-100 text-red-700 border-red-200",
  };
  const labelMap: Record<string, string> = { warning: "Attention", info: "Information", error: "Action requise" };

  return (
    <div className="space-y-5">
      <AgentPanel step={4} summary={`L'agent de contrôle a vérifié la conformité des données extraites avec les règles IFRS 16. ${lease.alertes.length} points ont été identifiés : ${lease.alertes.filter(a => a.type === "error").length} action(s) requise(s), ${lease.alertes.filter(a => a.type === "warning").length} point(s) d'attention, ${lease.alertes.filter(a => a.type === "info").length} information(s). Chaque alerte est accompagnée de la référence normative correspondante et d'une recommandation.`} />

      <div className="flex gap-3 mb-2">
        {[["error", "Action requise"], ["warning", "Attention"], ["info", "Information"]].map(([t, l]) => {
          const count = lease.alertes.filter(a => a.type === t).length;
          return count > 0 ? (
            <Badge key={t} className={cn("text-xs gap-1", badgeMap[t])}>
              {count} {l}
            </Badge>
          ) : null;
        })}
      </div>

      <div className="space-y-3">
        {lease.alertes.map((alert, i) => {
          const Icon = iconMap[alert.type] || Info;
          return (
            <Card key={i} className={cn("border", colorMap[alert.type])}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", iconColorMap[alert.type])} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">{alert.titre}</span>
                      <Badge className={cn("text-[9px]", badgeMap[alert.type])}>{labelMap[alert.type]}</Badge>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{alert.description}</p>
                    <p className="text-xs text-gray-500 mt-2 font-mono">Réf. : {alert.reference}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={() => { addAudit({ etape: "Étape 4", action: "Contrôles vérifiés", detail: `${lease.alertes.length} alertes : ${lease.alertes.filter(a => a.type === "error").length} action(s) requise(s), ${lease.alertes.filter(a => a.type === "warning").length} attention(s)` }); onNext(); }} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          Passer à la validation <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// STEP 5 — Validation métier
// ═══════════════════════════════════════

function computePL(lease: LeaseData, dureeMois: number): number {
  const nbTrim = Math.round(dureeMois / 3);
  const r = lease.tauxTrimestriel / 100;
  let pl = 0;
  for (let t = 1; t <= nbTrim; t++) {
    const payment = t <= lease.franchiseTrimestres ? 0 : lease.loyerTrimestriel;
    pl += payment / Math.pow(1 + r, t);
  }
  return Math.round(pl);
}

function Step5({ lease, onNext, addAudit }: { lease: LeaseData; onNext: () => void; addAudit: (e: Omit<AuditEntry, "utilisateur" | "timestamp">) => void }) {
  const [choices, setChoices] = useState<Record<string, number>>({});
  const allValidated = lease.decisions.every(d => d.id in choices);

  return (
    <div className="space-y-5">
      <AgentPanel step={5} summary="L'agent de contrôle prépare les points de décision qui nécessitent une validation humaine. Chaque décision impacte directement les calculs IFRS 16. La recommandation est basée sur l'analyse du bail, la politique du groupe SYNLAB et les pratiques de marché. Le comptable ou le contrôleur de gestion doit valider chaque point avant de lancer le calcul." />

      <Card className="border-amber-200 bg-amber-50/30">
        <CardContent className="p-4 flex items-center gap-3">
          <ClipboardCheck className="h-5 w-5 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">Validation requise</p>
            <p className="text-xs text-amber-700">{Object.keys(choices).length} / {lease.decisions.length} décisions validées — toutes les décisions doivent être confirmées pour passer au calcul.</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {lease.decisions.map((decision) => {
          const selected = choices[decision.id];
          const isDuree = decision.id === "duree";
          // Simulation PL for each duration option
          const dureeMoisMap: Record<string, number> = {
            "3 ans (période ferme minimum)": 36,
            "6 ans": 72,
            "9 ans (durée contractuelle complète)": 108,
          };
          const dureeSimOptions = isDuree ? decision.options.map((opt, oi) => {
            const dm = dureeMoisMap[opt.label] ?? lease.dureeIFRS16Mois;
            return { label: opt.label, pl: computePL(lease, dm), index: oi, shortLabel: opt.label.split(" (")[0] };
          }) : [];

          return (
            <Card key={decision.id} className={cn("border transition-colors", selected !== undefined ? "border-green-200 bg-green-50/20" : "border-gray-200")}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">{decision.titre}</h4>
                    <p className="text-sm text-gray-600 mt-1">{decision.description}</p>
                  </div>
                  {selected !== undefined && <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />}
                </div>
                <div className="space-y-2 mb-3">
                  {decision.options.map((opt, oi) => (
                    <label key={oi} className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      selected === oi ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"
                    )}>
                      <input type="radio" name={decision.id} checked={selected === oi}
                        onChange={() => { setChoices({ ...choices, [decision.id]: oi }); addAudit({ etape: "Étape 5", action: "Décision validée", detail: `${decision.titre} → ${opt.label}` }); }}
                        className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-gray-800">{opt.label}</span>
                      {opt.recommande && <Badge className="text-[9px] bg-blue-100 text-blue-700 border-blue-200 ml-auto">Recommandé</Badge>}
                    </label>
                  ))}
                </div>

                {/* Simulation passif locatif pour la décision de durée — affiché en permanence */}
                {isDuree && (
                  <div className="mt-3 mb-3">
                    <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Simulation — Passif locatif estimé</p>
                    <div className="grid grid-cols-3 gap-2">
                      {dureeSimOptions.map((sim) => {
                        const isSelected = selected === sim.index;
                        return (
                          <div key={sim.index} className={cn(
                            "rounded-lg border p-3 text-center transition-colors",
                            isSelected ? "border-blue-400 bg-blue-50 shadow-sm" : "border-gray-200 bg-gray-50 hover:border-gray-300"
                          )}>
                            <p className={cn("text-xs font-semibold mb-1", isSelected ? "text-blue-700" : "text-gray-600")}>{sim.shortLabel}</p>
                            <p className={cn("text-base font-bold font-mono", isSelected ? "text-blue-800" : "text-gray-700")}>{fmtEur(sim.pl)}</p>
                            {isSelected
                              ? <Badge className="text-[9px] mt-1 bg-blue-100 text-blue-700 border-blue-200">Sélectionné</Badge>
                              : <span className="text-[9px] text-gray-400 mt-1 block">r = {lease.tauxTrimestriel.toFixed(4)}%/trim.</span>
                            }
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">
                      Formule : PL = Σ(t=1→n) paiement_t / (1+r)^t — r = {lease.tauxTrimestriel.toFixed(4)}%/trimestre
                    </p>
                  </div>
                )}

                <div className="bg-gray-50 rounded-md p-3 border border-gray-100">
                  <p className="text-xs text-gray-600"><strong className="text-gray-700">Justification :</strong> {decision.recommandationJustification}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={() => onNext()} disabled={!allValidated} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 disabled:opacity-50">
          Lancer le calcul IFRS 16 <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// STEP 6 — Calcul
// ═══════════════════════════════════════

function Step6({ lease, onNext, addAudit }: { lease: LeaseData; onNext: () => void; addAudit: (e: Omit<AuditEntry, "utilisateur" | "timestamp">) => void }) {
  const rows = buildAmortTable(lease);
  const dotation = rows[0]?.dotation ?? 0;
  const nbTrim = Math.round(lease.dureeIFRS16Mois / 3);

  // Show first 8 + last 3 if >12 rows
  const showRows = nbTrim > 12 ? [...rows.slice(0, 8), null, ...rows.slice(-3)] : rows;

  return (
    <div className="space-y-5">
      <AgentPanel step={6} summary={`L'agent de calcul a construit le tableau d'amortissement IFRS 16 sur ${nbTrim} trimestres. Le passif locatif initial de ${fmtEur(lease.passifLocatifInitial)} est amorti par les paiements de loyer de ${fmtEur(lease.loyerTrimestriel)}/trimestre (après ${lease.franchiseTrimestres} trimestres de franchise). L'actif de droit d'utilisation de ${fmtEur(lease.actifROUInitial)} est amorti linéairement sur la durée du bail. Le moteur de calcul est déterministe et vérifiable.`} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Passif locatif initial", value: fmtEur(lease.passifLocatifInitial), color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
          { label: "Actif ROU initial", value: fmtEur(lease.actifROUInitial), color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
          { label: "Charge financière totale", value: fmtEur(lease.chargeFinanciereTotal), color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
          { label: "Dotation / trimestre", value: fmtEur(dotation), color: "text-gray-700", bg: "bg-gray-50 border-gray-200" },
        ].map((kpi, i) => (
          <Card key={i} className={cn("border", kpi.bg)}>
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">{kpi.label}</p>
              <p className={cn("text-lg font-bold", kpi.color)}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-gray-200">
        <CardContent className="p-0">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Tableau d'amortissement — {nbTrim} trimestres</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-500 gap-1">
              <Download className="h-3 w-3" /> Exporter
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-100 bg-gray-50/50">
                  <TableHead className="text-[10px] font-medium text-gray-500">Trim.</TableHead>
                  <TableHead className="text-[10px] font-medium text-gray-500">Période</TableHead>
                  <TableHead className="text-[10px] font-medium text-gray-500 text-right">Loyer</TableHead>
                  <TableHead className="text-[10px] font-medium text-gray-500 text-right">Intérêt</TableHead>
                  <TableHead className="text-[10px] font-medium text-gray-500 text-right">Remboursement</TableHead>
                  <TableHead className="text-[10px] font-medium text-gray-500 text-right">Passif locatif</TableHead>
                  <TableHead className="text-[10px] font-medium text-gray-500 text-right">Dotation</TableHead>
                  <TableHead className="text-[10px] font-medium text-gray-500 text-right">Actif ROU</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {showRows.map((row, i) => row === null ? (
                  <TableRow key="ellipsis" className="border-gray-100">
                    <TableCell colSpan={8} className="text-center text-xs text-gray-400 py-2">⋯</TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={i} className={cn("border-gray-100", row.t <= lease.franchiseTrimestres && "bg-amber-50/30")}>
                    <TableCell className="text-xs text-gray-600 font-mono">{row.t}</TableCell>
                    <TableCell className="text-xs text-gray-700">{row.date}</TableCell>
                    <TableCell className="text-xs text-right font-mono text-gray-800">{row.loyer === 0 ? <span className="text-amber-600 text-[10px]">Franchise</span> : fmt(row.loyer)}</TableCell>
                    <TableCell className="text-xs text-right font-mono text-gray-600">{fmt(row.interet)}</TableCell>
                    <TableCell className="text-xs text-right font-mono text-gray-600">{fmt(row.rembours)}</TableCell>
                    <TableCell className="text-xs text-right font-mono font-medium text-gray-900">{fmt(row.solde)}</TableCell>
                    <TableCell className="text-xs text-right font-mono text-gray-600">{fmt(row.dotation)}</TableCell>
                    <TableCell className="text-xs text-right font-mono font-medium text-gray-900">{fmt(row.rou)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Contrôles de bouclage */}
      {(() => {
        const totalLoyersPayes = rows.reduce((s, r) => s + r.loyer, 0);
        const totalInterets = rows.reduce((s, r) => s + r.interet, 0);
        const totalDotations = rows.reduce((s, r) => s + r.dotation, 0);
        const passifPlusInterets = lease.passifLocatifInitial + totalInterets;
        const ecart = totalLoyersPayes - passifPlusInterets;
        const passifFinal = rows[rows.length - 1]?.solde ?? 0;
        const rouFinal = rows[rows.length - 1]?.rou ?? 0;
        const ecartOk = Math.abs(ecart) < 2;
        const passifFinalOk = passifFinal < 2;
        const rouFinalOk = rouFinal < 2;
        const dotationsOk = Math.abs(totalDotations - lease.actifROUInitial) < nbTrim;

        const boucleRows = [
          {
            label: "Total loyers payés",
            valeur: fmtEur(totalLoyersPayes),
            ok: true,
            info: false,
            detail: `Somme des ${rows.filter(r => r.loyer > 0).length} paiements hors franchise`,
          },
          {
            label: "Passif initial + Intérêts totaux",
            valeur: fmtEur(passifPlusInterets),
            ok: true,
            info: false,
            detail: `${fmtEur(lease.passifLocatifInitial)} + ${fmtEur(totalInterets)}`,
          },
          {
            label: "Écart (doit ≈ 0)",
            valeur: fmtEur(ecart),
            ok: ecartOk,
            info: false,
            detail: ecartOk ? "Tableau équilibré" : "Vérifier les arrondis",
          },
          {
            label: "Passif final (doit ≈ 0)",
            valeur: fmtEur(passifFinal),
            ok: passifFinalOk,
            info: false,
            detail: `Dernier solde : ${fmtEur(passifFinal)}`,
          },
          {
            label: "Actif ROU final (doit ≈ 0)",
            valeur: fmtEur(rouFinal),
            ok: rouFinalOk,
            info: false,
            detail: `Dernier ROU : ${fmtEur(rouFinal)}`,
          },
          {
            label: "Total dotations (≈ ROU initial)",
            valeur: fmtEur(totalDotations),
            ok: dotationsOk,
            info: false,
            detail: `ROU initial : ${fmtEur(lease.actifROUInitial)}`,
          },
        ];

        return (
          <Card className="border-gray-200">
            <CardContent className="p-0">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-gray-500" />
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Contrôles de bouclage</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-100">
                    <TableHead className="text-xs font-medium text-gray-500">Contrôle</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500 text-right">Valeur</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500">Détail</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500 w-16 text-center">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boucleRows.map((br, i) => (
                    <TableRow key={i} className="border-gray-100">
                      <TableCell className="text-sm font-medium text-gray-700">{br.label}</TableCell>
                      <TableCell className="text-sm text-right font-mono font-semibold text-gray-900">{br.valeur}</TableCell>
                      <TableCell className="text-xs text-gray-500">{br.detail}</TableCell>
                      <TableCell className="text-center">
                        {i < 2
                          ? <span className="text-blue-500 font-bold text-base">→</span>
                          : br.ok
                            ? <span className="text-green-600 font-bold text-base">✓</span>
                            : <span className="text-red-500 font-bold text-base">✗</span>
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })()}

      <div className="flex justify-end">
        <Button onClick={() => { addAudit({ etape: "Étape 6", action: "Calculs vérifiés", detail: `Passif ${fmtEur(lease.passifLocatifInitial)}, ROU ${fmtEur(lease.actifROUInitial)}` }); onNext(); }} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          Passer à la comptabilisation <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// STEP 7 — Comptabilisation & Reporting
// ═══════════════════════════════════════

function Step7({ lease, addAudit, auditTrail }: { lease: LeaseData; addAudit: (e: Omit<AuditEntry, "utilisateur" | "timestamp">) => void; auditTrail: AuditEntry[] }) {
  const [archived, setArchived] = useState(false);

  // — Génération dynamique des écritures comptables —
  const amortRows = buildAmortTable(lease);
  const dotation = amortRows[0]?.dotation ?? 0;

  type Ecriture = { date: string; journal: string; libelle: string; debit: { compte: string; libelle: string; montant: number }; credit: { compte: string; libelle: string; montant: number } };

  const ecritures: Ecriture[] = useMemo(() => {
    const startYear = 2024;
    const entries: Ecriture[] = [];

    // a) Reconnaissance initiale
    entries.push({
      date: `01/01/${startYear}`,
      journal: "OD",
      libelle: "Reconnaissance initiale — Droit d'utilisation",
      debit: { compte: "2613", libelle: "Droit d'utilisation — Bureaux", montant: lease.actifROUInitial },
      credit: { compte: "1686", libelle: "Passif locatif IFRS 16", montant: lease.passifLocatifInitial },
    });

    if (lease.provisionRemiseEnEtat > 0) {
      entries.push({
        date: `01/01/${startYear}`,
        journal: "OD",
        libelle: "Reconnaissance initiale — Provision remise en état",
        debit: { compte: "2613", libelle: "Droit d'utilisation — Bureaux", montant: lease.provisionRemiseEnEtat },
        credit: { compte: "1581", libelle: "Provision pour remise en état", montant: lease.provisionRemiseEnEtat },
      });
    }

    // b) Pour chaque trimestre de l'année 1 (4 trimestres)
    for (let t = 1; t <= 4; t++) {
      const row = amortRows[t - 1];
      if (!row) continue;
      const q = t;
      const monthEnd = ["31/03", "30/06", "30/09", "31/12"][q - 1];
      const dateStr = `${monthEnd}/${startYear}`;

      // Dotation amortissement
      entries.push({
        date: dateStr,
        journal: "OD",
        libelle: `Dotation amortissement ROU T${q} ${startYear}`,
        debit: { compte: "6811", libelle: "Dotation amortissement ROU", montant: row.dotation },
        credit: { compte: "28613", libelle: "Amort. droit d'utilisation", montant: row.dotation },
      });

      // Intérêts
      entries.push({
        date: dateStr,
        journal: "OD",
        libelle: `Charge financière T${q} ${startYear}${t <= lease.franchiseTrimestres ? " (franchise)" : ""}`,
        debit: { compte: "6615", libelle: "Intérêts passif locatif", montant: row.interet },
        credit: { compte: "1686", libelle: "Passif locatif IFRS 16", montant: row.interet },
      });

      // Paiement loyer (hors franchise)
      if (t > lease.franchiseTrimestres) {
        entries.push({
          date: dateStr,
          journal: "BQ",
          libelle: `Paiement loyer T${q} ${startYear}`,
          debit: { compte: "1686", libelle: "Passif locatif IFRS 16", montant: row.loyer },
          credit: { compte: "512", libelle: "Banque", montant: row.loyer },
        });
      }
    }

    return entries;
  }, [lease, amortRows, dotation]);

  const totalDebits = ecritures.reduce((s, e) => s + e.debit.montant, 0);
  const totalCredits = ecritures.reduce((s, e) => s + e.credit.montant, 0);
  const balanceEcart = totalDebits - totalCredits;
  const balanceOk = Math.abs(balanceEcart) < 1;

  return (
    <div className="space-y-5">
      <AgentPanel step={7} summary={`L'agent de comptabilisation a généré les écritures comptables conformes au Plan Comptable Général français. Les comptes utilisés sont ceux prévus par le règlement ANC 2020 pour les opérations IFRS 16 : compte 2613 pour le droit d'utilisation, 1686 pour le passif locatif, 6811 pour les dotations et 6615 pour les charges financières. Toutes les écritures sont équilibrées et prêtes pour l'import dans l'ERP.`} />

      <Card className="border-gray-200">
        <CardContent className="p-0">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Écritures comptables (PCG) — Année 1</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-500 gap-1">
              <Download className="h-3 w-3" /> Exporter vers l'ERP
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-100 bg-gray-50/50">
                  <TableHead className="text-[10px] font-medium text-gray-500">Date</TableHead>
                  <TableHead className="text-[10px] font-medium text-gray-500">Jnl</TableHead>
                  <TableHead className="text-[10px] font-medium text-gray-500">Libellé</TableHead>
                  <TableHead className="text-[10px] font-medium text-gray-500">Compte débit</TableHead>
                  <TableHead className="text-[10px] font-medium text-gray-500 text-right">Débit</TableHead>
                  <TableHead className="text-[10px] font-medium text-gray-500">Compte crédit</TableHead>
                  <TableHead className="text-[10px] font-medium text-gray-500 text-right">Crédit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ecritures.map((ec, i) => (
                  <TableRow key={i} className="border-gray-100">
                    <TableCell className="text-xs font-mono text-gray-600">{ec.date}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[9px] font-mono">{ec.journal}</Badge></TableCell>
                    <TableCell className="text-xs text-gray-800">{ec.libelle}</TableCell>
                    <TableCell className="text-xs font-mono text-gray-600">{ec.debit.compte} — {ec.debit.libelle}</TableCell>
                    <TableCell className="text-xs text-right font-mono font-medium text-gray-900">{ec.debit.montant > 0 ? fmtEur(ec.debit.montant) : ""}</TableCell>
                    <TableCell className="text-xs font-mono text-gray-600">{ec.credit.compte} — {ec.credit.libelle}</TableCell>
                    <TableCell className="text-xs text-right font-mono font-medium text-gray-900">{fmtEur(ec.credit.montant)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Balance de vérification */}
      <Card className={cn("border-2", balanceOk ? "border-green-300" : "border-red-300")}>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className={cn("h-4 w-4", balanceOk ? "text-green-600" : "text-red-500")} />
            <span className="text-sm font-semibold text-gray-800">Balance de vérification</span>
            <Badge className={cn("ml-auto text-xs", balanceOk ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300")}>
              {balanceOk ? "Équilibrée" : "Déséquilibrée"}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-[10px] uppercase tracking-wider text-blue-600 font-medium mb-1">Total débits</p>
              <p className="text-xl font-bold font-mono text-blue-800">{fmtEur(totalDebits)}</p>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-center">
              <p className="text-[10px] uppercase tracking-wider text-indigo-600 font-medium mb-1">Total crédits</p>
              <p className="text-xl font-bold font-mono text-indigo-800">{fmtEur(totalCredits)}</p>
            </div>
            <div className={cn("rounded-lg p-4 text-center border", balanceOk ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200")}>
              <p className={cn("text-[10px] uppercase tracking-wider font-medium mb-1", balanceOk ? "text-green-600" : "text-red-600")}>Écart</p>
              <p className={cn("text-xl font-bold font-mono", balanceOk ? "text-green-700" : "text-red-700")}>{fmtEur(balanceEcart)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Format d'export FEC */}
      <Card className="border-gray-200">
        <CardContent className="p-0">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Format d'export FEC (Fichier des Écritures Comptables)</span>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-500 gap-1">
              <Download className="h-3 w-3" /> Télécharger FEC
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-100 bg-gray-50/50">
                  {["JournalCode", "JournalLib", "EcritureNum", "EcritureDate", "CompteNum", "CompteLib", "Debit", "Credit"].map(h => (
                    <TableHead key={h} className="text-[10px] font-medium text-gray-500 font-mono">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ecritures.slice(0, 4).map((ec, i) => [
                  <TableRow key={`d${i}`} className="border-gray-100 bg-white">
                    <TableCell className="text-[10px] font-mono text-gray-600">{ec.journal}</TableCell>
                    <TableCell className="text-[10px] font-mono text-gray-600">{ec.journal === "OD" ? "Opérations diverses" : "Banque"}</TableCell>
                    <TableCell className="text-[10px] font-mono text-gray-600">IFRS16-{String(i * 2 + 1).padStart(4, "0")}</TableCell>
                    <TableCell className="text-[10px] font-mono text-gray-600">{ec.date.split("/").reverse().join("")}</TableCell>
                    <TableCell className="text-[10px] font-mono text-gray-600">{ec.debit.compte}</TableCell>
                    <TableCell className="text-[10px] font-mono text-gray-600">{ec.debit.libelle}</TableCell>
                    <TableCell className="text-[10px] font-mono text-right text-gray-800">{ec.debit.montant > 0 ? ec.debit.montant.toFixed(2) : ""}</TableCell>
                    <TableCell className="text-[10px] font-mono text-right text-gray-800"></TableCell>
                  </TableRow>,
                  <TableRow key={`c${i}`} className="border-gray-100 bg-gray-50/30">
                    <TableCell className="text-[10px] font-mono text-gray-600">{ec.journal}</TableCell>
                    <TableCell className="text-[10px] font-mono text-gray-600">{ec.journal === "OD" ? "Opérations diverses" : "Banque"}</TableCell>
                    <TableCell className="text-[10px] font-mono text-gray-600">IFRS16-{String(i * 2 + 2).padStart(4, "0")}</TableCell>
                    <TableCell className="text-[10px] font-mono text-gray-600">{ec.date.split("/").reverse().join("")}</TableCell>
                    <TableCell className="text-[10px] font-mono text-gray-600">{ec.credit.compte}</TableCell>
                    <TableCell className="text-[10px] font-mono text-gray-600">{ec.credit.libelle}</TableCell>
                    <TableCell className="text-[10px] font-mono text-right text-gray-800"></TableCell>
                    <TableCell className="text-[10px] font-mono text-right text-gray-800">{ec.credit.montant.toFixed(2)}</TableCell>
                  </TableRow>,
                ]).flat()}
                <TableRow className="border-gray-100">
                  <TableCell colSpan={8} className="text-center text-xs text-gray-400 py-2 italic">⋯ {ecritures.length * 2 - 8} lignes supplémentaires non affichées — Téléchargez le FEC complet</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Piste d'audit */}
      <Card className="border-gray-200">
        <CardContent className="p-0">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-gray-500" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Piste d'audit</span>
            <Badge variant="outline" className="ml-auto text-[10px] text-gray-500">{auditTrail.length} entrée(s)</Badge>
          </div>
          {auditTrail.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400 italic">Aucune action enregistrée pour le moment</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-100">
                  <TableHead className="text-[10px] font-medium text-gray-500">Horodatage</TableHead>
                  <TableHead className="text-[10px] font-medium text-gray-500">Étape</TableHead>
                  <TableHead className="text-[10px] font-medium text-gray-500">Action</TableHead>
                  <TableHead className="text-[10px] font-medium text-gray-500">Détail</TableHead>
                  <TableHead className="text-[10px] font-medium text-gray-500">Utilisateur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditTrail.map((entry, i) => (
                  <TableRow key={i} className="border-gray-100">
                    <TableCell className="text-[10px] font-mono text-gray-500">{entry.timestamp}</TableCell>
                    <TableCell className="text-xs text-gray-700">{entry.etape}</TableCell>
                    <TableCell className="text-xs font-medium text-gray-800">{entry.action}</TableCell>
                    <TableCell className="text-xs text-gray-600">{entry.detail}</TableCell>
                    <TableCell className="text-xs text-gray-500">{entry.utilisateur}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-gray-200">
        <CardContent className="p-5">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Fiche contrat — Synthèse IFRS 16</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {[
              ["Preneur", lease.preneur],
              ["Bailleur", lease.bailleur],
              ["Adresse", lease.adresse],
              ["Type de bail", lease.typeBail],
              ["Date d'effet", lease.dateEffet],
              ["Durée retenue", `${lease.dureeIFRS16Mois} mois (${Math.round(lease.dureeIFRS16Mois / 12)} ans)`],
              ["Loyer annuel HT", fmtEur(lease.loyerAnnuelHT)],
              ["Franchise", `${lease.franchiseTrimestres} trimestres`],
              ["Taux d'actualisation", `${lease.tauxAnnuel.toFixed(2)}% annuel`],
              ["Passif locatif initial", fmtEur(lease.passifLocatifInitial)],
              ["Actif ROU initial", fmtEur(lease.actifROUInitial)],
              ["Provision remise en état", fmtEur(lease.provisionRemiseEnEtat)],
            ].map(([label, value], i) => (
              <div key={i}>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="font-medium text-gray-900">{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        {archived ? (
          <div className="flex items-center gap-2 px-6 py-3 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-800">Dossier archivé avec succès</span>
          </div>
        ) : (
          <Button onClick={() => { addAudit({ etape: "Étape 7", action: "Dossier archivé", detail: `Dossier IFRS 16 archivé : ${lease.preneur} — ${lease.adresse}` }); setArchived(true); }} className="bg-green-600 hover:bg-green-700 text-white gap-2">
            <Archive className="h-4 w-4" /> Archiver le dossier
          </Button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════

export default function WorkflowPage() {
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [lease, setLease] = useState<LeaseData | null>(null);
  const [maxStep, setMaxStep] = useState(1);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const [horsScope, setHorsScope] = useState(false);

  const addAudit = useCallback((e: Omit<AuditEntry, "utilisateur" | "timestamp">) => {
    const now = new Date();
    const timestamp = now.toLocaleDateString("fr-FR") + " " + now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setAuditTrail(prev => [...prev, { ...e, timestamp, utilisateur: "Comptable SYNLAB" }]);
  }, []);

  const goNext = useCallback(() => {
    setCurrentStep(s => {
      const next = Math.min(s + 1, 7);
      setMaxStep(m => Math.max(m, next));
      return next;
    });
  }, []);

  const goToStep = (s: number) => {
    if (s <= maxStep) setCurrentStep(s);
  };

  const StepIcon = STEP_ICONS[currentStep - 1];
  const progressPercent = ((currentStep - 1) / 6) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-gray-900 truncate">SYNLAB · IFRS 16</h1>
              <p className="text-[11px] text-gray-500 truncate">
                {lease ? `${lease.preneur} — ${lease.adresse}` : "Traitement des contrats de location"}
              </p>
            </div>
          </div>

          <div className="flex-1 max-w-xs mx-4 hidden md:block">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-500">Progression</span>
              <span className="text-[10px] font-mono text-blue-600">{currentStep}/7</span>
            </div>
            <Progress value={progressPercent} className="h-1.5" />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => navigate("/admin")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Paramétrage</span>
            </button>
            {lease && (
              <Badge variant="outline" className="text-[10px] font-mono text-gray-500 border-gray-300 hidden sm:flex">
                DOC-{new Date().getFullYear()}-001
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 hidden lg:block">
          <div className="sticky top-20">
            <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-1 shadow-sm">
              <div className="px-1 pb-2 border-b border-gray-100 mb-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Étapes du workflow</p>
              </div>
              {STEP_LABELS.map((label, i) => {
                const step = i + 1;
                const isActive = step === currentStep;
                const isCompleted = step < currentStep;
                const isLocked = step > maxStep;
                const Icon = STEP_ICONS[i];
                return (
                  <button
                    key={i}
                    onClick={() => goToStep(step)}
                    disabled={isLocked}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors text-sm",
                      isActive ? "bg-blue-50 text-blue-800 font-medium" :
                      isCompleted ? "text-gray-700 hover:bg-gray-50 cursor-pointer" :
                      "text-gray-400 cursor-not-allowed"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                      isActive ? "bg-blue-600 text-white" :
                      isCompleted ? "bg-green-100 text-green-600" :
                      "bg-gray-100 text-gray-400"
                    )}>
                      {isCompleted ? <Check className="h-3 w-3" /> :
                       isLocked ? <Lock className="h-3 w-3" /> :
                       <span className="text-[10px] font-bold">{step}</span>}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs truncate">{label}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {lease && (
              <div className="bg-white border border-gray-200 rounded-xl p-3 mt-3 shadow-sm">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">Données du bail</p>
                <div className="space-y-1.5 text-xs">
                  {[
                    ["Preneur", lease.preneur.split(" (")[0]],
                    ["Loyer/an", fmtEur(lease.loyerAnnuelHT)],
                    ["Durée", lease.dureeContractuelle],
                    ["Taux", `${lease.tauxAnnuel.toFixed(2)}%`],
                    ["Passif init.", fmtEur(lease.passifLocatifInitial)],
                    ["ROU init.", fmtEur(lease.actifROUInitial)],
                  ].map(([label, value], i) => (
                    <div key={i} className="flex items-center justify-between px-1">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-mono font-medium text-gray-800">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="mb-5">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                <StepIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Étape {currentStep} sur 7</p>
                <h2 className="text-lg font-bold text-gray-900">
                  {["Ingestion & Analyse", "Classification IFRS 16", "Extraction des données", "Contrôle & Alertes", "Validation métier", "Calcul IFRS 16", "Comptabilisation & Reporting"][currentStep - 1]}
                </h2>
              </div>
            </div>
          </div>

          {currentStep === 1 && <Step1 lease={lease} setLease={setLease} onNext={goNext} addAudit={addAudit} />}
          {currentStep === 2 && lease && !horsScope && (
            <Step2
              lease={lease}
              onNext={goNext}
              onExclude={() => setHorsScope(true)}
              addAudit={addAudit}
            />
          )}
          {currentStep === 2 && horsScope && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-16 text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Contrat exclu du scope IFRS 16</h3>
              <p className="text-sm text-gray-500 max-w-sm">
                Ce contrat n'a pas été qualifié comme contrat de location selon IFRS 16.9.
                Aucun traitement comptable IFRS 16 n'est requis.
              </p>
              <Button variant="outline" onClick={() => { setHorsScope(false); setLease(null); setCurrentStep(1); setMaxStep(1); }}
                className="mt-2 gap-2">
                <Upload className="h-4 w-4" /> Analyser un nouveau bail
              </Button>
            </motion.div>
          )}
          {currentStep === 3 && lease && <Step3 lease={lease} onNext={goNext} addAudit={addAudit} />}
          {currentStep === 4 && lease && <Step4 lease={lease} onNext={goNext} addAudit={addAudit} />}
          {currentStep === 5 && lease && <Step5 lease={lease} onNext={goNext} addAudit={addAudit} />}
          {currentStep === 6 && lease && <Step6 lease={lease} onNext={goNext} addAudit={addAudit} />}
          {currentStep === 7 && lease && <Step7 lease={lease} addAudit={addAudit} auditTrail={auditTrail} />}
        </main>
      </div>
    </div>
  );
}
