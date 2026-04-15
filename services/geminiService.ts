import { GoogleGenAI, Type, GenerateContentResponse, ThinkingLevel } from "@google/genai";
import { Platform, ContentTone, GeneratedContent, StrategyPlan, BioAnalysis, CarouselPlanResponse, AspectRatio, CarouselSlide } from '../types';

const apiKey = process.env.API_KEY;

const MODEL_NAME = 'gemini-3.1-pro-preview';
const IMAGE_MODEL_NAME = 'gemini-3-pro-image-preview';
const FALLBACK_IMAGE_MODEL = 'gemini-2.5-flash-image';

const SYSTEM_INSTRUCTION = "Sen profesyonel bir sosyal medya uzmanısın. Tüm yanıtlarını mükemmel bir Türkçe ile, imla ve yazım kurallarına (TDK uyumlu) titizlikle uyarak vermelisin. İçeriklerin yaratıcı, ilgi çekici ve viral potansiyeli yüksek olmalı.";

// Helper to get a fresh AI instance with the current API key
const getAI = () => {
  const key = process.env.API_KEY;
  return new GoogleGenAI({ apiKey: key || 'dummy_key' });
};

// --- TIMEOUT HELPER ---
const withTimeout = <T>(promise: Promise<T>, ms: number = 150000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`İstek zaman aşımına uğradı (${ms/1000}sn). Lütfen tekrar deneyin.`)), ms)
    )
  ]);
};

// --- DATA VALIDATION HELPERS ---

const validateSlides = (data: any): CarouselSlide[] => {
  if (!Array.isArray(data)) return [];
  // Filter out nulls and ensure every slide matches the interface exactly
  return data
    .filter(item => item && typeof item === 'object')
    .map((item, index) => {
      // Create a clean object with no undefined values to prevent render crashes
      return {
        slideNumber: typeof item.slideNumber === 'number' ? item.slideNumber : index + 1,
        text: (typeof item.text === 'string' && item.text) ? item.text : "Metin oluşturulamadı.",
        imagePrompt: (typeof item.imagePrompt === 'string' && item.imagePrompt) ? item.imagePrompt : "Görsel tarifi yok.",
        designNote: (typeof item.designNote === 'string' && item.designNote) ? item.designNote : "",
        generatedImageBase64: (typeof item.generatedImageBase64 === 'string' && item.generatedImageBase64) ? item.generatedImageBase64 : undefined
      };
    });
};

const validateStrategy = (data: any): StrategyPlan[] => {
  let arr = data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    // If it's an object, look for a property that is an array
    const possibleArray = Object.values(data).find(val => Array.isArray(val));
    if (possibleArray) {
      arr = possibleArray;
    } else {
      return [];
    }
  }
  
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      day: typeof item.day === 'string' ? item.day : "Gün ?",
      focus: typeof item.focus === 'string' ? item.focus : "",
      idea: typeof item.idea === 'string' ? item.idea : ""
    }));
};

const validateBio = (data: any): BioAnalysis => {
  if (!data || typeof data !== 'object') return { score: 0, suggestions: [], rewrittenBios: [] };
  return {
    score: typeof data.score === 'number' ? data.score : 0,
    suggestions: Array.isArray(data.suggestions) ? data.suggestions.filter((s:any) => typeof s === 'string') : [],
    rewrittenBios: Array.isArray(data.rewrittenBios) ? data.rewrittenBios.filter((s:any) => typeof s === 'string') : []
  };
};

const validateContent = (data: any): GeneratedContent => {
  if (!data || typeof data !== 'object') return { content: "", hashtags: [], hooks: [] };
  return {
    content: typeof data.content === 'string' ? data.content : "",
    hashtags: Array.isArray(data.hashtags) ? data.hashtags.filter((s:any) => typeof s === 'string') : [],
    hooks: Array.isArray(data.hooks) ? data.hooks.filter((s:any) => typeof s === 'string') : []
  };
};

