import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const MODEL_NAME = 'gemini-2.5-flash';

const SYSTEM_INSTRUCTION = "Sen profesyonel bir sosyal medya uzmanısın. Tüm yanıtlarını mükemmel bir Türkçe ile, imla ve yazım kurallarına (TDK uyumlu) titizlikle uyarak vermelisin. İçeriklerin yaratıcı, ilgi çekici ve viral potansiyeli yüksek olmalı.";

const MUSTAFA_SENC_INSTRUCTION = `
ÖNEMLİ: İçerik üretirken Instagram'daki @mustafasenc profilinin dilini, tarzını ve kurgu yapısını analiz et ve uygula.

KİMLİK VE TARZ ANALİZİ:
- **Kimlik:** Sosyal ve Dini Yorumcu, "Abi" figürü, Değerlerin Savunucusu, Modern Çağ Eleştirmeni, Jeopolitik Analist.
- **Konular:** 
    1. Milli ve Dini Değerler: Batı eleştirisi, Şeriat/Başörtüsü savunusu, "Modern" yobazlık.
    2. Dijital Kölelik (Teknofeodalizm): Sosyal medyanın bizi nasıl yönettiği, algoritmaların kölesi olmak.
    3. Maneviyat ve Felsefe: "Emanet" bilinci, dünya hayatının geçiciliği, "Faniyi bakiye çevirmek".
    4. Jeopolitik ve Küresel Oyunlar: İran, Venezuela, İsrail, ABD eksenli analizler.
    5. Popüler Kültür Eleştirisi: Futbol fanatizmi, dizilerdeki ahlaksızlık operasyonları.
- **Ton:** 
    - Meydan Okuyan: "Artık yemiyoruz", "Hadi oradan" tavrı.
    - Analitik ve Tespitçi: Toplumsal olaylara sosyolojik teşhisler koyan.
    - Hikaye Anlatıcı: Kıssadan hisse tarzı hikayelerle derin hakikatleri anlatan.
    - İfşa Edici: Magazin veya spor gündeminin arkasındaki asıl niyeti ortaya çıkaran.
- **Kurgu Yapısı:**
  1. Sorgulama / Hikaye Girişi (Hook)
  2. Teşhis / Gelişme (Body)
  3. Hakikat / Çözüm (Ruling)
  4. Kapanış: Dua veya net bir hüküm cümlesi

ASLA "Merhaba arkadaşlar" deme.
ASLA sadece "teknoloji kötüdür" sığlığında kalma; "irade", "kölelik", "emanet", "küresel oyunlar" gibi derin kavramlarla eleştir.
`;

function cleanJsonString(text: string): string {
  if (!text) return "{}";
  let clean = text.replace(/```json/g, '').replace(/```/g, '');
  const firstBrace = clean.indexOf('{');
  const firstBracket = clean.indexOf('[');
  let start = 0;
  let isArray = false;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
  } else if (firstBracket !== -1) {
    start = firstBracket;
    isArray = true;
  } else return clean;
  clean = clean.substring(start);
  const end = isArray ? clean.lastIndexOf(']') : clean.lastIndexOf('}');
  if (end !== -1) clean = clean.substring(0, end + 1);
  return clean.trim();
}

function safeJsonParse(text: string, fallback: any) {
  try {
    const cleaned = cleanJsonString(text);
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== 'object') return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { topic, platform, tone, keywords, mediaData } = req.body;
    if (!topic) return res.status(400).json({ error: 'Konu gereklidir' });

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const isVideo = platform === 'TikTok' || platform === 'YouTube Shorts';
    const lengthInstruction = isVideo
      ? "Bu bir video senaryosu olacağı için yaklaşık 1-1.5 dakikalık konuşma süresine sahip, detaylı bir metin hazırla."
      : "Detaylı, bilgilendirici ve etkileyici bir metin hazırla. Konuyu derinlemesine işle.";

    const promptText = `
      Platform: ${platform}
      Konu: ${topic}
      Ton: ${tone}
      ${keywords ? `Anahtar Kelimeler: "${keywords}"` : ''}
      
      ${MUSTAFA_SENC_INSTRUCTION}
      ${lengthInstruction}
      
      YALNIZCA AŞAĞIDAKİ JSON OBJESİ DÖNDÜR:
      {
        "content": "Ana metin veya video senaryosu.",
        "hashtags": ["#hashtag1", "#hashtag2"],
        "hooks": ["Kanca 1", "Kanca 2", "Kanca 3"]
      }
    `;

    const parts: any[] = [{ text: promptText }];
    if (mediaData) {
      parts.unshift({ inlineData: { mimeType: mediaData.mimeType, data: mediaData.data } });
    }

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { role: 'user', parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }]
      }
    });

    const responseText = response.text || "{}";
    const parsed = safeJsonParse(responseText, {});

    const result = {
      content: typeof parsed.content === 'string' ? parsed.content : "",
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.filter((s: any) => typeof s === 'string') : [],
      hooks: Array.isArray(parsed.hooks) ? parsed.hooks.filter((s: any) => typeof s === 'string') : []
    };

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Content generation error:", error);
    const status = error?.message?.includes('429') ? 429 : 500;
    return res.status(status).json({ 
      error: error?.message || 'İçerik oluşturulurken hata oluştu',
      code: status === 429 ? 'RATE_LIMIT' : 'SERVER_ERROR'
    });
  }
}
