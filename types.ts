export enum Platform {
  Instagram = 'Instagram',
  Twitter = 'Twitter (X)',
  LinkedIn = 'LinkedIn',
  TikTok = 'TikTok',
  YouTube = 'YouTube Shorts'
}

export enum ContentTone {
  Professional = 'Profesyonel',
  Funny = 'Eğlenceli',
  Inspirational = 'İlham Verici',
  Educational = 'Eğitici',
  Controversial = 'Tartışmalı (Viral Odaklı)'
}

export enum AspectRatio {
  Square = '1:1',
  Story = '9:16',
  Landscape = '16:9',
  Portrait = '3:4',
  Wide = '4:3'
}

export interface GeneratedContent {
  content: string;
  hashtags: string[];
  hooks: string[];
}

export interface StrategyPlan {
  day: string;
  focus: string;
  idea: string;
}

export interface BioAnalysis {
  score: number;
  suggestions: string[];
  rewrittenBios: string[];
}

export interface CarouselSlide {
  slideNumber: number;
  text: string;
  imagePrompt: string;
  designNote: string;
  generatedImageBase64?: string;
}

export interface CarouselPlanResponse {
  visualStyle: string;
  slides: CarouselSlide[];
}

// API request/response types
export interface ApiError {
  error: string;
  code?: string;
}

export interface ContentRequest {
  topic: string;
  platform: Platform;
  tone: ContentTone;
  keywords?: string;
  mediaData?: { data: string; mimeType: string };
}

export interface StrategyRequest {
  platform: string;
  username: string;
  niche: string;
  goal: string;
  mediaData?: { data: string; mimeType: string };
}

export interface BioRequest {
  bio: string;
  niche: string;
}

export interface CarouselRequest {
  sourceText: string;
}

export interface ImageRequest {
  prompt: string;
  aspectRatio: string;
}

export interface CarouselImageRequest {
  fullPrompt: string;
  referenceImageBase64?: string;
}

export interface EditImageRequest {
  originalImageBase64: string;
  newText: string;
}