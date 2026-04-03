import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// ============================
// TYPES
// ============================

export type RuleCategory = "identification" | "exemptions" | "evaluation" | "comptabilisation" | "reporting";
export type RuleType = "obligatoire" | "parametrable" | "recommande";
export type AgentModel = "gpt-4o" | "claude-3.5-sonnet" | "mistral-large" | "gemini-1.5-pro";
export type WorkflowStatus = "actif" | "brouillon" | "inactif";
export type KBType = "norme" | "guide" | "position" | "interne" | "reglementation";
export type KBStatus = "en_vigueur" | "abroge" | "projet";

export interface Rule {
  id: string;
  code: string;
  title: string;
  category: RuleCategory;
  type: RuleType;
  description: string;
  reference: string;
  enabled: boolean;
  // P2: Instructions de traitement enrichies
  instructionsTraitement: string;
  formulesCalcul: string;
  criteresValidation: string;
  formatEntree: string;
  formatSortie: string;
}

export interface KBEntry {
  id: string;
  title: string;
  type: KBType;
  status: KBStatus;
  source: string;
  description: string;
  contenu: string;
  dateEffet: string;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  model: AgentModel;
  enabled: boolean;
  color: string;
  icon: string;
}

// P1: Règles et KB rattachées au niveau agent-dans-étape
export interface WorkflowStepAgentConfig {
  agentId: string;
  assignedRuleIds: string[];
  assignedKBIds: string[];
}

export interface WorkflowStep {
  id: string;
  order: number;
  label: string;
  agentConfig: WorkflowStepAgentConfig;
}

export interface Workflow {
  id: string;
  name: string;
  category: string;
  description: string;
  status: WorkflowStatus;
  steps: WorkflowStep[];
}

// ============================
// INITIAL DATA — 10 AGENTS (6 existing + 4 new P3)
// ============================

const initialAgents: Agent[] = [
  {
    id: "agent-ingestion",
    name: "Agent d'Ingestion",
    role: "Réception et analyse documentaire des baux",
    description: "Reçoit les documents PDF, exécute l'OCR, identifie le type de document et prépare les données brutes pour l'extraction.",
    model: "gpt-4o",
    enabled: true,
    color: "#2563eb",
    icon: "FileUp",
  },
  {
    id: "agent-classification",
    name: "Agent de Classification",
    role: "Classification IFRS 16 et éligibilité",
    description: "Détermine si le contrat entre dans le scope IFRS 16 (contient-il un droit d'utilisation d'un actif identifié?) et classifie le type de bail.",
    model: "gpt-4o",
    enabled: true,
    color: "#7c3aed",
    icon: "Tags",
  },
  {
    id: "agent-extraction",
    name: "Agent d'Extraction",
    role: "Extraction structurée des données du bail",
    description: "Extrait les paramètres clés du bail : durée, loyer, franchise, indexation, options, composantes, provisions. Attribue un score de confiance à chaque champ.",
    model: "claude-3.5-sonnet",
    enabled: true,
    color: "#059669",
    icon: "FileSearch",
  },
  {
    id: "agent-controle",
    name: "Agent de Contrôle",
    role: "Vérification des règles IFRS 16 et alertes",
    description: "Applique les règles de contrôle IFRS 16 aux données extraites, génère des alertes (warnings, infos, erreurs) et identifie les points de jugement nécessitant une validation humaine.",
    model: "gpt-4o",
    enabled: true,
    color: "#dc2626",
    icon: "ShieldCheck",
  },
  {
    id: "agent-calcul",
    name: "Agent de Calcul",
    role: "Moteur de calcul IFRS 16 déterministe",
    description: "Calcule le passif locatif, l'actif ROU, le tableau d'amortissement, les charges financières et les dotations aux amortissements selon les paramètres validés.",
    model: "mistral-large",
    enabled: true,
    color: "#ea580c",
    icon: "Calculator",
  },
  {
    id: "agent-comptabilisation",
    name: "Agent de Comptabilisation",
    role: "Génération des écritures comptables PCG",
    description: "Génère les écritures comptables conformes au PCG français (journal OD, journal des à-nouveaux) avec les comptes IFRS 16 appropriés.",
    model: "gpt-4o",
    enabled: true,
    color: "#0891b2",
    icon: "BookOpen",
  },
  // P3: 4 agents spécialisés manquants
  {
    id: "agent-indexation",
    name: "Agent d'Indexation",
    role: "Réévaluation périodique des loyers indexés",
    description: "Calcule l'impact des clauses d'indexation (ICC, ILC, ILAT) sur les loyers, réévalue le passif locatif et l'actif ROU selon IFRS 16.42. Gère les révisions triennales légales et les plafonnements.",
    model: "gpt-4o",
    enabled: true,
    color: "#4f46e5",
    icon: "TrendingUp",
  },
  {
    id: "agent-modification",
    name: "Agent de Modification",
    role: "Traitement des avenants et modifications de contrat",
    description: "Analyse les modifications de bail (changement de surface, prolongation, changement de loyer) et détermine s'il s'agit d'un bail séparé (IFRS 16.44) ou d'une remesure du bail existant (IFRS 16.45). Recalcule le passif et l'actif en conséquence.",
    model: "claude-3.5-sonnet",
    enabled: true,
    color: "#c026d3",
    icon: "FilePen",
  },
  {
    id: "agent-depreciation",
    name: "Agent de Dépréciation",
    role: "Test de dépréciation IAS 36 du droit d'utilisation",
    description: "Évalue si l'actif ROU présente des indices de perte de valeur (IAS 36), calcule la valeur recouvrable (plus élevée de la juste valeur et de la valeur d'utilité), et comptabilise la dépréciation le cas échéant.",
    model: "gpt-4o",
    enabled: true,
    color: "#b91c1c",
    icon: "AlertTriangle",
  },
  {
    id: "agent-reporting",
    name: "Agent de Reporting",
    role: "Disclosures IFRS 16 et reporting périodique",
    description: "Compile les informations à fournir en annexe (IFRS 16.47-60) : analyse de maturité des passifs, réconciliation des engagements, ventilation des charges, et rapprochement avec les engagements hors bilan antérieurs.",
    model: "gpt-4o",
    enabled: true,
    color: "#0d9488",
    icon: "BarChart3",
  },
];

// ============================
// P2: 23 RÈGLES IFRS 16 ENRICHIES avec instructions de traitement
// ============================

