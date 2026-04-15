import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

const TEXT_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite'
];

const SYSTEM_INSTRUCTION = "Sen profesyonel bir sosyal medya uzmanısın. Tüm yanıtlarını mükemmel bir Türkçe ile vermelisin.";

function cleanJsonString(text: string): string {
  if (!text) return "[]";
  let clean = text.replace(/```json/g, '').replace(/```/g, '');
  const firstBracket = clean.indexOf('[');
  if (firstBracket === -1) {
    const firstBrace = clean.indexOf('{');
    if (firstBrace === -1) return clean;
    clean = clean.substring(firstBrace);
    const end = clean.lastIndexOf('}');
    if (end !== -1) clean = clean.substring(0, end + 1);
    return clean.trim();
  }
  clean = clean.substring(firstBracket);
  const end = clean.lastIndexOf(']');
  if (end !== -1) clean = clean.substring(0, end + 1);
  return clean.trim();
}

function safeJsonParse(text: string, fallback: any) {
  try {
    const cleaned = cleanJsonString(text);
    return JSON.parse(cleaned);
  } catch {
    return fallback;
  }
}

function validateStrategy(data: any) {
  let arr = data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const possibleArray = Object.values(data).find(val => Array.isArray(val));
    if (possibleArray) arr = possibleArray;
    else return [];
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((item: any) => item && typeof item === 'object')
    .map((item: any) => ({
      day: typeof item.day === 'string' ? item.day : "Gün ?",
      focus: typeof item.focus === 'string' ? item.focus : "",
      idea: typeof item.idea === 'string' ? item.idea : ""
    }));
}

async function generateWithFallback(ai: any, config: any): Promise<any> {
  let lastError: any = null;
  for (const model of TEXT_MODELS) {
    try {
      console.log(`Deneniyor: ${model}`);
      const response = await ai.models.generateContent({
        ...config,
        model
      });
      console.log(`Başarılı: ${model}`);
      return response;
    } catch (err: any) {
      lastError = err;
      const msg = err?.message || '';
      if (msg.includes('503') || msg.includes('UNAVAILABLE') ||
          msg.includes('429') || msg.includes('overloaded') ||
          msg.includes('high demand')) {
        console.warn(`${model} yoğun, sonraki deneniyor...`);
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error('Tüm modeller yoğun. Lütfen biraz bekleyin.');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { platform, username, niche, goal, mediaData } = req.body;
    if (!username) return res.status(400).json({ error: 'Kullanıcı adı gereklidir' });

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const nicheInstruction = niche
      ? `Niş: ${niche}`
      : `Niş: Sosyal ve Dini Yorum, Toplumsal Eleştiri, Jeopolitik, Felsefe`;

    const promptText = `
      Platform: ${platform}
      Kullanıcı Adı: @${username}
      ${nicheInstruction}
      Hedef: ${goal}
      
      GÖREV: ${platform} üzerinde "@${username}" kullanıcısı için 7 günlük viral büyüme stratejisi hazırla.
      
      ÖNEMLİ:
      - Google Arama ile "@${username}" kullanıcısının güncel paylaşımlarını analiz et.
      - TEKRARDAN KAÇIN: Her gün farklı konu ve açı.
      - FORMAT ÇEŞİTLİLİĞİ: Tepki videosu, carousel, tweet, soru-cevap gibi farklı formatlar.
      - Her gün en az 3-4 maddelik somut aksiyon içermeli.
      
      KONU HAVUZU:
      - Modern Kölelik, Aile ve Toplum, Teknoloji ve İnsan, Tarih ve Şuur
      - İnanç ve Fıkıh, Küresel Siyaset, Eğitim Sistemi
      
      YALNIZCA JSON DİZİSİ DÖNDÜR:
      [{"day": "1. Gün", "focus": "Odak", "idea": "Detaylı plan"}]
    `;

    const parts: any[] = [{ text: promptText }];
    if (mediaData) {
      parts.unshift({ inlineData: { mimeType: mediaData.mimeType, data: mediaData.data } });
    }

    const response = await generateWithFallback(ai, {
      contents: { role: 'user', parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }]
      }
    });

    const responseText = response.text || "[]";
    const parsed = safeJsonParse(responseText, []);
    const result = validateStrategy(parsed);

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Strategy error:", error);
    const msg = error?.message || '';
    if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand')) {
      return res.status(503).json({
        error: 'AI modelleri yoğun. 30sn bekleyip tekrar deneyin.',
        code: 'ALL_MODELS_BUSY'
      });
    }
    const status = msg.includes('429') ? 429 : 500;
    return res.status(status).json({
      error: error?.message || 'Strateji oluşturulamadı',
      code: status === 429 ? 'RATE_LIMIT' : 'SERVER_ERROR'
    });
  }
}