// Helper to clean JSON string from Markdown code blocks
const cleanJsonString = (text: string): string => {
  if (!text) return "{}";
  // Remove markdown code blocks
  let clean = text.replace(/```json/g, '').replace(/```/g, '');
  
  // Find the first valid JSON character
  const firstBrace = clean.indexOf('{');
  const firstBracket = clean.indexOf('[');
  
  let start = 0;
  let isArray = false;
  // Determine if it starts with { or [
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    isArray = false;
  } else if (firstBracket !== -1) {
    start = firstBracket;
    isArray = true;
  } else {
    // If no brace/bracket found, return as is (likely fail, but safeJsonParse handles it)
    return clean;
  }
  
  clean = clean.substring(start);
  
  // Find the last valid JSON character matching the start
  const end = isArray ? clean.lastIndexOf(']') : clean.lastIndexOf('}');
  
  if (end !== -1) {
      clean = clean.substring(0, end + 1);
  }
  
  return clean.trim();
};

// Safe JSON Parser helper
const safeJsonParse = (text: string, fallback: any) => {
  try {
    console.log("Raw response text to parse:", text);
    const cleaned = cleanJsonString(text);
    console.log("Cleaned JSON string:", cleaned);
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== 'object') return fallback;
    return parsed;
  } catch (e) {
    console.warn("JSON Parse Failed, using fallback. Text:", text);
    return fallback;
  }
};

// Helper to extract image from mixed content response
const extractImageFromResponse = (response: any): string => {
  if (!response || !response.candidates || response.candidates.length === 0) {
    throw new Error("API'den boş yanıt döndü.");
  }

  const candidate = response.candidates[0];

  // Explicit Safety Check
  // Note: API sometimes returns 'IMAGE_SAFETY' specifically for image models
  const reason = candidate.finishReason;
  if (reason === 'SAFETY' || reason === 'BLOCKLIST' || reason === 'IMAGE_SAFETY') {
    throw new Error("Görsel güvenlik filtresine takıldı. Lütfen görsel tarifini veya metnini sadeleştirin.");
  }

  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    throw new Error(`Görsel oluşturulamadı. (Durum: ${reason || 'Bilinmiyor'})`);
  }

  for (const part of candidate.content.parts) {
    if (part.inlineData && part.inlineData.data) {
      return part.inlineData.data;
    }
  }

  const textPart = candidate.content.parts.find((p: any) => p.text);
  if (textPart) {
    const msg = textPart.text.length > 100 ? textPart.text.substring(0, 100) + "..." : textPart.text;
    throw new Error(`Model görsel yerine metin üretti: "${msg}"`);
  }

  throw new Error("Görsel verisi bulunamadı.");
};