const initialRules: Rule[] = [
  // IDENTIFICATION (5 rules)
  {
    id: "rule-1",
    code: "IFRS 16.9",
    title: "Identification d'un contrat de location",
    category: "identification",
    type: "obligatoire",
    description: "Un contrat est ou contient un contrat de location s'il confère le droit de contrôler l'utilisation d'un actif identifié pour un certain temps moyennant une contrepartie.",
    reference: "IFRS 16.9, IFRS 16.B9-B31",
    enabled: true,
    instructionsTraitement: "1. Vérifier qu'il existe un actif identifié (explicitement ou implicitement désigné dans le contrat)\n2. Vérifier que le preneur a le droit d'obtenir la quasi-totalité des avantages économiques de l'actif\n3. Vérifier que le preneur a le droit de diriger l'utilisation de l'actif\n4. Si les 3 conditions sont remplies → le contrat contient un contrat de location\n5. Si une condition manque → pas de contrat de location au sens IFRS 16",
    formulesCalcul: "Test binaire : Actif identifié ∧ Quasi-totalité des avantages ∧ Droit de diriger = Location IFRS 16",
    criteresValidation: "Le résultat doit être OUI ou NON avec justification pour chacun des 3 critères",
    formatEntree: "Texte intégral du contrat, clauses de mise à disposition, objet du contrat",
    formatSortie: "{ isLocation: boolean, actifIdentifie: boolean, avantagesEconomiques: boolean, droitDirectionUtilisation: boolean, justification: string }",
  },
  {
    id: "rule-2",
    code: "IFRS 16.B13-B20",
    title: "Actif identifié — droit de substitution",
    category: "identification",
    type: "obligatoire",
    description: "Un actif n'est pas identifié si le fournisseur a le droit substantiel de substituer l'actif pendant la durée d'utilisation.",
    reference: "IFRS 16.B13-B20",
    enabled: true,
    instructionsTraitement: "1. Rechercher dans le contrat une clause de substitution\n2. Si clause présente : évaluer si le fournisseur peut effectivement substituer l'actif (capacité pratique + avantage économique)\n3. Si le fournisseur a un droit substantiel de substitution → pas d'actif identifié\n4. Si substitution limitée (maintenance, remplacement identique) → l'actif reste identifié",
    formulesCalcul: "N/A — analyse qualitative",
    criteresValidation: "Vérifier que la clause de substitution a été analysée et que la conclusion est cohérente avec la pratique de marché",
    formatEntree: "Clauses de substitution du contrat, conditions générales",
    formatSortie: "{ droitSubstitutionSubstantiel: boolean, justification: string }",
  },
  {
    id: "rule-3",
    code: "IFRS 16.B21-B30",
    title: "Composante locative vs non-locative",
    category: "identification",
    type: "parametrable",
    description: "Le preneur doit séparer les composantes locatives et non-locatives (services) d'un contrat, sauf s'il choisit l'exemption pratique de non-séparation.",
    reference: "IFRS 16.12-16, IFRS 16.B21-B30",
    enabled: true,
    instructionsTraitement: "1. Identifier toutes les composantes du contrat (loyer pur, charges récupérables, services, maintenance)\n2. Pour chaque composante : déterminer si elle transfère un droit d'utilisation (→ locative) ou un service (→ non-locative)\n3. Vérifier si le client a activé l'exemption IFRS 16.15 (non-séparation des composantes)\n4. Si séparation requise : allouer la contrepartie sur la base des prix individuels observables\n5. Si exemption activée : traiter l'ensemble comme un seul contrat de location",
    formulesCalcul: "Allocation = Prix_individuel_composante / Σ Prix_individuels_toutes_composantes × Contrepartie_totale",
    criteresValidation: "Somme des allocations = contrepartie totale du contrat (à 0,01€ près)",
    formatEntree: "Détail des composantes du contrat, prix unitaires, option de non-séparation",
    formatSortie: "{ composantes: [{ type: 'locative'|'non_locative', montant: number, description: string }], exemptionActivee: boolean }",
  },
  {
    id: "rule-4",
    code: "IFRS 16.22",
    title: "Durée du contrat de location",
    category: "identification",
    type: "parametrable",
    description: "La durée comprend la période non résiliable plus les périodes couvertes par une option de prolongation (si exercice raisonnablement certain) ou de résiliation (si non-exercice raisonnablement certain).",
    reference: "IFRS 16.18-21, IFRS 16.B37-B40",
    enabled: true,
    instructionsTraitement: "1. Identifier la période non résiliable du bail\n2. Recenser toutes les options de prolongation et de résiliation anticipée\n3. Pour chaque option : évaluer si l'exercice (prolongation) ou le non-exercice (résiliation) est raisonnablement certain\n4. Facteurs à considérer (IFRS 16.B37) : améliorations locatives significatives, coûts de résiliation, importance de l'actif pour l'activité, historique, conditions de marché\n5. Durée du bail = Période non résiliable + Périodes d'option raisonnablement certaines\n6. Pour un bail 3/6/9 français : analyser la probabilité réelle de rester au-delà de chaque échéance triennale",
    formulesCalcul: "Durée = Période_non_résiliable + Σ Périodes_option_prolongation_RC - Σ Périodes_option_résiliation_RC",
    criteresValidation: "La durée retenue doit être justifiée par au moins 2 facteurs B37. Alerte si durée retenue = durée contractuelle maximale sans justification.",
    formatEntree: "Dates de début/fin du bail, options de renouvellement/résiliation, contexte opérationnel du preneur",
    formatSortie: "{ dureeRetenueMois: number, periodeNonResiliable: number, optionsIncluses: string[], justificationB37: string[] }",
  },
  {
    id: "rule-5",
    code: "IFRS 16.26",
    title: "Taux d'actualisation",
    category: "identification",
    type: "parametrable",
    description: "Le passif locatif est évalué à la valeur actualisée des paiements de loyers restants, actualisés au taux implicite du bail ou, s'il n'est pas facilement déterminable, au taux d'emprunt marginal du preneur.",
    reference: "IFRS 16.26, IFRS 16.BC161-BC169",
    enabled: true,
    instructionsTraitement: "1. Tenter de déterminer le taux implicite du bail (taux qui égalise la VA des paiements + valeur résiduelle non garantie = juste valeur de l'actif + coûts directs initiaux)\n2. Si taux implicite non facilement déterminable (cas courant) → utiliser le taux d'emprunt marginal\n3. Taux d'emprunt marginal = taux sans risque + spread de crédit du preneur, ajusté pour la durée et le montant du bail\n4. Pour les groupes français : utiliser le TME ou l'OAT de maturité équivalente + spread approprié\n5. Documenter la source du taux et la méthodologie",
    formulesCalcul: "TEM = taux_sans_risque(maturité_bail) + spread_crédit_preneur\nTaux trimestriel = (1 + TEM)^(1/4) - 1",
    criteresValidation: "Le taux retenu doit être dans une fourchette raisonnable [taux_sans_risque ; taux_sans_risque + 400bp]. Documenter la source (Bloomberg, BCE, BdF).",
    formatEntree: "Date de début du bail, durée retenue, notation de crédit du preneur, taux de marché à la date de commencement",
    formatSortie: "{ tauxRetenu: number, methode: 'implicite'|'marginal', tauxSansRisque: number, spread: number, sourceReference: string }",
  },
  // EXEMPTIONS (3 rules)
  {
    id: "rule-6",
    code: "IFRS 16.5(a)",
    title: "Exemption — Bail de courte durée",
    category: "exemptions",
    type: "parametrable",
    description: "Un preneur peut choisir de ne pas appliquer IFRS 16 aux baux dont la durée est ≤ 12 mois (sans option d'achat).",
    reference: "IFRS 16.5(a), IFRS 16.8",
    enabled: true,
    instructionsTraitement: "1. Vérifier si la durée du bail (incluant les options raisonnablement certaines) est ≤ 12 mois\n2. Vérifier qu'il n'existe pas d'option d'achat\n3. Si les deux conditions sont remplies ET que le groupe a choisi cette exemption par classe d'actif → comptabiliser en charge linéaire\n4. Note : l'exemption est un choix comptable par classe d'actifs sous-jacents, pas contrat par contrat",
    formulesCalcul: "Charge linéaire = Paiements_totaux / Durée_en_mois",
    criteresValidation: "Vérifier que le choix d'exemption est cohérent avec la politique du groupe et appliqué par classe d'actifs",
    formatEntree: "Durée du bail, existence d'option d'achat, politique du groupe",
    formatSortie: "{ exemptionApplicable: boolean, exemptionActivee: boolean, chargeLineaireMensuelle: number }",
  },
  {
    id: "rule-7",
    code: "IFRS 16.5(b)",
    title: "Exemption — Actif de faible valeur",
    category: "exemptions",
    type: "parametrable",
    description: "Un preneur peut choisir de ne pas appliquer IFRS 16 aux baux portant sur des actifs dont la valeur à neuf est ≤ 5 000 USD.",
    reference: "IFRS 16.5(b), IFRS 16.B3-B8",
    enabled: true,
    instructionsTraitement: "1. Évaluer la valeur à neuf de l'actif sous-jacent (pas la valeur du bail)\n2. Le seuil de 5 000 USD s'applique à chaque actif individuel, pas en agrégat\n3. Exemples typiques : téléphones, tablettes, petit mobilier, petites imprimantes\n4. Non applicable : voitures (même petites), mobilier de grande valeur\n5. Si applicable → comptabiliser en charge linéaire",
    formulesCalcul: "Valeur_neuf_actif ≤ 5 000 USD → exemption applicable",
    criteresValidation: "La valeur à neuf doit être documentée et la conversion USD/EUR justifiée au taux de la date de commencement",
    formatEntree: "Description de l'actif, valeur à neuf estimée, taux de change",
    formatSortie: "{ valeurNeuf: number, seuilDepasse: boolean, exemptionApplicable: boolean }",
  },
  {
    id: "rule-8",
    code: "IFRS 16.3",
    title: "Exclusions du scope IFRS 16",
    category: "exemptions",
    type: "obligatoire",
    description: "IFRS 16 ne s'applique pas aux locations d'actifs biologiques, accords de concession, licences de propriété intellectuelle, droits détenus dans le cadre d'accords de licence.",
    reference: "IFRS 16.3",
    enabled: true,
    instructionsTraitement: "1. Vérifier si l'actif sous-jacent fait partie des exclusions de scope\n2. Exclusions : actifs biologiques (IAS 41), concessions de services (IFRIC 12), licences PI (IFRS 15), droits sur minerais/pétrole/gaz (IFRS 6)\n3. Si exclusion applicable → ne pas traiter sous IFRS 16, renvoyer vers la norme applicable",
    formulesCalcul: "N/A — test d'exclusion binaire",
    criteresValidation: "Le type d'actif doit être correctement identifié et l'exclusion justifiée par la norme applicable",
    formatEntree: "Type d'actif, nature du contrat",
    formatSortie: "{ excluDuScope: boolean, normeApplicable: string, justification: string }",
  },
  // ÉVALUATION (9 rules)
  {
    id: "rule-9",
    code: "IFRS 16.26-28",
    title: "Évaluation initiale du passif locatif",
    category: "evaluation",
    type: "obligatoire",
    description: "Le passif locatif est évalué initialement à la valeur actualisée des paiements de loyers non encore versés, incluant les loyers fixes, les loyers variables indexés, les montants attendus au titre des garanties de valeur résiduelle, et le prix d'exercice d'une option d'achat raisonnablement certaine.",
    reference: "IFRS 16.26-28",
    enabled: true,
    instructionsTraitement: "1. Identifier tous les paiements de loyers à inclure :\n   a) Loyers fixes (nets des avantages incitatifs)\n   b) Loyers variables dépendant d'un indice ou taux (valeur initiale de l'indice)\n   c) Montants attendus au titre de la garantie de valeur résiduelle\n   d) Prix d'exercice d'une option d'achat (si RC)\n   e) Pénalités de résiliation anticipée (si la durée reflète l'exercice de l'option)\n2. Construire l'échéancier des flux futurs\n3. Actualiser chaque flux au taux déterminé (IFRS 16.26)\n4. Passif locatif initial = Σ des VA des flux",
    formulesCalcul: "PL₀ = Σ(t=1→n) Loyer_t / (1 + r)^t\noù r = taux trimestriel, t = trimestre, Loyer_t = paiement de la période t",
    criteresValidation: "1. Vérifier que le passif = somme des VA des flux\n2. Vérifier que total non actualisé des flux = loyers totaux contractuels\n3. Écart d'arrondi acceptable : ≤ 1€",
    formatEntree: "Échéancier des loyers, taux d'actualisation, date de commencement",
    formatSortie: "{ passifLocatifInitial: number, totalFluxNonActualises: number, chargeFinanciereTotal: number, echeancier: Array<{periode: number, flux: number, va: number}> }",
  },
  {
    id: "rule-10",
    code: "IFRS 16.23-25",
    title: "Évaluation initiale de l'actif ROU",
    category: "evaluation",
    type: "obligatoire",
    description: "L'actif de droit d'utilisation est évalué initialement au coût : passif locatif + paiements effectués avant ou à la date de commencement - avantages incitatifs + coûts directs initiaux + estimation de la remise en état.",
    reference: "IFRS 16.23-25",
    enabled: true,
    instructionsTraitement: "1. Partir du montant du passif locatif initial\n2. Ajouter les paiements de loyers effectués avant ou à la date de commencement (avances, dépôts non remboursables)\n3. Déduire les avantages incitatifs reçus du bailleur (franchise, contribution aux travaux)\n4. Ajouter les coûts directs initiaux supportés par le preneur\n5. Ajouter l'estimation de la provision pour remise en état (IAS 37)\n6. ROU₀ = PL₀ + Paiements anticipés - Incitatifs + Coûts directs + Provision remise en état",
    formulesCalcul: "ROU₀ = PL₀ + Avances - Incitatifs + Coûts_directs + Provision_remise_en_état",
    criteresValidation: "ROU₀ ≥ PL₀ dans la majorité des cas (sauf incitatifs importants). Si ROU₀ < PL₀, vérifier la cohérence.",
    formatEntree: "Passif locatif initial, avances, incitatifs, coûts directs, provision remise en état",
    formatSortie: "{ actifROUInitial: number, composantes: { passifLocatif: number, avances: number, incitatifs: number, coutsDirects: number, provisionRemiseEnEtat: number } }",
  },
  {
    id: "rule-11",
    code: "IFRS 16.29-33",
    title: "Amortissement de l'actif ROU",
    category: "evaluation",
    type: "obligatoire",
    description: "L'actif ROU est amorti linéairement sur la durée du bail (ou la durée de vie de l'actif si transfert de propriété ou option d'achat RC).",
    reference: "IFRS 16.29-33, IAS 16",
    enabled: true,
    instructionsTraitement: "1. Déterminer la durée d'amortissement :\n   a) Si transfert de propriété en fin de bail ou option d'achat RC → durée de vie économique de l'actif\n   b) Sinon → durée du bail\n2. Méthode : linéaire (sauf si une autre méthode reflète mieux le rythme de consommation des avantages)\n3. Dotation = ROU₀ / nombre de périodes d'amortissement\n4. La valeur résiduelle de l'actif ROU est normalement nulle",
    formulesCalcul: "Dotation_période = ROU₀ / Nombre_périodes\nROU_t = ROU₀ - Σ Dotations_cumulées - Dépréciations_éventuelles",
    criteresValidation: "ROU final (dernière période) = 0 (tolérance 1€). Vérifier que la somme des dotations = ROU₀.",
    formatEntree: "Actif ROU initial, durée d'amortissement, méthode",
    formatSortie: "{ dotationPeriode: number, tableauAmortissement: Array<{periode: number, dotation: number, rouNet: number}> }",
  },
  {
    id: "rule-12",
    code: "IFRS 16.36-38",
    title: "Charge d'intérêt sur le passif locatif",
    category: "evaluation",
    type: "obligatoire",
    description: "La charge d'intérêt est calculée en appliquant le taux d'actualisation au solde du passif locatif au début de chaque période.",
    reference: "IFRS 16.36-38",
    enabled: true,
    instructionsTraitement: "1. Au début de chaque période : Charge_intérêt = PL_début_période × Taux_période\n2. Mise à jour du passif : PL_fin_période = PL_début_période + Charge_intérêt - Loyer_payé\n3. Le passif locatif diminue progressivement (profil similaire à un emprunt)\n4. Vérifier que le passif atteint zéro en fin de bail",
    formulesCalcul: "Intérêt_t = PL_(t-1) × r\nPL_t = PL_(t-1) + Intérêt_t - Loyer_t\noù r = taux par période",
    criteresValidation: "PL final = 0 (tolérance 1€). Σ(Intérêts) = Σ(Loyers) - PL₀. Chaque intérêt_t > 0.",
    formatEntree: "Passif locatif initial, taux par période, échéancier des loyers",
    formatSortie: "{ tableauPassif: Array<{periode: number, passifDebut: number, interet: number, loyer: number, passifFin: number}>, totalInterets: number }",
  },
  {
    id: "rule-13",
    code: "IFRS 16.39",
    title: "Réévaluation du passif — indexation",
    category: "evaluation",
    type: "parametrable",
    description: "Lorsque les paiements de loyers futurs changent suite à une modification d'un indice ou d'un taux, le passif locatif est réévalué.",
    reference: "IFRS 16.42(b)",
    enabled: true,
    instructionsTraitement: "1. À chaque date de réévaluation d'indice (généralement annuelle) :\n   a) Déterminer le nouvel indice applicable (ICC, ILC, ILAT)\n   b) Recalculer les loyers futurs restants avec le nouvel indice\n   c) Actualiser les nouveaux flux au taux d'actualisation initial (pas de nouveau taux)\n2. Variation du passif = Nouveau passif recalculé - Ancien passif\n3. Ajuster l'actif ROU du même montant (sauf si ROU déjà réduit à zéro)",
    formulesCalcul: "Nouveau_loyer = Loyer_base × (Indice_nouveau / Indice_base)\nΔPL = VA(nouveaux_flux) - PL_avant_réévaluation\nROU_après = ROU_avant + ΔPL",
    criteresValidation: "Vérifier que le taux d'actualisation utilisé est le taux initial (pas un nouveau taux). Le ΔPL et le ΔROU doivent être égaux.",
    formatEntree: "Indice de base, nouvel indice, échéancier résiduel, taux initial",
    formatSortie: "{ ancienPassif: number, nouveauPassif: number, variation: number, ajustementROU: number }",
  },
  {
    id: "rule-14",
    code: "IFRS 16.44-46",
    title: "Modification de contrat — bail séparé",
    category: "evaluation",
    type: "obligatoire",
    description: "Une modification est comptabilisée comme un bail séparé si elle augmente le scope avec un droit d'utilisation supplémentaire ET la contrepartie augmente proportionnellement au prix individuel.",
    reference: "IFRS 16.44",
    enabled: true,
    instructionsTraitement: "1. Vérifier les deux conditions de bail séparé :\n   a) La modification augmente le scope du bail (ex: surface supplémentaire)\n   b) La contrepartie augmente d'un montant proportionnel au prix individuel, ajusté des circonstances\n2. Si les deux conditions sont remplies → comptabiliser comme un nouveau bail séparé\n3. Sinon → remesurer le bail existant (voir IFRS 16.45)",
    formulesCalcul: "Test : ΔScope ET ΔContrepartie ≈ Prix_individuel_ajusté → Bail séparé",
    criteresValidation: "Les deux conditions doivent être cumulativement remplies. Documenter le prix individuel de référence.",
    formatEntree: "Avenant au contrat, anciennes et nouvelles conditions, prix de marché comparables",
    formatSortie: "{ bailSepare: boolean, conditionScope: boolean, conditionPrix: boolean, traitementRetenu: 'bail_separe'|'remesure' }",
  },
  {
    id: "rule-15",
    code: "IFRS 16.45",
    title: "Modification de contrat — remesure du bail",
    category: "evaluation",
    type: "obligatoire",
    description: "Si la modification n'est pas un bail séparé, le preneur remesure le passif locatif en utilisant un nouveau taux d'actualisation et ajuste l'actif ROU en conséquence.",
    reference: "IFRS 16.45",
    enabled: true,
    instructionsTraitement: "1. Déterminer un nouveau taux d'actualisation à la date de modification\n2. Recalculer le passif locatif avec les nouveaux flux et le nouveau taux\n3. Trois cas de figure :\n   a) Diminution du scope → réduire ROU proportionnellement, écart en résultat\n   b) Autres modifications → ajuster ROU du même montant que la variation du passif\n4. Nouveau tableau d'amortissement à partir de la date de modification",
    formulesCalcul: "Nouveau_PL = VA(nouveaux_flux, nouveau_taux)\nΔPL = Nouveau_PL - Ancien_PL_résiduel\nROU_après = ROU_résiduel + ΔPL (si augmentation/modification)\nROU_après = ROU_résiduel × (Nouveau_PL / Ancien_PL) (si diminution scope)",
    criteresValidation: "Un nouveau taux doit être utilisé (différent du taux initial). Documenter la source du nouveau taux.",
    formatEntree: "Conditions actuelles, nouvelles conditions, nouveau taux, date de modification",
    formatSortie: "{ nouveauPassif: number, ajustementROU: number, gainPerteResiliation: number, nouveauTaux: number }",
  },
  // COMPTABILISATION (3 rules)
  {
    id: "rule-16",
    code: "IFRS 16.47-48",
    title: "Présentation au bilan",
    category: "comptabilisation",
    type: "obligatoire",
    description: "L'actif ROU est présenté séparément des autres actifs au bilan (ou en note). Le passif locatif est présenté séparément des autres passifs (ou en note).",
    reference: "IFRS 16.47-48",
    enabled: true,
    instructionsTraitement: "1. Actif ROU : présenter dans une ligne séparée au bilan ou dans la catégorie d'actifs correspondants (immobilisations corporelles) avec mention en note\n2. Passif locatif : présenter séparément ou ventiler entre courant (< 12 mois) et non-courant\n3. Ne pas mélanger avec les emprunts financiers classiques\n4. Fournir le détail dans les notes annexes",
    formulesCalcul: "Passif_courant = Σ Remboursements des 12 prochains mois\nPassif_non_courant = PL_total - Passif_courant",
    criteresValidation: "Passif_courant + Passif_non_courant = PL_total. L'actif ROU net doit correspondre au tableau d'amortissement.",
    formatEntree: "Passif locatif total, échéancier de remboursement, actif ROU net",
    formatSortie: "{ actifROU: number, passifCourant: number, passifNonCourant: number }",
  },
  {
    id: "rule-17",
    code: "PCG-IFRS16",
    title: "Écritures comptables — Reconnaissance initiale",
    category: "comptabilisation",
    type: "obligatoire",
    description: "À la date de commencement, le preneur comptabilise l'actif ROU au débit et le passif locatif au crédit, avec les ajustements pour avances, incitatifs et provision de remise en état.",
    reference: "PCG, ANC 2020, IFRS 16.22-25",
    enabled: true,
    instructionsTraitement: "1. Écriture de reconnaissance initiale :\n   Débit 261x Droit d'utilisation : montant ROU₀\n   Crédit 1686 Passif locatif IFRS 16 : montant PL₀\n   Crédit 1581 Provision remise en état : si applicable\n2. Écriture d'amortissement périodique :\n   Débit 6811 Dotation aux amortissements ROU : dotation\n   Crédit 2861x Amortissement du droit d'utilisation : dotation\n3. Écriture de charge financière :\n   Débit 6615 Intérêts sur passif locatif : intérêt\n   Crédit 1686 Passif locatif IFRS 16 : intérêt\n4. Écriture de paiement du loyer :\n   Débit 1686 Passif locatif IFRS 16 : loyer\n   Crédit 512 Banque : loyer",
    formulesCalcul: "N/A — écritures en partie double, la balance doit être équilibrée",
    criteresValidation: "Total débits = Total crédits pour chaque écriture. Cohérence avec le tableau d'amortissement.",
    formatEntree: "Montants ROU, PL, provision, dotation, intérêt, loyer",
    formatSortie: "{ ecritures: Array<{date: string, journal: string, debit: {compte: string, montant: number}, credit: {compte: string, montant: number}}> }",
  },
  {
    id: "rule-18",
    code: "IFRS 16.53",
    title: "Informations à fournir — Disclosure",
    category: "comptabilisation",
    type: "obligatoire",
    description: "Le preneur doit fournir des informations permettant aux utilisateurs des états financiers d'évaluer l'incidence des contrats de location sur sa situation financière, sa performance et ses flux de trésorerie.",
    reference: "IFRS 16.51-60",
    enabled: true,
    instructionsTraitement: "1. Disclosures obligatoires :\n   a) Charge d'amortissement des actifs ROU par classe d'actifs\n   b) Charge d'intérêt sur les passifs locatifs\n   c) Charge relative aux baux court terme (si exemption utilisée)\n   d) Charge relative aux actifs de faible valeur (si exemption)\n   e) Charge relative aux paiements de loyers variables non inclus dans le passif\n   f) Produits de sous-location\n   g) Sorties de trésorerie totales au titre des contrats de location\n   h) Ajouts d'actifs ROU\n   i) Valeur comptable des actifs ROU par classe en fin de période\n2. Analyse de maturité des passifs locatifs\n3. Informations qualitatives sur la stratégie de gestion des baux",
    formulesCalcul: "N/A — compilation d'informations existantes",
    criteresValidation: "Tous les items IFRS 16.53 doivent être couverts. Les montants doivent être réconciliables avec les autres tableaux.",
    formatEntree: "Ensemble des données de calcul et de comptabilisation",
    formatSortie: "{ disclosures: { chargeAmortissement: number, chargeInteret: number, chargeBauxCourtTerme: number, sortiesTresorerie: number, analyseMaturite: object } }",
  },
  // REPORTING (5 rules)
  {
    id: "rule-19",
    code: "IAS 36",
    title: "Test de dépréciation de l'actif ROU",
    category: "reporting",
    type: "recommande",
    description: "L'actif ROU est soumis aux dispositions d'IAS 36 — Dépréciation d'actifs. Le preneur doit tester la dépréciation s'il existe des indices de perte de valeur.",
    reference: "IFRS 16.33, IAS 36",
    enabled: true,
    instructionsTraitement: "1. À chaque date de clôture, rechercher des indices de perte de valeur :\n   a) Indices externes : déclin significatif de la valeur de marché, changements défavorables (technologie, marché, environnement)\n   b) Indices internes : obsolescence, dommage physique, performance inférieure aux prévisions\n2. Si indices présents → estimer la valeur recouvrable\n   Valeur recouvrable = Max(Juste valeur nette des coûts de cession, Valeur d'utilité)\n3. Si valeur recouvrable < valeur comptable → comptabiliser une dépréciation\n4. Dépréciation = Valeur comptable - Valeur recouvrable",
    formulesCalcul: "Dépréciation = Max(0, VNC_ROU - Valeur_recouvrable)\nValeur_recouvrable = Max(JV_nette, Valeur_utilité)",
    criteresValidation: "La valeur recouvrable doit être documentée. Si pas de dépréciation, documenter l'absence d'indices.",
    formatEntree: "Valeur nette comptable ROU, indices de perte de valeur, estimations de juste valeur et valeur d'utilité",
    formatSortie: "{ indicesPresents: boolean, valeurRecouvrable: number, depreciation: number, vnc_apres: number }",
  },
  {
    id: "rule-20",
    code: "IAS 37.14",
    title: "Provision pour remise en état",
    category: "reporting",
    type: "parametrable",
    description: "Si le bail prévoit une obligation de remise en état des locaux, le preneur doit comptabiliser une provision selon IAS 37 et l'inclure dans le coût de l'actif ROU.",
    reference: "IAS 37.14, IFRS 16.24(d)",
    enabled: true,
    instructionsTraitement: "1. Identifier si le bail contient une clause de remise en état (restitution dans l'état d'origine)\n2. Si oui : estimer le coût de remise en état à la date de fin du bail\n3. Actualiser ce coût à la date de commencement du bail\n4. Comptabiliser : augmentation ROU₀ / provision non courante\n5. Chaque année : désactualiser la provision (charge financière)\n6. En fin de bail : la provision = coût estimé de remise en état",
    formulesCalcul: "Provision₀ = Coût_estimé / (1 + taux)^n\nDésactualisation_t = Provision_(t-1) × taux\nProvision_t = Provision_(t-1) + Désactualisation_t",
    criteresValidation: "La provision en fin de bail doit être égale au coût estimé (tolérance 1€). La provision ne peut pas être négative.",
    formatEntree: "Clause de remise en état, estimation du coût, taux d'actualisation, durée du bail",
    formatSortie: "{ provisionInitiale: number, coutEstime: number, tableauDesactualisation: Array<{periode: number, provision: number, charge: number}> }",
  },
  {
    id: "rule-21",
    code: "IFRS 16.B36",
    title: "Franchise de loyer",
    category: "evaluation",
    type: "parametrable",
    description: "Les périodes de franchise de loyer font partie intégrante du bail et sont prises en compte dans le calcul du passif locatif (les paiements sont simplement nuls pendant ces périodes).",
    reference: "IFRS 16.B36",
    enabled: true,
    instructionsTraitement: "1. Identifier les périodes de franchise dans le bail\n2. Dans l'échéancier des flux : inscrire 0€ pour les périodes de franchise\n3. La franchise ne réduit PAS la durée du bail\n4. L'effet de la franchise est capturé automatiquement dans le calcul du passif (les flux nuls ont une VA de 0)\n5. Impact : le passif locatif initial est inférieur à ce qu'il serait sans franchise",
    formulesCalcul: "Flux_t = 0 pendant la franchise, Loyer normal après\nPL₀ = Σ VA(Flux_t) incluant les périodes à 0",
    criteresValidation: "L'échéancier doit montrer des flux à 0 pendant la franchise. La durée totale ne change pas.",
    formatEntree: "Nombre de périodes de franchise, position dans le bail (début, milieu)",
    formatSortie: "{ periodesGratuites: number, impactSurPassif: number, echeancierAvecFranchise: Array<{periode: number, flux: number}> }",
  },
  {
    id: "rule-22",
    code: "IFRS 16.B37",
    title: "Durée raisonnablement certaine — bail 3/6/9",
    category: "identification",
    type: "parametrable",
    description: "Pour les baux commerciaux français 3/6/9, la durée retenue selon IFRS 16 n'est pas nécessairement 9 ans. Elle dépend de l'analyse des facteurs B37 pour chaque échéance triennale.",
    reference: "IFRS 16.B37-B40, ANC Position 2018",
    enabled: true,
    instructionsTraitement: "1. Analyser chaque échéance triennale (3 ans, 6 ans, 9 ans) séparément\n2. Pour chaque échéance, évaluer les facteurs B37 :\n   a) Améliorations locatives significatives non amorties ? → favorise prolongation\n   b) Coûts de résiliation importants (indemnité, déménagement) ? → favorise prolongation\n   c) L'actif est-il critique pour l'activité ? → favorise prolongation\n   d) Historique de renouvellement du preneur ? → indicateur\n   e) Conditions de marché favorables ? → impact variable\n3. Position ANC : pour un bail 3/6/9 standard sans facteur spécifique, la durée minimum est généralement 3 ans (première période ferme)\n4. Documenter la conclusion avec les facteurs retenus",
    formulesCalcul: "N/A — jugement qualitatif structuré par facteur B37",
    criteresValidation: "Chaque échéance triennale doit être analysée. La conclusion doit être justifiée par ≥ 2 facteurs. Si durée > 3 ans, les facteurs de prolongation doivent être documentés.",
    formatEntree: "Type de bail, améliorations locatives, coûts de résiliation, importance stratégique du local",
    formatSortie: "{ dureeRetenue: number, analyseParEcheance: Array<{echeance: number, raisonnablementCertain: boolean, facteurs: string[]}> }",
  },
  {
    id: "rule-23",
    code: "ANC-2020",
    title: "Plan comptable français — comptes IFRS 16",
    category: "comptabilisation",
    type: "obligatoire",
    description: "Le plan comptable français (PCG) prévoit des comptes spécifiques pour la comptabilisation des opérations IFRS 16 selon le règlement ANC 2020.",
    reference: "ANC 2020, PCG",
    enabled: true,
    instructionsTraitement: "1. Comptes à utiliser :\n   - 261x : Droit d'utilisation (actif)\n   - 2861x : Amortissement du droit d'utilisation\n   - 1686 : Passif locatif IFRS 16\n   - 6811 : Dotation aux amortissements du ROU\n   - 6615 : Intérêts sur passif locatif\n   - 1581 : Provision pour remise en état\n   - 512 : Banque (paiement loyer)\n2. Les sous-comptes (x) peuvent être personnalisés par le groupe selon sa nomenclature interne\n3. Vérifier la cohérence avec le plan comptable du groupe",
    formulesCalcul: "N/A — mapping de comptes",
    criteresValidation: "Chaque écriture doit utiliser les comptes PCG corrects. Les comptes doivent exister dans le plan comptable du groupe.",
    formatEntree: "Plan comptable du groupe, nomenclature interne",
    formatSortie: "{ mapping: Record<string, {compte: string, libelle: string}> }",
  },
];

