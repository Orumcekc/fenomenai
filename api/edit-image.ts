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

  if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'IMAGE_SAFETY') {
    throw new Error("Görsel güvenlik filtresine takıldı.");
  }

  if (!candidate.content?.parts?.length) {
    throw new Error("Görsel oluşturulamadı.");
  }

  for (const part of candidate.content.parts) {
    if (part.inlineData?.data) return part.inlineData.data;
  }

  throw new Error("Görsel verisi bulunamadı.");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { originalImageBase64, newText } = req.body;
    if (!originalImageBase64 || !newText) {
      return res.status(400).json({ error: 'Görsel ve metin gereklidir' });
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const base64Data = originalImageBase64.includes(',')
      ? originalImageBase64.split(',')[1]
      : originalImageBase64;

    const prompt = `Edit this image: Add the following text overlay: "${newText}". The text must be very large, bold, high-contrast, and clearly legible. Keep the background image intact.`;

    let lastError: any = null;

    for (const model of IMAGE_MODELS) {
      try {
        console.log(`Düzenleme deneniyor: ${model}`);
        const response = await ai.models.generateContent({
          model,
          contents: {
            parts: [
              { inlineData: { mimeType: 'image/png', data: base64Data } },
              { text: prompt }
            ]
          },
          config: {
            responseModalities: ["TEXT", "IMAGE"]
          }
        });
        const imageData = extractImageFromResponse(response);
        console.log(`Düzenleme başarılı: ${model}`);
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

    throw lastError || new Error('Görsel düzenlenemedi. Tüm modeller meşgul.');
  } catch (error: any) {
    console.error("Image edit error:", error);
    const msg = error?.message || '';
    if (msg.includes('503') || msg.includes('UNAVAILABLE')) {
      return res.status(503).json({ error: 'AI modelleri yoğun. 30sn bekleyip deneyin.' });
    }
    return res.status(500).json({ error: error?.message || 'Görsel düzenlenemedi' });
  }
}