export const generatePostContent = async (
  topic: string,
  platform: Platform,
  tone: ContentTone,
  keywords?: string,
  mediaData?: { data: string, mimeType: string }
): Promise<GeneratedContent> => {
  if (!apiKey) throw new Error("API Key eksik");

  const isVideo = platform === Platform.TikTok || platform === Platform.YouTube;
  const lengthInstruction = isVideo 
    ? "Bu bir video senaryosu olacağı için yaklaşık 1-1.5 dakikalık konuşma süresine sahip (en az 200-250 kelime), detaylı bir metin hazırla. Giriş, gelişme ve güçlü bir çağrı (CTA) içermeli."
    : "Detaylı, bilgilendirici ve etkileyici bir metin hazırla. Kısa tutma, konuyu derinlemesine işle.";

  const mustafaSencInstruction = `
    ÖNEMLİ: İçerik üretirken Instagram'daki @mustafasenc profilinin dilini, tarzını ve kurgu yapısını analiz et ve uygula.
    
    KİMLİK VE TARZ ANALİZİ (GÜNCELLENMİŞ VİDEO REFERANSLARI - GENİŞLETİLMİŞ):
    - **Kimlik:** Sosyal ve Dini Yorumcu, "Abi" figürü, Değerlerin Savunucusu, Modern Çağ Eleştirmeni, Jeopolitik Analist.
    - **Konular:** 
        1. **Milli ve Dini Değerler:** Batı eleştirisi, Şeriat/Başörtüsü savunusu, "Modern" yobazlık.
        2. **Dijital Kölelik (Teknofeodalizm):** Sosyal medyanın bizi nasıl yönettiği, algoritmaların kölesi olmak, "özgürlük" sanrısı.
        3. **Maneviyat ve Felsefe:** "Emanet" bilinci, dünya hayatının geçiciliği, "Faniyi bakiye çevirmek".
        4. **Jeopolitik ve Küresel Oyunlar:** İran, Venezuela, İsrail, ABD eksenli analizler. "Büyük resmi görme" vurgusu.
        5. **Popüler Kültür Eleştirisi:** Futbol fanatizmi, dizilerdeki ahlaksızlık operasyonları, ünlülerin ikiyüzlülüğü.
    - **Ton:** 
        - **Meydan Okuyan:** "Artık yemiyoruz", "Hadi oradan" tavrı.
        - **Analitik ve Tespitçi:** Toplumsal olaylara sosyolojik teşhisler koyan (Örn: "Bu teknofeodalizmdir", "Bu uyuşturucudur").
        - **Hikaye Anlatıcı (Storyteller):** Kıssadan hisse tarzı hikayelerle (Örn: "Bir adam düşünün...") derin hakikatleri anlatan.
        - **İfşa Edici:** Magazin veya spor gündeminin arkasındaki asıl niyeti (algı operasyonu, uyuşturma) ortaya çıkaran.
    - **Görsel/İşitsel Tarz:** 
        - **Araba İçi:** Güncel, sert ve reaktif konular için.
        - **Kütüphane/Ev:** Derin, felsefi, hikaye odaklı ve analiz videoları için.
    - **Kurgu Yapısı:**
      1. **Sorgulama / Hikaye Girişi (Hook):** "Yeni bir kelimemiz var...", "Bir adam düşünün...", "İran konusu..." veya "Klişe olacak belki ama..."
      2. **Teşhis / Gelişme (Body):** Sorunu derinlemesine analiz et veya hikayeyi derinleştir. (Örn: "Zincir görünmüyor diye özgür sanıyoruz.", "Maksat masada başlamış olan...")
      3. **Hakikat / Çözüm (Ruling):** Dini veya ahlaki gerçeği vurucu şekilde söyle. (Örn: "Faniyi bakiye çevir.", "Asıl sahibi O'dur.", "Uyuşturucuya dönüşmesi.")
      4. **Kapanış:** Dua ("Rabbim hidayet versin") veya net bir hüküm cümlesi ("Velhasıl kelam...").

    ASLA "Merhaba arkadaşlar" deme.
    ASLA sadece "teknoloji kötüdür" sığlığında kalma; "irade", "kölelik", "emanet", "küresel oyunlar" gibi derin kavramlarla eleştir.
    Hem sert bir eleştirmen, hem bilge bir hikaye anlatıcısı, hem de uyanık bir stratejist ol.

    Eğer konu hakkında yeterli bilgiye sahip değilsen veya güncel verilere ihtiyacın varsa, Google Search aracını kullanarak @mustafasenc'in son paylaşımlarını ve konuyla ilgili en güncel trendleri araştır.
  `;

  const promptText = `
    Platform: ${platform}
    Konu: ${topic}
    Ton: ${tone}
    ${keywords ? `Anahtar Kelimeler: "${keywords}"` : ''}
    
    ${mustafaSencInstruction}
    
    ${lengthInstruction}
    
    Arama sonuçlarını kullanarak içeriği oluşturduktan sonra, YALNIZCA AŞAĞIDAKİ GİBİ BİR JSON OBJESİ DÖNDÜR. BAŞKA HİÇBİR METİN VEYA AÇIKLAMA EKLEME:
    {
      "content": "Genişletilmiş ve detaylı ana metin veya video senaryosu.",
      "hashtags": ["#hashtag1", "#hashtag2"],
      "hooks": ["Kanca 1", "Kanca 2", "Kanca 3"]
    }
  `;

  const parts: any[] = [{ text: promptText }];
  if (mediaData) {
    parts.unshift({ inlineData: { mimeType: mediaData.mimeType, data: mediaData.data } });
  }

  try {
    const response = await withTimeout(getAI().models.generateContent({
      model: MODEL_NAME,
      contents: { role: 'user', parts: parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }]
      }
    })) as GenerateContentResponse;

    let responseText = "{}";
    try {
      responseText = response.text || "{}";
    } catch (textError: any) {
      console.warn("Error getting response text:", textError);
      const finishReason = response.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== 'STOP') {
        throw new Error(`İçerik güvenlik filtresine takıldı veya reddedildi. (Sebep: ${finishReason})`);
      }
      throw textError;
    }

    const parsed = safeJsonParse(responseText, {});
    return validateContent(parsed);
  } catch (error) {
    console.error("Content generation error:", error);
    return { content: "Bir hata oluştu.", hashtags: [], hooks: [] };
  }
};