// ============================
// KB ENTRIES
// ============================

const initialKB: KBEntry[] = [
  { id: "kb-1", title: "IFRS 16 — Contrats de location (texte intégral)", type: "norme", status: "en_vigueur", source: "IASB", description: "Norme complète IFRS 16 incluant tous les paragraphes et le guide d'application", contenu: "Texte normatif complet : définitions, scope, identification, exemptions, comptabilisation preneur, comptabilisation bailleur, sale & leaseback, disclosure, dispositions transitoires.", dateEffet: "2019-01-01" },
  { id: "kb-2", title: "IAS 36 — Dépréciation d'actifs", type: "norme", status: "en_vigueur", source: "IASB", description: "Norme IAS 36 applicable aux tests de dépréciation des actifs ROU", contenu: "Indices de perte de valeur, estimation de la valeur recouvrable, allocation des dépréciations aux UGT.", dateEffet: "2004-03-31" },
  { id: "kb-3", title: "IAS 37 — Provisions, passifs éventuels et actifs éventuels", type: "norme", status: "en_vigueur", source: "IASB", description: "Norme IAS 37 applicable à la provision pour remise en état", contenu: "Conditions de comptabilisation d'une provision, meilleure estimation, actualisation, provision pour remise en état.", dateEffet: "1998-07-01" },
  { id: "kb-4", title: "Guide d'application IFRS 16 — ANC", type: "guide", status: "en_vigueur", source: "ANC France", description: "Guide de l'Autorité des Normes Comptables pour l'application d'IFRS 16 en France", contenu: "Positions de l'ANC sur la durée des baux 3/6/9, le taux d'actualisation, les composantes non locatives, la transition.", dateEffet: "2020-01-01" },
  { id: "kb-5", title: "Règlement ANC 2020 — PCG IFRS 16", type: "reglementation", status: "en_vigueur", source: "ANC France", description: "Règlement modifiant le PCG pour la comptabilisation des droits d'utilisation et passifs locatifs", contenu: "Comptes 261x, 2861x, 1686, instructions de comptabilisation.", dateEffet: "2020-01-01" },
  { id: "kb-6", title: "Position AMF — Durée des baux commerciaux", type: "position", status: "en_vigueur", source: "AMF", description: "Recommandations de l'AMF sur la détermination de la durée exécutoire des baux commerciaux français", contenu: "Analyse des pratiques observées, recommandations sur la documentation des hypothèses de durée.", dateEffet: "2021-01-01" },
  { id: "kb-7", title: "Indices INSEE — ICC, ILC, ILAT", type: "interne", status: "en_vigueur", source: "INSEE", description: "Séries des indices de référence pour l'indexation des loyers commerciaux", contenu: "ICC (Indice du Coût de la Construction), ILC (Indice des Loyers Commerciaux), ILAT (Indice des Loyers des Activités Tertiaires). Valeurs trimestrielles.", dateEffet: "2024-01-01" },
  { id: "kb-8", title: "Taux de référence — TME et OAT", type: "interne", status: "en_vigueur", source: "Banque de France", description: "Courbe des taux OAT et TME pour la détermination du taux d'actualisation", contenu: "TME mensuel, courbe OAT par maturité, méthodologie de calcul du spread de crédit.", dateEffet: "2024-01-01" },
  { id: "kb-9", title: "Politique groupe SYNLAB — Baux commerciaux", type: "interne", status: "en_vigueur", source: "SYNLAB", description: "Politique comptable du groupe SYNLAB pour le traitement IFRS 16 des baux commerciaux de laboratoires", contenu: "Choix comptables : exemption courte durée par classe, non-séparation des composantes pour les baux simples, méthodologie du taux, procédure de validation.", dateEffet: "2024-01-01" },
  { id: "kb-10", title: "IFRS 16 — Modifications de contrat (exemples illustratifs)", type: "guide", status: "en_vigueur", source: "IASB", description: "Exemples illustratifs de l'IASB pour le traitement des modifications de contrat de location", contenu: "Exemple : bail séparé vs remesure, réduction de scope, prolongation, changement de loyer.", dateEffet: "2019-01-01" },
];

