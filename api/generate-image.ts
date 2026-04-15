import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const IMAGE_MODEL = 'gemini-2.5-flash-image';
const FALLBACK_MODEL = 'gemini-2.0-flash';

function extractImageFromResponse(response: any): string {
  if (!response?.candidates?.[0]) throw new Error("API'den boş yanıt döndü.");
  
  const candidate = response.candidates[0];
  const reason = candidate.finishReason;
  
  if (reason === 'SAFETY' || reason === 'IMAGE_SAFETY') {
    throw new Error("Görsel güvenlik filtresine takıldı. Lütfen tarifi sadeleştirin.");
  }
  
  if (!candidate.content?.parts?.length) {
    throw new Error(`Görsel oluşturulamadı. (Durum: ${reason || 'Bilinmiyor'})`);
  }
  
  for (const part of candidate.content.parts) {
    if (part.inlineData?.data) return part.inlineData.data;
  }
  
  throw new Error("Görsel verisi bulunamadı.");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fullPrompt, referenceImageBase64 } = req.body;
    if (!fullPrompt) return res.status(400).json({ error: 'Prompt gereklidir' });

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const parts: any[] = [{ text: fullPrompt }];
    
    if (referenceImageBase64) {
      const base64Data = referenceImageBase64.includes(',')
        ? referenceImageBase64.split(',')[1]
        : referenceImageBase64;
      let mimeType = 'image/jpeg';
      if (referenceImageBase64.startsWith('data:')) {
        const match = referenceImageBase64.match(/data:([^;]+);/);
        if (match) mimeType = match[1];
      }
      parts.unshift({ inlineData: { mimeType, data: base64Data } });
    }

    const tryGenerate = async (model: string) => {
      const response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: {
          imageConfig: { imageSize: "1K", aspectRatio: "1:1" }
        }
      });
      return extractImageFromResponse(response);
    };

    let base64Data: string;
    try {
      base64Data = await tryGenerate(IMAGE_MODEL);
    } catch (err: any) {
      if (err?.message?.includes('permission') || err?.message?.includes('403') || err?.message?.includes('not found')) {
        base64Data = await tryGenerate(FALLBACK_MODEL);
      } else {
        throw err;
      }
    }

    return res.status(200).json({ image: base64Data });
  } catch (error: any) {
    console.error("Image generation error:", error);
    const status = error?.message?.includes('429') ? 429 : 500;
    return res.status(status).json({ error: error?.message || 'Görsel oluşturulamadı' });
  }
}
