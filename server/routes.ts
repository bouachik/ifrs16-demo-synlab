import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

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

      // Extract text from PDF using pdftotext system utility
      const tmpPath = join(tmpdir(), `bail_${Date.now()}.pdf`);
      let pdfText: string;
      try {
        writeFileSync(tmpPath, req.file.buffer);
        pdfText = execSync(`pdftotext "${tmpPath}" -`, { maxBuffer: 10 * 1024 * 1024 }).toString();
        unlinkSync(tmpPath);
      } catch (e) {
        try { unlinkSync(tmpPath); } catch(_) {}
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

      const systemPrompt = `Tu es un expert comptable spécialisé en IFRS 16 — Contrats de location. Tu analyses des baux commerciaux français et tu extrais toutes les données nécessaires au traitement IFRS 16.

Tu dois retourner un JSON structuré avec TOUTES les données extraites et calculées. Sois précis et exhaustif.

Pour les calculs IFRS 16 :
- Le passif locatif initial = valeur actualisée des paiements de loyer futurs (en trimestriel)
- L'actif ROU = passif locatif + provision remise en état + coûts directs initiaux - avantages incitatifs
- Taux trimestriel = (1 + taux_annuel/100)^(1/4) - 1, exprimé en pourcentage
- Le taux d'emprunt marginal par défaut si non spécifié : 2,50% annuel
- Pour un bail 3/6/9 français : analyse la durée la plus probable selon B37

Si certaines données ne sont pas dans le document, fais des estimations raisonnables basées sur le marché et indique un score de confiance plus bas.`;

      const userPrompt = `Voici le texte extrait d'un bail commercial. Analyse-le et extrais toutes les données pour le traitement IFRS 16.

TEXTE DU BAIL :
---
${pdfText.substring(0, 30000)}
---

Retourne UNIQUEMENT un JSON valide (sans markdown, sans backticks, sans commentaires) avec cette structure exacte :
{
  "preneur": "nom du preneur/locataire",
  "bailleur": "nom du bailleur/propriétaire",
  "adresse": "adresse complète du bien loué",
  "typeBail": "type de bail (ex: Bail commercial 3/6/9)",
  "dateEffet": "date de prise d'effet en texte",
  "dureeContractuelle": "durée contractuelle en texte (ex: 9 ans)",
  "dureeIFRS16Mois": 108,
  "loyerAnnuelHT": 0,
  "loyerTrimestriel": 0,
  "franchiseTrimestres": 0,
  "indexation": "type d'indexation (ex: ILAT, ILC, ICC)",
  "depotGarantie": 0,
  "provisionRemiseEnEtat": 0,
  "tauxAnnuel": 2.50,
  "tauxTrimestriel": 0.62,
  "passifLocatifInitial": 0,
  "actifROUInitial": 0,
  "chargeFinanciereTotal": 0,
  "classificationConfiance": 95,
  "alertes": [
    {"type": "warning", "titre": "titre court", "description": "description détaillée en français", "reference": "IFRS 16.XX"}
  ],
  "champsExtraits": [
    {"label": "nom du champ", "valeur": "valeur extraite", "confiance": 95, "source": "p.X ou estimation", "categorie": "Parties|Bien loué|Durée|Loyer|Indexation|Garanties"}
  ],
  "decisions": [
    {"id": "identifiant_unique", "titre": "titre de la décision", "description": "contexte en français", "options": [{"label": "option texte", "recommande": false}, {"label": "option recommandée", "recommande": true}], "recommandationJustification": "justification en français"}
  ],
  "ecritures": [
    {"date": "DD/MM/YYYY", "journal": "OD", "libelle": "libellé en français", "debit": {"compte": "XXXX", "libelle": "libellé compte", "montant": 0}, "credit": {"compte": "XXXX", "libelle": "libellé compte", "montant": 0}}
  ]
}

RÈGLES IMPORTANTES :
- dureeIFRS16Mois doit être en MOIS (ex: 9 ans = 108 mois, 6 ans = 72 mois)
- loyerTrimestriel = loyerAnnuelHT / 4
- tauxTrimestriel = ((1 + tauxAnnuel/100)^0.25 - 1) * 100
- Calcule le passifLocatifInitial comme la somme des valeurs actualisées des loyers trimestriels futurs sur la durée retenue
- actifROUInitial = passifLocatifInitial + provisionRemiseEnEtat
- Les alertes doivent couvrir au minimum : durée retenue, composantes, franchise, provision, taux
- Les decisions doivent couvrir : durée retenue, séparation composantes, provision, taux
- Les champsExtraits doivent avoir 15+ champs couvrant toutes les catégories
- Les ecritures : reconnaissance initiale ROU+passif, provision, première dotation, première charge financière, premier paiement`;

      const message = await client.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 8000,
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
