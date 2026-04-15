import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

const TEXT_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite'
];

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
  } catch {
    return fallback;
  }
}

function validateSlides(data: any) {
  if (!Array.isArray(data)) return [];
  return data
    .filter((item: any) => item && typeof item === 'object')
    .map((item: any, index: number) => ({
      slideNumber: typeof item.slideNumber === 'number' ? item.slideNumber : index + 1,
      text: typeof item.text === 'string' && item.text ? item.text : "Metin oluşturulamadı.",
      imagePrompt: typeof item.imagePrompt === 'string' && item.imagePrompt ? item.imagePrompt : "Görsel tarifi yok.",
      designNote: typeof item.designNote === 'string' && item.designNote ? item.designNote : ""
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
    const { sourceText } = req.body;
    if (!sourceText) return res.status(400).json({ error: 'İçerik metni gereklidir' });

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const prompt = `
      Aşağıdaki konuya dayalı bir Instagram Carousel Planı oluştur:
      Konu: "${sourceText}"
      
      KİMLİK: Sosyal ve Dini Yorumcu, "Abi" figürü, sert ve sorgulayıcı üslup.
      
      YAPI:
      1. Slayt (Hook): Sert ve merak uyandıran giriş
      2. Slayt (Conflict): Rahatsız edici durum tespiti
      3-6. Slaytlar (Climax): Analiz ve ifşa
      Son Slayt (Resolution): Net hüküm ve düşündürücü soru
      
      En az 5, en fazla 8 slayt.
      
      Her slayt için:
      - slideNumber: Slayt numarası
      - text: Slaytta yazacak metin
      - imagePrompt: İngilizce görsel tarifi
      - designNote: Tasarım notu
      
      JSON objesi olarak yanıtla.
    `;

    const response = await generateWithFallback(ai, {
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            visualStyle: { type: Type.STRING },
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  slideNumber: { type: Type.NUMBER },
                  text: { type: Type.STRING },
                  imagePrompt: { type: Type.STRING },
                  designNote: { type: Type.STRING }
                },
                required: ["slideNumber", "text", "imagePrompt", "designNote"]
              }
            }
          },
          required: ["visualStyle", "slides"]
        }
      }
    });

    const responseText = response.text || "{}";
    const parsed = safeJsonParse(responseText, {});

    const result = {
      visualStyle: typeof parsed.visualStyle === 'string' ? parsed.visualStyle : "Cinematic 8K render",
      slides: validateSlides(parsed.slides)
    };

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Carousel plan error:", error);
    const msg = error?.message || '';
    if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand')) {
      return res.status(503).json({
        error: 'AI modelleri yoğun. 30sn bekleyip deneyin.',
        code: 'ALL_MODELS_BUSY'
      });
    }
    return res.status(500).json({ error: error?.message || 'Carousel planı oluşturulamadı' });
  }
}
