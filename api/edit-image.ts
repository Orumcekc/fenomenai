import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const IMAGE_MODEL = 'gemini-2.5-flash-image';

function extractImageFromResponse(response: any): string {
  if (!response?.candidates?.[0]) throw new Error("API'den boş yanıt döndü.");
  const candidate = response.candidates[0];
  if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'IMAGE_SAFETY') {
    throw new Error("Görsel güvenlik filtresine takıldı.");
  }
  if (!candidate.content?.parts?.length) throw new Error("Görsel oluşturulamadı.");
  for (const part of candidate.content.parts) {
    if (part.inlineData?.data) return part.inlineData.data;
  }
  throw new Error("Görsel verisi bulunamadı.");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { originalImageBase64, newText } = req.body;
    if (!originalImageBase64 || !newText) return res.status(400).json({ error: 'Görsel ve metin gereklidir' });

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const base64Data = originalImageBase64.includes(',')
      ? originalImageBase64.split(',')[1]
      : originalImageBase64;

    const prompt = `Görselin üzerine şu metni ekle: "${newText}". Metin çok büyük, kalın, yüksek kontrastlı ve okunabilir olmalıdır.`;

    const response = await ai.models.generateContent({
  model: IMAGE_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64Data } },
          { text: prompt }
        ]
      }
    });

    const imageData = extractImageFromResponse(response);
    return res.status(200).json({ image: imageData });
  } catch (error: any) {
    console.error("Image edit error:", error);
    return res.status(500).json({ error: error?.message || 'Görsel düzenlenemedi' });
  }
}
