import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

const IMAGE_MODELS = [
  'gemini-2.5-flash-image',
  'gemini-2.0-flash'
];

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

    let lastError: any = null;

    for (const model of IMAGE_MODELS) {
      try {
        console.log(`Görsel deneniyor: ${model}`);
        const response = await ai.models.generateContent({
          model,
          contents: { parts },
          config: {
            responseModalities: ["TEXT", "IMAGE"]
          }
        });
        const imageData = extractImageFromResponse(response);
        console.log(`Görsel başarılı: ${model}`);
        return res.status(200).json({ image: imageData });
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || '';
        if (msg.includes('503') || msg.includes('UNAVAILABLE') ||
            msg.includes('429') || msg.includes('high demand') ||
            msg.includes('permission') || msg.includes('403') ||
            msg.includes('not found') || msg.includes('overloaded')) {
          console.warn(`${model} başarısız, sonraki deneniyor...`);
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error('Görsel oluşturulamadı. Tüm modeller meşgul.');
  } catch (error: any) {
    console.error("Image generation error:", error);
    const msg = error?.message || '';
    if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand')) {
      return res.status(503).json({
        error: 'AI görsel modelleri yoğun. 30sn bekleyip deneyin.',
        code: 'ALL_MODELS_BUSY'
      });
    }
    if (msg.includes('SAFETY') || msg.includes('güvenlik')) {
      return res.status(400).json({
        error: msg,
        code: 'SAFETY_FILTER'
      });
    }
    const status = msg.includes('429') ? 429 : 500;
    return res.status(status).json({ error: error?.message || 'Görsel oluşturulamadı' });
  }
}