export const generateGrowthStrategy = async (
  platform: string,
  username: string,
  niche: string,
  goal: string,
  mediaData?: { data: string, mimeType: string }
): Promise<StrategyPlan[]> => {
  const nicheInstruction = niche 
    ? `Niş: ${niche}` 
    : `Niş: Sosyal ve Dini Yorum, Toplumsal Eleştiri, Jeopolitik, Felsefe`;

  const promptText = `
    Platform: ${platform}
    Kullanıcı Adı: @${username}
    ${nicheInstruction}
    Hedef: ${goal}
    
    GÖREV: ${platform} üzerinde "@${username}" kullanıcısı (Mustafa Şen) için 7 günlük, ÇEŞİTLİLİK İÇEREN ve GÜNCEL viral büyüme stratejisi hazırla.
    
    ÖNEMLİ TALİMAT:
    Lütfen Google Arama aracını kullanarak "@${username}" kullanıcısının güncel paylaşımlarını, etkileşimlerini ve mevcut profilini analiz et. Bu analize dayanarak tamamen kişiselleştirilmiş, trend odaklı ve uygulanabilir bir büyüme stratejisi sun.
    
    ÖNEMLİ UYARI:
    - **TEKRARDAN KAÇIN:** Sürekli aynı konuları önerme. Her gün farklı bir konuya ve açıya değin.
    - **FORMAT ÇEŞİTLİLİĞİ:** Sadece konuşma videosu değil; tepki videosu, carousel, tweet atma, soru-cevap gibi farklı formatlar öner.
    
    KİMLİK VE TARZ ANALİZİ (Mustafa Şen Personası):
    - **Kimlik:** Sosyal ve Dini Yorumcu, "Abi" figürü, Değerlerin Savunucusu, Modern Çağ Eleştirmeni.
    - **Ton:** Meydan okuyan, analitik, hikaye anlatıcı, öğretici.
    
    İLHAM VERİCİ KONU HAVUZU (Sadece bunlarla sınırlı kalma, bunları genişlet):
    - Modern Kölelik (Plaza hayatı, kredi kartı borçları, tatil anlayışı)
    - Aile ve Toplum (Boşanma oranları, çocuk eğitimi, komşuluk)
    - Teknoloji ve İnsan (Yapay zeka tehdidi, ekran bağımlılığı, dijital demans)
    - Tarih ve Şuur (Yakın tarih yalanları, unutulan kahramanlar, mimari yozlaşma)
    - İnanç ve Fıkıh (Namaz bilinci, helal kazanç, kul hakkı, modern hurafeler)
    - Küresel Siyaset (Siyonizm, Gazze, Doğu Türkistan, Batı'nın çöküşü)
    - Eğitim Sistemi (Diploma enflasyonu, vasıfsızlık, meslek liseleri)
    
    Her günün planı en az 3-4 maddelik somut aksiyon içermeli ve doğrudan "@${username}" profiline özel olmalıdır.
    
    Arama sonuçlarını kullanarak planı oluşturduktan sonra, YALNIZCA AŞAĞIDAKİ GİBİ BİR JSON DİZİSİ DÖNDÜR. BAŞKA HİÇBİR METİN VEYA AÇIKLAMA EKLEME:
    [
      {
        "day": "1. Gün",
        "focus": "Odak Konusu",
        "idea": "İçerik fikri ve aksiyon planı"
      }
    ]
  `;

  const parts: any[] = [{ text: promptText }];
  if (mediaData) {
    parts.unshift({ inlineData: { mimeType: mediaData.mimeType, data: mediaData.data } });
  }

  try {
    const response = await withTimeout(getAI().models.generateContent({
      model: MODEL_NAME,
      contents: { role: 'user', parts: parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }]
      }
    })) as GenerateContentResponse;

    let responseText = "[]";
    try {
      responseText = response.text || "[]";
    } catch (textError: any) {
      console.warn("Error getting response text:", textError);
      const finishReason = response.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== 'STOP') {
        throw new Error(`İçerik güvenlik filtresine takıldı veya reddedildi. (Sebep: ${finishReason})`);
      }
      throw textError;
    }

    const parsed = safeJsonParse(responseText, []);
    return validateStrategy(parsed);
  } catch (error) {
    console.error("Strategy error:", error);
    throw error;
  }
};

