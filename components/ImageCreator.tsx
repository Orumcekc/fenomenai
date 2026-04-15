import React, { useState } from 'react';
import { generateCustomImage } from '../services/apiService'; // ← DEĞİŞTİ
import { AspectRatio } from '../types';
import { Wand2, Loader2, Download, Image as ImageIcon, Check, Sparkles, Palette, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ImageCreator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.Square);
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt) return;
    setLoading(true);
    setGeneratedImage(null);
    setError(null);
    try {
      const base64 = await generateCustomImage(prompt, aspectRatio);
      setGeneratedImage(base64);
    } catch (err: any) {
      setError(err.message || "Görsel oluşturulamadı.");
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${generatedImage}`;
    link.download = `fenomen-ai-art-${Date.now()}.png`;
    link.click();
  };

  const ratioOptions = [
    { label: 'Kare (Post)', value: AspectRatio.Square, desc: '1:1 - Instagram' },
    { label: 'Hikaye (Story)', value: AspectRatio.Story, desc: '9:16 - Reels/TikTok' },
    { label: 'Yatay (Landscape)', value: AspectRatio.Landscape, desc: '16:9 - YouTube' },
    { label: 'Portre', value: AspectRatio.Portrait, desc: '3:4 - Instagram' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-widest">
          <Palette className="w-3 h-3" />Görsel Sanat Atölyesi
        </motion.div>
        <h2 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500">
          AI Görsel Atölyesi
        </h2>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Hayalinizdeki sahneyi tarif edin, Gemini ile istediğiniz boyutta üretelim.
        </p>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </motion.div>
      )}

      <div className="grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6 shadow-2xl space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Sahne Tarifi</label>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
                placeholder="Örn: Gelecekten bir İstanbul manzarası, neon ışıklar, siberpunk..."
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-sm text-white h-40 focus:ring-2 focus:ring-orange-500 outline-none resize-none placeholder:text-slate-600" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Görsel Boyutu</label>
              <div className="grid grid-cols-2 gap-3">
                {ratioOptions.map((opt) => (
                  <button key={opt.value} onClick={() => setAspectRatio(opt.value)}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      aspectRatio === opt.value ? 'bg-orange-600/10 border-orange-500 text-orange-200' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}>
                    <div className="font-bold text-xs">{opt.label}</div>
                    <div className="text-[10px] opacity-60 font-medium">{opt.desc}</div>
                    {aspectRatio === opt.value && <motion.div layoutId="activeRatio" className="absolute top-2 right-2 text-orange-500"><Check className="w-4 h-4" /></motion.div>}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleGenerate} disabled={loading || !prompt}
              className="btn-primary w-full py-4 bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-500 hover:to-pink-500 shadow-orange-500/25">
              {loading ? <><Loader2 className="animate-spin w-5 h-5" />Sanat İşleniyor...</> : <><Wand2 className="w-5 h-5" />Görseli Oluştur</>}
            </button>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="glass-card p-6 flex flex-col items-center justify-center min-h-[500px] relative overflow-hidden">
            <AnimatePresence mode="wait">
              {generatedImage ? (
                <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="space-y-6 w-full h-full flex flex-col items-center">
                  <div className="relative group rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50">
                    <img src={`data:image/png;base64,${generatedImage}`} alt="Generated Art" className="max-h-[600px] w-auto object-contain" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                      <button onClick={downloadImage} className="bg-white text-black px-8 py-4 rounded-full font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:scale-105 transition-transform shadow-2xl">
                        <Download className="w-4 h-4" /> İndir
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    <Sparkles className="w-3 h-3 text-orange-400" />Yüksek Çözünürlüklü Çıktı Hazır
                  </div>
                </motion.div>
              ) : (
                <motion.div key="placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center text-slate-500 p-8">
                  {loading ? (
                    <div className="flex flex-col items-center gap-6">
                      <div className="relative">
                        <div className="w-20 h-20 border-4 border-orange-500/10 border-t-orange-500 rounded-full animate-spin" />
                        <Palette className="absolute inset-0 m-auto w-8 h-8 text-orange-400 animate-pulse" />
                      </div>
                      <p className="text-orange-400 font-black uppercase tracking-widest text-xs animate-pulse">Sanat eseri dokunuyor...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-6">
                      <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center border border-slate-700">
                        <ImageIcon className="w-10 h-10 opacity-20" />
                      </div>
                      <h4 className="text-slate-400 font-bold">Önizleme Alanı</h4>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCreator;