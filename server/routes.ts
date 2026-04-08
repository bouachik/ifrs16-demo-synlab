import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/analyze-bail", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "Aucun fichier fourni" });
      }

      // Extract text from PDF using pdf-parse (cross-platform)
      let pdfText: string;
      try {
        const parsed = await pdfParse(req.file.buffer);
        pdfText = parsed.text;
      } catch (e) {
        return res.status(400).json({ success: false, error: "Impossible de lire le fichier PDF. Vérifiez qu'il s'agit d'un PDF valide." });
      }

      if (!pdfText || pdfText.trim().length < 50) {
        return res.status(400).json({ success: false, error: "Le PDF ne contient pas suffisamment de texte exploitable. Il s'agit peut-être d'un scan non-OCR." });
      }

      console.log(`[analyze-bail] Extracted ${pdfText.length} chars from ${req.file.originalname}`);

      const headerKey = req.headers["x-api-key"] as string | undefined;
      console.log(`[analyze-bail] API key from header: ${headerKey ? headerKey.substring(0, 10) + "..." : "NONE"}, env: ${process.env.ANTHROPIC_API_KEY ? "SET" : "NOT SET"}`);
      const resolvedKey = headerKey || process.env.ANTHROPIC_API_KEY;
      if (!resolvedKey) {
        return res.status(400).json({ success: false, error: "Clé API Anthropic manquante. Renseignez votre clé dans le champ prévu à cet effet." });
      }
      const client = new Anthropic({ apiKey: resolvedKey });

      const systemPrompt = `Tu es un expert comptable spécialisé en normes IFRS, en particulier IFRS 16 — Contrats de location. Tu analyses des baux commerciaux français avec une précision de niveau commissaire aux comptes.

MÉTHODOLOGIE DE CALCUL IFRS 16 :

1. DURÉE RETENUE (IFRS 16.B37) :
   - Bail 3/6/9 français = durée légale 9 ans, SAUF si le preneur a une incitation économique significative à résilier à 3 ou 6 ans (loyer sous-marché, investissements lourds, activité stratégique du site).
   - Retenir la période la plus probable en tenant compte : investissements du preneur, importance stratégique du site, historique de renouvellement, coûts de relocation.
   - Par défaut pour un bail 3/6/9 sans information contraire : retenir 9 ans (108 mois).

2. CONVENTION DE PAIEMENT :
   - Les baux commerciaux français paient les loyers TRIMESTRIELLEMENT À L'AVANCE (terme à échoir / début de période).
   - La formule de VA pour paiements en début de période :
     PL = L × [1 - (1+r)^(-n)] / r × (1+r)
     où L = loyer trimestriel HT, r = taux trimestriel, n = nombre de trimestres
   - Si franchise de loyer : les premiers trimestres ont L=0.

3. CALCULS :
   - Taux trimestriel r = (1 + taux_annuel/100)^(1/4) - 1
   - Taux par défaut si non mentionné : 2,50% annuel → r ≈ 0,6189%
   - Passif locatif initial = VA de tous les loyers futurs (franchise incluse comme L=0)
   - Actif ROU = Passif locatif + Provision remise en état + Coûts directs initiaux - Avantages incitatifs reçus
   - Charge financière totale = Somme des loyers payés - Passif locatif initial

4. COMPOSANTES (IFRS 16.12) :
   - Séparer les composantes locatives (loyer pur) des non-locatives (charges, services, assurances).
   - Si non séparable ou si le preneur applique l'exemption pratique : traiter l'ensemble comme composante unique.

5. TABLEAU D'AMORTISSEMENT :
   - Générer les 4 premières années trimestre par trimestre (ou jusqu'à la fin si < 4 ans).
   - Colonnes : période, passif_debut, loyer_paye, charge_financiere, remboursement_capital, passif_fin.

Si une donnée est absente du document, fais une estimation raisonnable basée sur les pratiques de marché et indique confiance < 70.`;

      const userPrompt = `Voici le texte extrait d'un bail commercial français. Analyse-le pour le traitement IFRS 16.

TEXTE DU BAIL :
---
${pdfText.substring(0, 60000)}
---

ÉTAPE 1 — RAISONNEMENT (ne pas inclure dans le JSON final) :
Avant de produire le JSON, raisonne mentalement sur :
a) La durée IFRS 16 à retenir et pourquoi (critères B37)
b) Le loyer trimestriel de référence (hors franchise, hors charges)
c) Le calcul pas à pas du passif locatif (formule VA terme à échoir)
d) La vérification : actif ROU = passif + provision

ÉTAPE 2 — Retourne UNIQUEMENT un JSON valide (sans markdown, sans backticks) :
{
  "preneur": "nom du preneur/locataire",
  "bailleur": "nom du bailleur/propriétaire",
  "adresse": "adresse complète du bien loué",
  "typeBail": "type de bail (ex: Bail commercial 3/6/9)",
  "dateEffet": "date de prise d'effet en texte",
  "dureeContractuelle": "durée contractuelle en texte (ex: 9 ans)",
  "dureeIFRS16Mois": 108,
  "justificationDuree": "explication en 1-2 phrases du choix de durée selon B37",
  "loyerAnnuelHT": 0,
  "loyerTrimestriel": 0,
  "franchiseTrimestres": 0,
  "indexation": "type d'indexation (ex: ILAT, ILC, ICC)",
  "depotGarantie": 0,
  "provisionRemiseEnEtat": 0,
  "tauxAnnuel": 2.50,
  "tauxTrimestriel": 0.6189,
  "conventionPaiement": "terme à échoir",
  "passifLocatifInitial": 0,
  "actifROUInitial": 0,
  "chargeFinanciereTotal": 0,
  "classificationConfiance": 95,
  "tableauAmortissement": [
    {"periode": 1, "passifDebut": 0, "loyerPaye": 0, "chargeFinanciere": 0, "remboursementCapital": 0, "passifFin": 0}
  ],
  "alertes": [
    {"type": "warning|info|error", "titre": "titre court", "description": "description détaillée en français", "reference": "IFRS 16.XX"}
  ],
  "champsExtraits": [
    {"label": "nom du champ", "valeur": "valeur extraite", "confiance": 95, "source": "p.X ou estimation", "categorie": "Parties|Bien loué|Durée|Loyer|Indexation|Garanties|Composantes"}
  ],
  "decisions": [
    {"id": "identifiant_unique", "titre": "titre de la décision", "description": "contexte en français", "options": [{"label": "option texte", "recommande": false}, {"label": "option recommandée", "recommande": true}], "recommandationJustification": "justification en français"}
  ],
  "ecritures": [
    {"date": "DD/MM/YYYY", "journal": "OD", "libelle": "libellé en français", "debit": {"compte": "XXXX", "libelle": "libellé compte", "montant": 0}, "credit": {"compte": "XXXX", "libelle": "libellé compte", "montant": 0}}
  ]
}

RÈGLES :
- dureeIFRS16Mois en MOIS (9 ans = 108)
- loyerTrimestriel = loyer trimestriel HT pur (hors charges, hors TVA)
- tauxTrimestriel = ((1 + tauxAnnuel/100)^0.25 - 1) × 100, arrondi 4 décimales
- passifLocatifInitial = VA des loyers trimestriels sur dureeIFRS16Mois/3 trimestres, paiements EN DÉBUT DE PÉRIODE
- actifROUInitial = passifLocatifInitial + provisionRemiseEnEtat (+ coûts directs si mentionnés)
- chargeFinanciereTotal = (loyerTrimestriel × nombre_trimestres_payants) - passifLocatifInitial
- tableauAmortissement : générer les 16 premières lignes (4 ans) ou toutes si bail < 4 ans
- alertes : couvrir durée retenue, composantes, franchise, provision, taux, indexation
- decisions : couvrir durée retenue, séparation composantes, provision pour remise en état, taux IBR
- champsExtraits : 15+ champs avec toutes les catégories
- ecritures : J1 reconnaissance ROU+passif, J1 provision remise en état, fin T1 charge financière, T1 paiement loyer, fin AN1 amortissement ROU`;

      const message = await client.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 12000,
        temperature: 0,
        messages: [{ role: "user", content: userPrompt }],
        system: systemPrompt,
      });

      const responseText = message.content
        .filter((block: any) => block.type === "text")
        .map((block: any) => block.text)
        .join("");

      let jsonStr = responseText.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      const data = JSON.parse(jsonStr);
      console.log(`[analyze-bail] Success: ${data.preneur} / ${data.bailleur}`);
      res.json({ success: true, data });

    } catch (error: any) {
      console.error("[analyze-bail] Error:", error?.message || error);
      res.status(500).json({
        success: false,
        error: "Erreur lors de l'analyse du bail : " + (error?.message || "erreur inconnue"),
      });
    }
  });

  return httpServer;
}
