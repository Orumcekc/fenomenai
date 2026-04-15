import React, { useState, useEffect } from 'react';
import { CarouselSlide } from '../types';
import { createCarouselPlan, generateCarouselImage, editCarouselImage } from '../services/geminiService';
import { 
  Images, 
  Sparkles, 
  Edit3, 
  Download, 
  Loader2, 
  RefreshCw,
  Image as ImageIcon,
  Wand2,
  Copy,
  Files,
  Info,
  AlertTriangle,
  Lock,
  ArrowRight,
  Plus,
  Key,
  Type,
  LayoutTemplate,
  Upload,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';

const CarouselGenerator: React.FC = () => {
  // Input State
  const [sourceText, setSourceText] = useState('');
  const [visualStyle, setVisualStyle] = useState(''); 
  const [selectedStyle, setSelectedStyle] = useState('Cinematic');
  const [textMode, setTextMode] = useState<'overlay' | 'embedded'>('overlay');

  const styleOptions = [
    { id: 'Cinematic', label: 'Gerçekçi / Sinematik', desc: '8K, Ultra Detaylı, Fotoğraf Kalitesi' },
    { id: 'Manga', label: 'Manga / Anime', desc: 'Japon Çizgi Roman Stili, Keskin Hatlar' },
    { id: 'Retro', label: 'Retro / Vintage', desc: '90lar Estetiği, Grenli, Nostaljik' },
    { id: 'Fantasy', label: 'Fantastik / Rüya', desc: 'Büyülü Atmosfer, Parlak Renkler' }
  ];
  
  // App State
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'editor'>('input');
  const [errorMap, setErrorMap] = useState<Record<number, string>>({});
  
  // Data State
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [generatingImages, setGeneratingImages] = useState<Record<number, boolean>>({});
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };
  
  // Consistency State
  const [projectSeed, setProjectSeed] = useState<number>(42);

  // Failsafe
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (loading) {
      timeout = setTimeout(() => {
        if (loading) {
          setLoading(false);
        }
      }, 160000);
    }
    return () => clearTimeout(timeout);
  }, [loading]);

  // Step 1: Generate Plan
  const handlePlanCreation = async () => {
    if (!sourceText) return;
    setLoading(true);
    setSlides([]);
    
    const newSeed = Math.floor(Math.random() * 2000000);
    setProjectSeed(newSeed);

    try {
      const response = await createCarouselPlan(sourceText);
      if (!response || !response.slides || response.slides.length === 0) {
        alert("Plan oluşturulamadı.");
        setLoading(false);
        return;
      }
      setSlides(response.slides);
      setVisualStyle(response.visualStyle || ''); 
      setStep('editor');
    } catch (error: any) {
      alert(error.message || "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const updateSlide = (index: number, field: keyof CarouselSlide, value: string) => {
    const newSlides = [...slides];
    newSlides[index] = { ...newSlides[index], [field]: value };
    setSlides(newSlides);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setReferenceImage(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const constructImagePrompt = (slide: CarouselSlide) => {
    const baseStyle = visualStyle || "Cinematic, photorealistic, high quality";
    const styleModifier = selectedStyle === 'Manga' ? "Manga style, anime art, sharp lines" :
                          selectedStyle === 'Retro' ? "Retro 90s aesthetic, vintage film grain, nostalgic" :
                          selectedStyle === 'Fantasy' ? "Fantasy art, magical atmosphere, vibrant colors" :
                          "Photorealistic, 8K resolution, cinematic lighting";

    const action = slide.imagePrompt || "A scene";
    const text = slide.text || "";
    
    if (textMode === 'overlay') {
       // Overlay modunda metinsiz, temiz görsel istiyoruz
       return `Create a clean, high-quality background image suitable for text overlay. Visual Style: ${baseStyle}. Style Modifier: ${styleModifier}. Scene Description: ${action}. IMPORTANT: Do NOT include any text, letters, or typography in the image. Leave negative space for text overlay.`.trim();
    } else {
       // Embedded modunda metinli görsel istiyoruz
       return `Create a social media image. Visual Style: ${baseStyle}. Style Modifier: ${styleModifier}. Scene Description: ${action}. Text Overlay: "${text}". IMPORTANT: The text "${text}" must be clearly visible, large, bold, and high-contrast against the background.`.trim();
    }
  };

  const handleGenerateImage = async (index: number): Promise<boolean> => {
    const slide = slides[index];
    if (!slide) return false;
    
    if (!hasApiKey) {
      await handleSelectKey();
      return false;
    }
    
    setGeneratingImages(prev => ({ ...prev, [index]: true }));
    setErrorMap(prev => ({ ...prev, [index]: '' })); 
    try {
      const fullPrompt = constructImagePrompt(slide);
      const base64Data = await generateCarouselImage(fullPrompt, referenceImage || undefined);
      setSlides(prev => {
        const newS = [...prev];
        newS[index] = { ...newS[index], generatedImageBase64: base64Data };
        return newS;
      });
      return true;
    } catch (error: any) {
      const errorStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
      const errorMsg = error?.message || errorStr || "Hata";
      
      if (errorMsg.includes("Requested entity was not found")) {
        setHasApiKey(false);
      } else if (errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED")) {
        alert("Kota aşıldı! Lütfen geçerli bir API anahtarı seçin.");
        setHasApiKey(false);
      }
      
      setErrorMap(prev => ({ ...prev, [index]: errorMsg }));
      return false;
    } finally {
      setGeneratingImages(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleEditText = async (index: number) => {
    // Embedded modunda metni AI ile tekrar yazdırmak için
    if (textMode === 'overlay') return; // Overlay modunda gerek yok

    const slide = slides[index];
    if (!slide || !slide.generatedImageBase64) return;
    
    if (!hasApiKey) {
      await handleSelectKey();
      return;
    }
    
    setGeneratingImages(prev => ({ ...prev, [index]: true }));
    try {
      const base64Data = await editCarouselImage(slide.generatedImageBase64, slide.text || "");
      setSlides(prev => {
        const newS = [...prev];
        newS[index] = { ...newS[index], generatedImageBase64: base64Data };
        return newS;
      });
    } catch (error: any) {
      const errorStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
      const errorMsg = error?.message || errorStr || "Hata";
      
      if (errorMsg.includes("Requested entity was not found")) {
        setHasApiKey(false);
      } else if (errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED")) {
        alert("Kota aşıldı! Lütfen geçerli bir API anahtarı seçin.");
        setHasApiKey(false);
      }
      
      setErrorMap(prev => ({ ...prev, [index]: `Metin hatası: ${errorMsg}` }));
    } finally {
      setGeneratingImages(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleGenerateAll = async () => {
    if (!hasApiKey) {
      await handleSelectKey();
      return;
    }
    const newLoadingState = { ...generatingImages };
    slides.forEach((_, idx) => newLoadingState[idx] = true);
    setGeneratingImages(newLoadingState);
    for (let i = 0; i < slides.length; i++) {
      const success = await handleGenerateImage(i);
      if (!success) {
        // Stop generating the rest if there's an error
        setGeneratingImages(prev => {
          const cleared = { ...prev };
          for (let j = i; j < slides.length; j++) cleared[j] = false;
          return cleared;
        });
        break;
      }
    }
  };

  const downloadSlide = async (index: number) => {
    const slide = slides[index];
    if (!slide || !slide.generatedImageBase64) return;

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.crossOrigin = "anonymous";
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = `data:image/png;base64,${slide.generatedImageBase64}`;
      });

      canvas.width = img.width;
      canvas.height = img.height;

      // Draw base image
      ctx.drawImage(img, 0, 0);

      // If overlay mode, draw text
      if (textMode === 'overlay' && slide.text) {
        // Draw gradient background at the bottom
        const gradient = ctx.createLinearGradient(0, canvas.height * 0.5, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.6)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, canvas.height * 0.5, canvas.width, canvas.height * 0.5);

        // Draw text
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        
        // Calculate font size based on image width (e.g., 6% of width)
        const fontSize = Math.max(32, Math.floor(canvas.width * 0.06));
        ctx.font = `900 ${fontSize}px Inter, system-ui, sans-serif`;
        
        // Add shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 4;

        // Word wrap text
        const maxWidth = canvas.width * 0.9;
        const words = slide.text.split(' ');
        let line = '';
        const lines = [];

        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          const testWidth = metrics.width;
          if (testWidth > maxWidth && n > 0) {
            lines.push(line);
            line = words[n] + ' ';
          } else {
            line = testLine;
          }
        }
        lines.push(line);

        // Draw lines from bottom up
        const lineHeight = fontSize * 1.2;
        let y = canvas.height - (canvas.height * 0.05); // 5% padding from bottom
        
        for (let i = lines.length - 1; i >= 0; i--) {
          ctx.fillText(lines[i].trim(), canvas.width / 2, y);
          y -= lineHeight;
        }
      }

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `slide-${index + 1}.png`;
      link.click();
    } catch (err) {
      console.error("Download error:", err);
      alert("Görsel indirilirken bir hata oluştu.");
    }
  };

  if (step === 'input') {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest"
          >
            <Images className="w-3 h-3" />
            Görsel Hikayeleştirme
          </motion.div>
          <h2 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            AI Carousel Stüdyosu
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Hikayenizi anlatın, Gemini 3 Flash ile sahneleri otomatik kurgulayalım ve tutarlı görseller üretelim.
          </p>
        </div>

        <div className="glass-card p-8 shadow-2xl">
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Hikaye / İçerik</label>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Örn: Bir girişimcinin başarı yolculuğu, 5 adımda verimlilik artışı..."
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-sm text-white h-48 focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all placeholder:text-slate-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Görsel Tarz</label>
              <div className="grid grid-cols-2 gap-3">
                {styleOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedStyle(opt.id)}
                    className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden group ${
                      selectedStyle === opt.id
                        ? 'bg-indigo-600/10 border-indigo-500 text-indigo-200'
                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <div className="font-bold text-xs">{opt.label}</div>
                    <div className="text-[10px] opacity-60 font-medium">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handlePlanCreation}
              disabled={loading || !sourceText}
              className="btn-primary w-full py-4 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 shadow-indigo-500/25"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin w-5 h-5" />
                  Plan Hazırlanıyor...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  Sahneleri Kurgula
                </>
              )}
            </button>
            <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
              <Sparkles className="w-3 h-3" />
              Yapay zeka kurgusu 30-60 saniye sürebilir
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Header Actions */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-card p-6 sticky top-4 z-40 shadow-2xl space-y-6"
      >
        <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
          <div className="flex-1 w-full space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-white flex items-center gap-2 uppercase tracking-tight">
                <Edit3 className="w-5 h-5 text-indigo-400" /> 
                Carousel Editörü
              </h2>
              <button 
                onClick={() => confirm('Yeni projeye başlamak istiyor musunuz?') && setStep('input')}
                className="text-[10px] font-bold text-slate-500 hover:text-white uppercase tracking-widest transition-colors"
              >
                Yeni Proje
              </button>
            </div>
            
            <div className="flex gap-4">
               <div className="flex-1 bg-indigo-500/5 border border-indigo-500/20 p-4 rounded-xl relative group">
                  <div className="flex items-start gap-3">
                     <div className="mt-1 flex-shrink-0">
                       <Lock className="w-4 h-4 text-orange-400" />
                     </div>
                     <div className="w-full">
                       <div className="flex justify-between items-center mb-2">
                         <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                           Ana Karakter & Stil Referansı
                         </span>
                         <span className="text-[9px] text-orange-400 font-bold border border-orange-500/30 px-1.5 py-0.5 rounded bg-orange-500/5">
                           CONSISTENCY LOCK: ON
                         </span>
                       </div>
                       <div className="flex gap-3">
                         {referenceImage && (
                           <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-indigo-500/30 group/ref">
                             <img src={referenceImage} alt="Reference" className="w-full h-full object-cover" />
                             <button 
                               onClick={() => setReferenceImage(null)}
                               className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/ref:opacity-100 transition-opacity"
                             >
                               <X className="w-4 h-4 text-white" />
                             </button>
                           </div>
                         )}
                         <div className="flex-1 flex flex-col gap-2">
                           <textarea 
                             value={visualStyle}
                             onChange={(e) => setVisualStyle(e.target.value)}
                             className="w-full bg-slate-900/50 text-xs text-indigo-100 border border-indigo-500/10 rounded-lg p-3 focus:ring-1 focus:ring-indigo-500 resize-none h-auto min-h-[60px] transition-all"
                           />
                           <div className="flex justify-end">
                             <label className="cursor-pointer flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-widest transition-colors">
                               <Upload className="w-3 h-3" />
                               {referenceImage ? 'Görseli Değiştir' : 'Referans Görsel Ekle'}
                               <input 
                                 type="file" 
                                 accept="image/*" 
                                 onChange={handleImageUpload} 
                                 className="hidden" 
                               />
                             </label>
                           </div>
                         </div>
                       </div>
                     </div>
                  </div>
               </div>
               
               <div className="w-48 bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex flex-col gap-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Metin Modu</span>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => setTextMode('overlay')}
                      className={`flex items-center gap-2 p-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${textMode === 'overlay' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
                    >
                      <LayoutTemplate className="w-3 h-3" /> Overlay (Önerilen)
                    </button>
                    <button 
                      onClick={() => setTextMode('embedded')}
                      className={`flex items-center gap-2 p-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${textMode === 'embedded' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
                    >
                      <Type className="w-3 h-3" /> AI Gömülü (Beta)
                    </button>
                  </div>
               </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 w-full lg:w-64">
            <button
              onClick={handleGenerateAll}
              disabled={Object.values(generatingImages).some(v => v)}
              className="btn-primary w-full py-3 bg-indigo-600 shadow-indigo-500/20"
            >
              {Object.values(generatingImages).some(v => v) ? (
                 <Loader2 className="w-4 h-4 animate-spin" />
              ) : !hasApiKey ? (
                 <>
                   <Key className="w-4 h-4" />
                   Anahtar Seç
                 </>
              ) : (
                 <Sparkles className="w-4 h-4" />
              )}
               Tümünü Üret
            </button>
            {!hasApiKey && (
              <p className="text-[9px] text-orange-400 text-center font-bold animate-pulse">
                Ücretli API anahtarı gereklidir.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
               <button onClick={() => {
                 slides.forEach((s, i) => s.generatedImageBase64 && downloadSlide(i));
               }} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-slate-700 flex items-center justify-center gap-2">
                 <Files className="w-3 h-3" /> İndir
               </button>
               <button onClick={() => {
                 const text = slides.map(s => `Slayt ${s.slideNumber}: ${s.text}`).join('\n\n');
                 navigator.clipboard.writeText(text);
               }} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-slate-700 flex items-center justify-center gap-2">
                 <Copy className="w-3 h-3" /> Kopyala
               </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Slides Grid */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence>
          {slides.map((slide, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="glass-card overflow-hidden group hover:border-indigo-500/50 transition-all flex flex-col"
            >
              <div className="bg-slate-900/50 p-3 border-b border-slate-700 flex justify-between items-center">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Slayt {slide.slideNumber}</span>
                <div className="flex items-center gap-1.5">
                   <Info className="w-3 h-3 text-slate-600" />
                   <span className="text-[10px] text-slate-500 font-medium truncate max-w-[120px]">{slide.designNote}</span>
                </div>
              </div>

              <div className="p-5 space-y-5 flex-1 flex flex-col">
                {/* Image Preview Area */}
                <div 
                  id={`slide-preview-${index}`}
                  className="aspect-square bg-slate-900 rounded-xl relative group/image overflow-hidden border border-slate-800 flex items-center justify-center shadow-inner"
                >
                  {slide.generatedImageBase64 ? (
                    <>
                      <img 
                        src={`data:image/png;base64,${slide.generatedImageBase64}`} 
                        alt={`Slide ${slide.slideNumber}`}
                        className="w-full h-full object-cover" 
                      />
                      
                      {/* Text Overlay */}
                      {textMode === 'overlay' && (
                        <div className="absolute inset-0 flex flex-col justify-end items-center text-center z-10 pointer-events-none">
                           <div className="w-full bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-12 pb-6 px-4">
                             <p 
                               className="text-white font-black text-lg leading-tight drop-shadow-2xl"
                               style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}
                             >
                               {slide.text}
                             </p>
                           </div>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm z-20">
                         <button
                          onClick={() => downloadSlide(index)}
                          className="p-3 bg-white text-black rounded-full hover:scale-110 transition-all shadow-xl"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleGenerateImage(index)}
                          className="p-3 bg-indigo-600 text-white rounded-full hover:scale-110 transition-all shadow-xl"
                        >
                          <RefreshCw className="w-5 h-5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-6 w-full h-full flex items-center justify-center">
                      {generatingImages[index] ? (
                        <div className="flex flex-col items-center gap-4 text-indigo-400">
                          <div className="w-12 h-12 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                          <span className="text-[10px] font-bold uppercase tracking-widest animate-pulse">Çiziliyor...</span>
                        </div>
                      ) : errorMap[index] ? (
                         <div className="flex flex-col items-center gap-3 text-rose-400 p-4 text-center">
                           <AlertTriangle className="w-8 h-8 opacity-50" />
                           <span className="text-[10px] font-bold leading-tight">{errorMap[index]}</span>
                           <button onClick={() => handleGenerateImage(index)} className="text-[10px] font-black uppercase tracking-widest border border-rose-500/30 px-3 py-1.5 rounded-lg hover:bg-rose-500/10 transition-all">
                             Tekrar Dene
                           </button>
                         </div>
                      ) : !hasApiKey ? (
                        <button onClick={handleSelectKey} className="flex flex-col items-center gap-4 text-orange-400 hover:text-orange-300 transition-all group/btn">
                          <div className="w-16 h-16 bg-orange-500/5 rounded-full flex items-center justify-center border border-orange-500/20 group-hover/btn:border-orange-500/40 transition-all">
                            <Key className="w-8 h-8 opacity-40 group-hover/btn:opacity-100 transition-opacity" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-center">Anahtar Seç</span>
                        </button>
                      ) : (
                        <button onClick={() => handleGenerateImage(index)} className="flex flex-col items-center gap-4 text-slate-600 hover:text-indigo-400 transition-all group/btn">
                          <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center border border-slate-700 group-hover/btn:border-indigo-500/30 group-hover/btn:bg-indigo-500/5 transition-all">
                            <ImageIcon className="w-8 h-8 opacity-40 group-hover/btn:opacity-100 transition-opacity" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest">Görsel Oluştur</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Slayt Metni</span>
                      {textMode === 'embedded' && (
                        <button
                          onClick={() => handleEditText(index)}
                          disabled={!slide.generatedImageBase64 || generatingImages[index]}
                          className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-widest flex items-center gap-1 disabled:opacity-30"
                        >
                          {generatingImages[index] ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <RefreshCw className="w-2.5 h-2.5" />}
                          Metni Bas (AI)
                        </button>
                      )}
                    </div>
                    <textarea
                      value={slide.text}
                      onChange={(e) => updateSlide(index, 'text', e.target.value)}
                      className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl p-3 text-xs text-white focus:ring-1 focus:ring-indigo-500 outline-none resize-none h-20 transition-all"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Slayt Aksiyonu</span>
                    <textarea
                      value={slide.imagePrompt}
                      onChange={(e) => updateSlide(index, 'imagePrompt', e.target.value)}
                      className="w-full bg-slate-900/50 border border-slate-700/30 rounded-xl p-3 text-[10px] text-slate-400 focus:ring-1 focus:ring-indigo-500 outline-none resize-none h-16 font-mono transition-all"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CarouselGenerator;