export const analyzeBio = async (bio: string, niche: string): Promise<BioAnalysis> => {
  const prompt = `
    Biyografi: "${bio}"
    Niş: ${niche}
    
    Analiz et ve JSON dön: { score: number, suggestions: string[], rewrittenBios: string[] }
  `;

  try {
    const response = await withTimeout(getAI().models.generateContent({
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
    })) as GenerateContentResponse;

    let responseText = "{}";
    try {
      responseText = response.text || "{}";
    } catch (textError: any) {
      console.warn("Error getting response text:", textError);
      const finishReason = response.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== 'STOP') {
        throw new Error(`İçerik güvenlik filtresine takıldı veya reddedildi. (Sebep: ${finishReason})`);
      }
      throw textError;
    }

    const parsed = safeJsonParse(responseText, {});
    return validateBio(parsed);
  } catch (error) {
    console.error("Bio analysis error:", error);
    return { score: 0, suggestions: [], rewrittenBios: [] };
  }
};

export const createCarouselPlan = async (sourceText: string): Promise<CarouselPlanResponse> => {
  const prompt = `
    Aşağıdaki konuya/metne dayalı, @mustafasenc profiline özel bir Instagram Carousel Planı oluştur:
    Konu: "${sourceText}"
    
    KİMLİK VE TARZ ANALİZİ (GÜNCELLENMİŞ VİDEO REFERANSLARI - GENİŞLETİLMİŞ):
    - **Kimlik:** Sosyal ve Dini Yorumcu, "Abi" figürü, Değerlerin Savunucusu, Modern Çağ Eleştirmeni, Jeopolitik Analist, Tarih ve Hafıza Bekçisi, Dini Otorite.
    - **Niş:** Toplum, Aile, Din, Milli Değerler, Dijital Kölelik, Jeopolitik, Popüler Kültür, Yakın Tarih, Eğitim Sistemi Eleştirisi, Fıkıh ve İbadet.
    - **Ton:** 
        - Meydan okuyan ve sert ("Mış mış muş muş", "Hadi oradan", "Kimse yemiyor artık").
        - Metaforik ve çarpıcı ("Yalakanın iyisi...", "Mercimek çorbası...").
        - Hikaye anlatıcı ("Sabah serviste oturmuş...", "Geçen seküler bir arkadaşla...").
        - Öğretici ve uyarıcı (Dini/fıkhi konularda net hükümler veren).
    
    GÖREV: Bu konuyu, Mustafa Şen'in sert, sorgulayıcı ve derinlikli üslubuyla anlatan, akıcı bir hikaye kurgusu (narrative arc) oluştur.
    Slaytlar birbirinden kopuk maddeler olmamalı, birbiriyle bağlantılı ve giderek yükselen bir tansiyona sahip olmalıdır.
    
    YAPI:
    1. Slayt (Kanca - Hook): "Bize yıllarca yalan söylendi...", "Gelelim şu meseleye...", "Dikkat edilmesi gereken..." gibi sert ve merak uyandıran bir giriş. Asla "Merhaba" deme.
    2. Slayt (Yüzleştirme - Conflict): Okuyucuyu rahatsız edecek bir durum tespiti veya çelişkiyi yüzüne vurma. (Örn: "Beden kutsandı, ruh ihmal edildi.", "Katil de çocuktu demek mazeret değil.")
    3-6. Slaytlar (Analiz ve İfşa - Climax): Konunun arkasındaki asıl niyeti (Siyonizm, Emperyalizm, Nefs, Algı Yönetimi, Modern Kölelik vb.) ifşa et. Tarihsel veya dini referanslar kullan.
    Son Slayt (Hüküm ve Çağrı - Resolution): "Ezcümle...", "Aklınıza yazın." diyerek net bir hüküm ver ve düşündürücü bir soruyla bitir.
    
    GÖRSEL STİL:
    - Ana karakter (Mustafa Şen): Sakallı, ciddi, karizmatik, "Abi" figürü.
    - Ortam: Genellikle loş ışıklı, kitaplarla dolu bir kütüphane, ciddi bir çalışma odası veya araba içi atmosferi.
    - Renkler: Sinematik, hafif karanlık, ciddiyet vurgulayan tonlar.
    
    En az 5, en fazla 8 slayt oluştur.
    Yanıtı SADECE geçerli bir JSON objesi olarak ver. Markdown veya ek metin kullanma.
  `;

  try {
    const response = await withTimeout(getAI().models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            visualStyle: { 
              type: Type.STRING, 
              description: "Tüm slaytlarda kullanılacak ana karakter ve ortamın detaylı görsel tarifi." 
            },
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  slideNumber: { type: Type.NUMBER },
                  text: { type: Type.STRING, description: "Slayt üzerinde görünecek, hikayeyi anlatan kısa ve vurucu metin." },
                  imagePrompt: { type: Type.STRING, description: "Slaytın görsel aksiyonu veya sahne detayı." },
                  designNote: { type: Type.STRING, description: "Tasarım veya kompozisyon notu." }
                },
                required: ["slideNumber", "text", "imagePrompt", "designNote"]
              }
            }
          },
          required: ["visualStyle", "slides"]
        }
      }
    })) as GenerateContentResponse;

    let responseText = "{}";
    try {
      responseText = response.text || "{}";
    } catch (textError: any) {
      console.warn("Error getting response text:", textError);
      const finishReason = response.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== 'STOP') {
        throw new Error(`İçerik güvenlik filtresine takıldı veya reddedildi. (Sebep: ${finishReason})`);
      }
      throw textError;
    }

    const parsed = safeJsonParse(responseText, {});
    return {
      visualStyle: typeof parsed.visualStyle === 'string' ? parsed.visualStyle : "Cinematic 8K render, Nano Banana Style",
      slides: validateSlides(parsed.slides)
    };
  } catch (error) {
    console.error("Carousel plan error:", error);
    throw error;
  }
};

