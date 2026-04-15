import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const MODEL_NAME = 'gemini-2.5-flash-preview-05-20';
const SYSTEM_INSTRUCTION = "Sen profesyonel bir sosyal medya uzmanısın. Tüm yanıtlarını mükemmel bir Türkçe ile vermelisin.";

function cleanJsonString(text: string): string {
  if (!text) return "{}";
  let clean = text.replace(/```json/g, '').replace(/```/g, '');
  const firstBrace = clean.indexOf('{');
  if (firstBrace === -1) return clean;
  clean = clean.substring(firstBrace);
  const end = clean.lastIndexOf('}');
  if (end !== -1) clean = clean.substring(0, end + 1);
  return clean.trim();
}

function safeJsonParse(text: string, fallback: any) {
  try {
    return JSON.parse(cleanJsonString(text));
  } catch { return fallback; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { bio, niche } = req.body;
    if (!bio || !niche) return res.status(400).json({ error: 'Biyografi ve niş gereklidir' });

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const prompt = `
      Biyografi: "${bio}"
      Niş: ${niche}
      Analiz et ve JSON dön: { score: number, suggestions: string[], rewrittenBios: string[] }
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            rewrittenBios: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    const responseText = response.text || "{}";
    const parsed = safeJsonParse(responseText, {});

    const result = {
      score: typeof parsed.score === 'number' ? parsed.score : 0,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.filter((s: any) => typeof s === 'string') : [],
      rewrittenBios: Array.isArray(parsed.rewrittenBios) ? parsed.rewrittenBios.filter((s: any) => typeof s === 'string') : []
    };

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Bio analysis error:", error);
    return res.status(500).json({ error: error?.message || 'Analiz yapılamadı' });
  }
}