// ============================
// 6 WORKFLOWS with P1 (agent-level rules/KB)
// ============================

const initialWorkflows: Workflow[] = [
  {
    id: "wf-reconnaissance",
    name: "Reconnaissance initiale",
    category: "Reconnaissance",
    description: "Traitement complet d'un nouveau bail commercial : de l'ingestion du document à la comptabilisation des écritures initiales.",
    status: "actif",
    steps: [
      { id: "wf1-s1", order: 1, label: "Ingestion documentaire", agentConfig: { agentId: "agent-ingestion", assignedRuleIds: ["rule-1", "rule-8"], assignedKBIds: ["kb-1", "kb-9"] } },
      { id: "wf1-s2", order: 2, label: "Classification IFRS 16", agentConfig: { agentId: "agent-classification", assignedRuleIds: ["rule-1", "rule-2", "rule-3", "rule-6", "rule-7", "rule-8"], assignedKBIds: ["kb-1", "kb-4", "kb-9"] } },
      { id: "wf1-s3", order: 3, label: "Extraction des données", agentConfig: { agentId: "agent-extraction", assignedRuleIds: ["rule-3", "rule-4", "rule-5", "rule-21", "rule-22"], assignedKBIds: ["kb-1", "kb-4", "kb-6", "kb-7", "kb-8"] } },
      { id: "wf1-s4", order: 4, label: "Contrôle IFRS 16", agentConfig: { agentId: "agent-controle", assignedRuleIds: ["rule-1", "rule-2", "rule-3", "rule-4", "rule-5", "rule-6", "rule-7", "rule-8", "rule-21", "rule-22"], assignedKBIds: ["kb-1", "kb-3", "kb-4", "kb-6"] } },
      { id: "wf1-s5", order: 5, label: "Validation métier", agentConfig: { agentId: "agent-controle", assignedRuleIds: ["rule-4", "rule-5", "rule-20", "rule-22"], assignedKBIds: ["kb-1", "kb-4", "kb-6", "kb-9"] } },
      { id: "wf1-s6", order: 6, label: "Calcul IFRS 16", agentConfig: { agentId: "agent-calcul", assignedRuleIds: ["rule-9", "rule-10", "rule-11", "rule-12", "rule-21"], assignedKBIds: ["kb-1", "kb-8"] } },
      { id: "wf1-s7", order: 7, label: "Comptabilisation & reporting", agentConfig: { agentId: "agent-comptabilisation", assignedRuleIds: ["rule-16", "rule-17", "rule-18", "rule-23"], assignedKBIds: ["kb-1", "kb-5", "kb-9"] } },
    ],
  },
  {
    id: "wf-indexation",
    name: "Réévaluation annuelle (indexation)",
    category: "Événement de vie",
    description: "Traitement de la réévaluation du passif locatif et de l'actif ROU suite à une variation de l'indice de référence (ICC, ILC, ILAT).",
    status: "actif",
    steps: [
      { id: "wf2-s1", order: 1, label: "Détection de l'indexation", agentConfig: { agentId: "agent-indexation", assignedRuleIds: ["rule-13"], assignedKBIds: ["kb-1", "kb-7"] } },
      { id: "wf2-s2", order: 2, label: "Recalcul des flux", agentConfig: { agentId: "agent-calcul", assignedRuleIds: ["rule-13", "rule-9", "rule-12"], assignedKBIds: ["kb-1", "kb-7", "kb-8"] } },
      { id: "wf2-s3", order: 3, label: "Ajustement ROU et passif", agentConfig: { agentId: "agent-indexation", assignedRuleIds: ["rule-13", "rule-10", "rule-11"], assignedKBIds: ["kb-1"] } },
      { id: "wf2-s4", order: 4, label: "Écritures de réévaluation", agentConfig: { agentId: "agent-comptabilisation", assignedRuleIds: ["rule-17", "rule-23"], assignedKBIds: ["kb-1", "kb-5"] } },
    ],
  },
  {
    id: "wf-modification",
    name: "Modification de contrat (avenant)",
    category: "Événement de vie",
    description: "Traitement d'un avenant de bail : analyse bail séparé vs remesure, recalcul du passif et de l'actif, nouvelles écritures.",
    status: "actif",
    steps: [
      { id: "wf3-s1", order: 1, label: "Ingestion de l'avenant", agentConfig: { agentId: "agent-ingestion", assignedRuleIds: ["rule-1"], assignedKBIds: ["kb-1", "kb-10"] } },
      { id: "wf3-s2", order: 2, label: "Analyse bail séparé / remesure", agentConfig: { agentId: "agent-modification", assignedRuleIds: ["rule-14", "rule-15"], assignedKBIds: ["kb-1", "kb-10"] } },
      { id: "wf3-s3", order: 3, label: "Extraction nouvelles conditions", agentConfig: { agentId: "agent-extraction", assignedRuleIds: ["rule-3", "rule-4", "rule-5"], assignedKBIds: ["kb-1", "kb-4", "kb-8"] } },
      { id: "wf3-s4", order: 4, label: "Recalcul passif et ROU", agentConfig: { agentId: "agent-calcul", assignedRuleIds: ["rule-9", "rule-10", "rule-11", "rule-12", "rule-15"], assignedKBIds: ["kb-1", "kb-8"] } },
      { id: "wf3-s5", order: 5, label: "Écritures de modification", agentConfig: { agentId: "agent-comptabilisation", assignedRuleIds: ["rule-17", "rule-23"], assignedKBIds: ["kb-1", "kb-5"] } },
    ],
  },
  {
    id: "wf-resiliation",
    name: "Résiliation anticipée",
    category: "Événement de vie",
    description: "Traitement de la résiliation anticipée d'un bail : décomptabilisation du passif et de l'actif, gain/perte de résiliation.",
    status: "actif",
    steps: [
      { id: "wf4-s1", order: 1, label: "Réception de la résiliation", agentConfig: { agentId: "agent-ingestion", assignedRuleIds: ["rule-1"], assignedKBIds: ["kb-1"] } },
      { id: "wf4-s2", order: 2, label: "Calcul du gain/perte", agentConfig: { agentId: "agent-calcul", assignedRuleIds: ["rule-15", "rule-9"], assignedKBIds: ["kb-1"] } },
      { id: "wf4-s3", order: 3, label: "Reprise de la provision", agentConfig: { agentId: "agent-controle", assignedRuleIds: ["rule-20"], assignedKBIds: ["kb-1", "kb-3"] } },
      { id: "wf4-s4", order: 4, label: "Écritures de décomptabilisation", agentConfig: { agentId: "agent-comptabilisation", assignedRuleIds: ["rule-17", "rule-23"], assignedKBIds: ["kb-1", "kb-5"] } },
    ],
  },
  {
    id: "wf-depreciation",
    name: "Dépréciation du droit d'utilisation",
    category: "Événement de vie",
    description: "Test de dépréciation IAS 36 de l'actif ROU : recherche d'indices, estimation de la valeur recouvrable, comptabilisation de la perte de valeur.",
    status: "brouillon",
    steps: [
      { id: "wf5-s1", order: 1, label: "Recherche d'indices de dépréciation", agentConfig: { agentId: "agent-depreciation", assignedRuleIds: ["rule-19"], assignedKBIds: ["kb-2"] } },
      { id: "wf5-s2", order: 2, label: "Estimation valeur recouvrable", agentConfig: { agentId: "agent-depreciation", assignedRuleIds: ["rule-19"], assignedKBIds: ["kb-2"] } },
      { id: "wf5-s3", order: 3, label: "Écritures de dépréciation", agentConfig: { agentId: "agent-comptabilisation", assignedRuleIds: ["rule-17", "rule-19", "rule-23"], assignedKBIds: ["kb-1", "kb-2", "kb-5"] } },
    ],
  },
  {
    id: "wf-reporting",
    name: "Clôture et reporting périodique",
    category: "Reporting",
    description: "Compilation des données pour la clôture : disclosures IFRS 16, analyse de maturité, réconciliation des engagements, reporting au groupe.",
    status: "actif",
    steps: [
      { id: "wf6-s1", order: 1, label: "Collecte des données de clôture", agentConfig: { agentId: "agent-reporting", assignedRuleIds: ["rule-18"], assignedKBIds: ["kb-1", "kb-9"] } },
      { id: "wf6-s2", order: 2, label: "Analyse de maturité et réconciliation", agentConfig: { agentId: "agent-reporting", assignedRuleIds: ["rule-16", "rule-18"], assignedKBIds: ["kb-1", "kb-4"] } },
      { id: "wf6-s3", order: 3, label: "Génération des disclosures", agentConfig: { agentId: "agent-reporting", assignedRuleIds: ["rule-18", "rule-23"], assignedKBIds: ["kb-1", "kb-5", "kb-9"] } },
    ],
  },
];

