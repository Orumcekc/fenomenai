import React, { useState } from 'react';
import { BioAnalysis } from '../types';
import { analyzeBio } from '../services/apiService'; // ← DEĞİŞTİ
import { UserCheck, Sparkles, AlertCircle, Loader2, Target, Award, X } from 'lucide-react';
import { motion } from 'motion/react';

const BioAudit: React.FC = () => {
  const [currentBio, setCurrentBio] = useState('');
  const [niche, setNiche] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<BioAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAudit = async () => {
    if (!currentBio || !niche) return;
    setLoading(true);
    setAnalysis(null);
    setError(null);
    try {
      const data = await analyzeBio(currentBio, niche);
      setAnalysis(data);
    } catch (err: any) {
      setError(err.message || "Analiz sırasında hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-bold uppercase tracking-widest">
          <UserCheck className="w-3 h-3" />Profil Optimizasyonu
        </motion.div>
        <h2 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-orange-400">
          Profil Vitrini Analizi
        </h2>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Biyografiniz ziyaretçileri takipçiye dönüştürüyor mu? Gemini ile profilinizin etkileyiciliğini test edin.
        </p>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </motion.div>
      )}

      <div className="glass-card p-8 shadow-2xl">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Nişiniz</label>
              <div className="relative">
                <Target className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Örn: Dijital Pazarlama, Fitness..."
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 pl-10 text-sm text-white focus:ring-2 focus:ring-pink-500 outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Mevcut Biyografiniz</label>
              <textarea value={currentBio} onChange={(e) => setCurrentBio(e.target.value)} placeholder="Profilinizdeki yazıyı buraya yapıştırın..."
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-sm text-white h-32 focus:ring-2 focus:ring-pink-500 outline-none resize-none placeholder:text-slate-600" />
            </div>
            <button onClick={handleAudit} disabled={loading || !currentBio || !niche}
              className="btn-primary w-full py-4 bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-500 hover:to-orange-400 shadow-pink-500/25">
              {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <><Sparkles className="w-5 h-5" />Analizi Başlat</>}
            </button>
          </div>

          <div className="bg-slate-800/30 rounded-2xl border border-slate-700/50 p-8 flex flex-col items-center justify-center text-center space-y-4">
            {!analysis && !loading ? (
              <>
                <div className="w-20 h-20 bg-pink-500/10 rounded-full flex items-center justify-center border border-pink-500/20 mb-2">
                  <Award className="w-10 h-10 text-pink-400 opacity-40" />
                </div>
                <h4 className="font-bold text-slate-400">Skorunuzu Öğrenin</h4>
              </>
            ) : loading ? (
              <div className="space-y-4">
                <div className="w-16 h-16 border-4 border-pink-500/20 border-t-pink-500 rounded-full animate-spin mx-auto" />
                <p className="text-pink-400 font-bold animate-pulse">Profiliniz İnceleniyor...</p>
              </div>
            ) : analysis && (
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-4">
                <div className="relative inline-block">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
                    <motion.circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent"
                      strokeDasharray={364.4} initial={{ strokeDashoffset: 364.4 }}
                      animate={{ strokeDashoffset: 364.4 - (364.4 * (analysis.score || 0)) / 100 }}
                      transition={{ duration: 1.5, ease: "easeOut" }} className={getScoreColor(analysis.score || 0)} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-3xl font-black ${getScoreColor(analysis.score || 0)}`}>{analysis.score || 0}</span>
                    <span className="text-[10px] text-slate-500 font-bold uppercase">SKOR</span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {analysis && (
        <div className="grid md:grid-cols-2 gap-8">
          <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="glass-card p-8 border-amber-500/20">
            <h3 className="text-amber-400 font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> İyileştirme Önerileri
            </h3>
            <div className="space-y-4">
              {analysis.suggestions?.length > 0 ? analysis.suggestions.map((sug, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
                  className="flex items-start gap-3 bg-amber-500/5 p-4 rounded-xl border border-amber-500/10">
                  <div className="w-5 h-5 bg-amber-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-amber-500 text-[10px] font-bold">{idx + 1}</span>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">{sug}</p>
                </motion.div>
              )) : <p className="text-slate-500 text-sm italic">Öneri bulunamadı.</p>}
            </div>
          </motion.div>

          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="glass-card p-8 border-emerald-500/20">
            <h3 className="text-emerald-400 font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Önerilen Biyografiler
            </h3>
            <div className="space-y-4">
              {analysis.rewrittenBios?.length > 0 ? analysis.rewrittenBios.map((bio, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
                  className="group relative bg-emerald-500/5 p-5 rounded-xl border border-emerald-500/10 hover:border-emerald-500/30 transition-all">
                  <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{bio}</p>
                  <button onClick={() => navigator.clipboard.writeText(bio)}
                    className="mt-3 text-[10px] font-bold text-emerald-400 uppercase tracking-widest hover:text-emerald-300">Kopyala</button>
                </motion.div>
              )) : <p className="text-slate-500 text-sm italic">Öneri bulunamadı.</p>}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default BioAudit;