export const generateCarouselImage = async (fullPrompt: string, referenceImageBase64?: string): Promise<string> => {
  const tryGenerate = async (model: string) => {
    let parts: any[] = [{ text: fullPrompt }];
    
    if (referenceImageBase64) {
      // Extract base64 data without data URL prefix if present
      const base64Data = referenceImageBase64.includes(',') 
        ? referenceImageBase64.split(',')[1] 
        : referenceImageBase64;
        
      // Determine mime type from data URL if present, otherwise default to jpeg
      let mimeType = 'image/jpeg';
      if (referenceImageBase64.startsWith('data:')) {
        const match = referenceImageBase64.match(/data:([^;]+);/);
        if (match) mimeType = match[1];
      }
        
      parts.unshift({
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      });
    }

    const isAdvancedModel = model === 'gemini-3.1-flash-image-preview' || model === 'gemini-3-pro-image-preview';
    
    const requestConfig: any = {};
    if (isAdvancedModel) {
      requestConfig.imageConfig = {
        imageSize: "1K",
        aspectRatio: "1:1"
      };
    }

    const response = await withTimeout(getAI().models.generateContent({
      model: model,
      contents: { parts },
      config: Object.keys(requestConfig).length > 0 ? requestConfig : undefined
    }));
    return extractImageFromResponse(response);
  };

  try {
    // If reference image is provided, it's safer to use gemini-2.5-flash-image as it's explicitly documented for editing
    const targetModel = referenceImageBase64 ? FALLBACK_IMAGE_MODEL : IMAGE_MODEL_NAME;
    return await tryGenerate(targetModel);
  } catch (error: any) {
    console.error("Image generation error:", error);
    const errorStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
    const errorMsg = error?.message || errorStr || "";
    const isPermissionError = errorMsg.includes("permission") || errorMsg.includes("403") || errorMsg.includes("not found");
    
    if (isPermissionError) {
      console.warn("Pro model yetki hatası, standart modele dönülüyor...");
      try {
        return await tryGenerate(FALLBACK_IMAGE_MODEL);
      } catch (fallbackError: any) {
        throw fallbackError;
      }
    }
    
    throw error;
  }
};