// ============================
// CONTEXT & PROVIDER
// ============================

interface AdminState {
  agents: Agent[];
  rules: Rule[];
  kb: KBEntry[];
  workflows: Workflow[];
}

interface AdminContextType extends AdminState {
  // Agent actions
  toggleAgent: (id: string) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  // Rule actions
  toggleRule: (id: string) => void;
  updateRule: (id: string, updates: Partial<Rule>) => void;
  // KB actions
  updateKBEntry: (id: string, updates: Partial<KBEntry>) => void;
  addKBEntry: (entry: KBEntry) => void;
  // Workflow actions
  updateWorkflow: (id: string, updates: Partial<Workflow>) => void;
  updateWorkflowStep: (workflowId: string, stepId: string, updates: Partial<WorkflowStepAgentConfig>) => void;
  addWorkflowStep: (workflowId: string, step: WorkflowStep) => void;
  removeWorkflowStep: (workflowId: string, stepId: string) => void;
  addWorkflow: (workflow: Workflow) => void;
  deleteWorkflow: (id: string) => void;
  // P1: Agent-step level rule/KB assignment
  assignRuleToStep: (workflowId: string, stepId: string, ruleId: string) => void;
  unassignRuleFromStep: (workflowId: string, stepId: string, ruleId: string) => void;
  assignKBToStep: (workflowId: string, stepId: string, kbId: string) => void;
  unassignKBFromStep: (workflowId: string, stepId: string, kbId: string) => void;
  // Computed
  getAgentById: (id: string) => Agent | undefined;
  getRuleById: (id: string) => Rule | undefined;
  getKBById: (id: string) => KBEntry | undefined;
  getActiveRulesCount: () => number;
  getActiveAgentsCount: () => number;
}

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminState>({
    agents: initialAgents,
    rules: initialRules,
    kb: initialKB,
    workflows: initialWorkflows,
  });

  const toggleAgent = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      agents: prev.agents.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
    }));
  }, []);

  const updateAgent = useCallback((id: string, updates: Partial<Agent>) => {
    setState((prev) => ({
      ...prev,
      agents: prev.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    }));
  }, []);

  const toggleRule = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    }));
  }, []);

  const updateRule = useCallback((id: string, updates: Partial<Rule>) => {
    setState((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    }));
  }, []);

  const updateKBEntry = useCallback((id: string, updates: Partial<KBEntry>) => {
    setState((prev) => ({
      ...prev,
      kb: prev.kb.map((k) => (k.id === id ? { ...k, ...updates } : k)),
    }));
  }, []);

  const addKBEntry = useCallback((entry: KBEntry) => {
    setState((prev) => ({ ...prev, kb: [...prev.kb, entry] }));
  }, []);

  const updateWorkflow = useCallback((id: string, updates: Partial<Workflow>) => {
    setState((prev) => ({
      ...prev,
      workflows: prev.workflows.map((w) => (w.id === id ? { ...w, ...updates } : w)),
    }));
  }, []);

  const updateWorkflowStep = useCallback((workflowId: string, stepId: string, updates: Partial<WorkflowStepAgentConfig>) => {
    setState((prev) => ({
      ...prev,
      workflows: prev.workflows.map((w) =>
        w.id === workflowId
          ? {
              ...w,
              steps: w.steps.map((s) =>
                s.id === stepId ? { ...s, agentConfig: { ...s.agentConfig, ...updates } } : s
              ),
            }
          : w
      ),
    }));
  }, []);

  const addWorkflowStep = useCallback((workflowId: string, step: WorkflowStep) => {
    setState((prev) => ({
      ...prev,
      workflows: prev.workflows.map((w) =>
        w.id === workflowId ? { ...w, steps: [...w.steps, step] } : w
      ),
    }));
  }, []);

  const removeWorkflowStep = useCallback((workflowId: string, stepId: string) => {
    setState((prev) => ({
      ...prev,
      workflows: prev.workflows.map((w) =>
        w.id === workflowId
          ? { ...w, steps: w.steps.filter((s) => s.id !== stepId).map((s, i) => ({ ...s, order: i + 1 })) }
          : w
      ),
    }));
  }, []);

  const addWorkflow = useCallback((workflow: Workflow) => {
    setState((prev) => ({ ...prev, workflows: [...prev.workflows, workflow] }));
  }, []);

  const deleteWorkflow = useCallback((id: string) => {
    setState((prev) => ({ ...prev, workflows: prev.workflows.filter((w) => w.id !== id) }));
  }, []);

  // P1: Step-level rule/KB assignment
  const assignRuleToStep = useCallback((workflowId: string, stepId: string, ruleId: string) => {
    setState((prev) => ({
      ...prev,
      workflows: prev.workflows.map((w) =>
        w.id === workflowId
          ? {
              ...w,
              steps: w.steps.map((s) =>
                s.id === stepId && !s.agentConfig.assignedRuleIds.includes(ruleId)
                  ? { ...s, agentConfig: { ...s.agentConfig, assignedRuleIds: [...s.agentConfig.assignedRuleIds, ruleId] } }
                  : s
              ),
            }
          : w
      ),
    }));
  }, []);

  const unassignRuleFromStep = useCallback((workflowId: string, stepId: string, ruleId: string) => {
    setState((prev) => ({
      ...prev,
      workflows: prev.workflows.map((w) =>
        w.id === workflowId
          ? {
              ...w,
              steps: w.steps.map((s) =>
                s.id === stepId
                  ? { ...s, agentConfig: { ...s.agentConfig, assignedRuleIds: s.agentConfig.assignedRuleIds.filter((r) => r !== ruleId) } }
                  : s
              ),
            }
          : w
      ),
    }));
  }, []);

  const assignKBToStep = useCallback((workflowId: string, stepId: string, kbId: string) => {
    setState((prev) => ({
      ...prev,
      workflows: prev.workflows.map((w) =>
        w.id === workflowId
          ? {
              ...w,
              steps: w.steps.map((s) =>
                s.id === stepId && !s.agentConfig.assignedKBIds.includes(kbId)
                  ? { ...s, agentConfig: { ...s.agentConfig, assignedKBIds: [...s.agentConfig.assignedKBIds, kbId] } }
                  : s
              ),
            }
          : w
      ),
    }));
  }, []);

  const unassignKBFromStep = useCallback((workflowId: string, stepId: string, kbId: string) => {
    setState((prev) => ({
      ...prev,
      workflows: prev.workflows.map((w) =>
        w.id === workflowId
          ? {
              ...w,
              steps: w.steps.map((s) =>
                s.id === stepId
                  ? { ...s, agentConfig: { ...s.agentConfig, assignedKBIds: s.agentConfig.assignedKBIds.filter((k) => k !== kbId) } }
                  : s
              ),
            }
          : w
      ),
    }));
  }, []);

  const getAgentById = useCallback((id: string) => state.agents.find((a) => a.id === id), [state.agents]);
  const getRuleById = useCallback((id: string) => state.rules.find((r) => r.id === id), [state.rules]);
  const getKBById = useCallback((id: string) => state.kb.find((k) => k.id === id), [state.kb]);
  const getActiveRulesCount = useCallback(() => state.rules.filter((r) => r.enabled).length, [state.rules]);
  const getActiveAgentsCount = useCallback(() => state.agents.filter((a) => a.enabled).length, [state.agents]);

  return (
    <AdminContext.Provider
      value={{
        ...state,
        toggleAgent,
        updateAgent,
        toggleRule,
        updateRule,
        updateKBEntry,
        addKBEntry,
        updateWorkflow,
        updateWorkflowStep,
        addWorkflowStep,
        removeWorkflowStep,
        addWorkflow,
        deleteWorkflow,
        assignRuleToStep,
        unassignRuleFromStep,
        assignKBToStep,
        unassignKBFromStep,
        getAgentById,
        getRuleById,
        getKBById,
        getActiveRulesCount,
        getActiveAgentsCount,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
