import {
  GeneratedContent,
  StrategyPlan,
  BioAnalysis,
  CarouselPlanResponse,
  ContentRequest,
  StrategyRequest,
  BioRequest,
  CarouselRequest,
  CarouselImageRequest,
  EditImageRequest
} from '../types';

const API_BASE = '/api';

// --- RETRY & ERROR HANDLING ---

const MAX_RETRIES = 2;
const RETRY_DELAY = 2000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class ApiError extends Error {
  code: string;
  status: number;
  
  constructor(message: string, status: number, code: string = 'UNKNOWN') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function apiCall<T>(
  endpoint: string,
  body: any,
  retries: number = MAX_RETRIES,
  timeoutMs: number = 120000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`${API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Bilinmeyen hata' }));
        
        // Rate limit → bekle ve tekrar dene
        if (response.status === 429 && attempt < retries) {
          const waitTime = RETRY_DELAY * Math.pow(2, attempt);
          console.warn(`Rate limit, ${waitTime}ms beklenecek (deneme ${attempt + 1}/${retries + 1})`);
          await sleep(waitTime);
          continue;
        }

        throw new ApiError(
          errorData.error || `HTTP ${response.status}`,
          response.status,
          errorData.code || 'HTTP_ERROR'
        );
      }

      return await response.json() as T;
    } catch (error: any) {
      lastError = error;

      if (error.name === 'AbortError') {
        throw new ApiError(
          `İstek zaman aşımına uğradı (${timeoutMs / 1000}sn). Tekrar deneyin.`,
          408,
          'TIMEOUT'
        );
      }

      // Ağ hatası → tekrar dene
      if (error instanceof TypeError && error.message.includes('fetch') && attempt < retries) {
        console.warn(`Ağ hatası, tekrar deneniyor (${attempt + 1}/${retries + 1})`);
        await sleep(RETRY_DELAY);
        continue;
      }

      if (error instanceof ApiError) throw error;
      throw new ApiError(error.message || 'Beklenmeyen hata', 500, 'UNKNOWN');
    }
  }

  throw lastError || new ApiError('Tüm denemeler başarısız', 500, 'ALL_RETRIES_FAILED');
}

// --- PUBLIC API ---

export async function generatePostContent(
  topic: string,
  platform: string,
  tone: string,
  keywords?: string,
  mediaData?: { data: string; mimeType: string }
): Promise<GeneratedContent> {
  return apiCall<GeneratedContent>('generate-content', {
    topic, platform, tone, keywords, mediaData
  });
}

export async function generateGrowthStrategy(
  platform: string,
  username: string,
  niche: string,
  goal: string,
  mediaData?: { data: string; mimeType: string }
): Promise<StrategyPlan[]> {
  return apiCall<StrategyPlan[]>('generate-strategy', {
    platform, username, niche, goal, mediaData
  });
}

export async function analyzeBio(bio: string, niche: string): Promise<BioAnalysis> {
  return apiCall<BioAnalysis>('analyze-bio', { bio, niche });
}

export async function createCarouselPlan(sourceText: string): Promise<CarouselPlanResponse> {
  return apiCall<CarouselPlanResponse>('create-carousel', { sourceText });
}

export async function generateCarouselImage(
  fullPrompt: string,
  referenceImageBase64?: string
): Promise<string> {
  const response = await apiCall<{ image: string }>('generate-image', {
    fullPrompt, referenceImageBase64
  }, MAX_RETRIES, 150000); // Görsel üretimi daha uzun sürer
  return response.image;
}

export async function editCarouselImage(
  originalImageBase64: string,
  newText: string
): Promise<string> {
  const response = await apiCall<{ image: string }>('edit-image', {
    originalImageBase64, newText
  }, MAX_RETRIES, 150000);
  return response.image;
}

export async function generateCustomImage(
  prompt: string,
  aspectRatio: string
): Promise<string> {
  const fullPrompt = `${prompt}. Style: Nano Banana Pro, 8K, cinematic. Typography Focus: Text MUST be legible, bold, high-contrast.`;
  const response = await apiCall<{ image: string }>('generate-image', {
    fullPrompt,
    aspectRatio
  }, MAX_RETRIES, 150000);
  return response.image;
}