export const editCarouselImage = async (originalImageBase64: string, newText: string): Promise<string> => {
  const prompt = `Görselin üzerine şu metni ekle: "${newText}". Metin çok büyük, kalın (bold), yüksek kontrastlı ve kolayca okunabilir olmalıdır. Metnin arkasına gerekirse hafif bir gölge veya yarı saydam bir kutu ekleyerek görünürlüğü maksimize et. Stil aynı kalsın.`;

  try {
    const base64Data = originalImageBase64.includes(',') 
      ? originalImageBase64.split(',')[1] 
      : originalImageBase64;

    const response = await withTimeout(getAI().models.generateContent({
      model: FALLBACK_IMAGE_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64Data } },
          { text: prompt }
        ]
      }
    }));

    return extractImageFromResponse(response);
  } catch (error) {
    console.error("Image edit error:", error);
    throw error;
  }
};

export const generateCustomImage = async (userPrompt: string, aspectRatio: AspectRatio): Promise<string> => {
  let arStr = "1:1";
  if (aspectRatio === AspectRatio.Story) arStr = "9:16";
  if (aspectRatio === AspectRatio.Landscape) arStr = "16:9";
  if (aspectRatio === AspectRatio.Portrait) arStr = "3:4";
  if (aspectRatio === AspectRatio.Wide) arStr = "4:3";

  const tryGenerate = async (model: string) => {
    const response = await withTimeout(getAI().models.generateContent({
      model: model,
      contents: `${userPrompt}. Style: Nano Banana Pro, 8K, cinematic. Typography Focus: The text MUST be legible, bold, high-contrast, and enclosed in quotes. Do not misspell.`,
      config: {
        imageConfig: {
          aspectRatio: arStr as any,
          imageSize: "1K"
        }
      }
    }));
    return extractImageFromResponse(response);
  };

  try {
    return await tryGenerate(IMAGE_MODEL_NAME);
  } catch (error: any) {
    const errorStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
    const errorMsg = error?.message || errorStr || "";
    const isPermissionError = errorMsg.includes("permission") || errorMsg.includes("403") || errorMsg.includes("not found");
    if (isPermissionError) {
      console.warn("Pro model yetki hatası, standart modele dönülüyor...");
      return await tryGenerate(FALLBACK_IMAGE_MODEL);
    }
    throw error;
  }
};