import React, { useState, useRef } from 'react';
import { StrategyPlan, Platform } from '../types';
import { generateGrowthStrategy } from '../services/apiService'; // ← DEĞİŞTİ
import { Target, TrendingUp, Loader2, User, Search, AtSign, Sparkles, Calendar, Upload, X, PenTool } from 'lucide-react';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';

interface StrategyProps {
  onCreateContent?: (topic: string, context: string) => void;
  initialPlan?: StrategyPlan[] | null;
  onPlanUpdate?: (plan: StrategyPlan[]) => void;
}

const Strategy: React.FC<StrategyProps> = ({ onCreateContent, initialPlan, onPlanUpdate }) => {
  const [platform, setPlatform] = useState<Platform>(Platform.Instagram);
  const [username, setUsername] = useState('mustafasenc');
  const [niche, setNiche] = useState('');
  const [goal, setGoal] = useState('Takipçi Kazanmak');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<StrategyPlan[]>(initialPlan || []);
  const [error, setError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { alert("Max 20MB"); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setSelectedFile({ data: base64String.split(',')[1], mimeType: file.type, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!username) return;
    setLoading(true);
    setPlan([]);
    setError(null);
    try {
      const data = await generateGrowthStrategy(
        platform, username, niche, goal,
        selectedFile ? { data: selectedFile.data, mimeType: selectedFile.mimeType } : undefined
      );
      if (!data || data.length === 0) {
        setError("Strateji oluşturulamadı. Lütfen tekrar deneyin.");
      } else {
        setPlan(data);
        if (onPlanUpdate) onPlanUpdate(data);
      }
    } catch (err: any) {
      setError(err.message || "Strateji oluşturulurken hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest"
        >
          <TrendingUp className="w-3 h-3" />
          Stratejik Analiz
        </motion.div>
        <h2 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-500">
          Kişiselleştirilmiş Büyüme Planı
        </h2>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Profilinizi ve nişinizi analiz edelim, size özel 7 günlük bir rota çizelim.
        </p>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm font-medium flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </motion.div>
      )}

      <div className="glass-card p-8 shadow-2xl">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div className="space-y-6 md:col-span-2">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Platform</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(Platform).map((p) => (
                    <button key={p} onClick={() => setPlatform(p)}
                      className={`p-2.5 text-xs font-semibold rounded-xl transition-all border ${
                        platform === p ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}>{p}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Kullanıcı Adı</label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="kullanici_adi"
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 pl-10 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Niş / Kategori</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                  <input type="text" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Örn: Teknoloji, Moda..."
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 pl-10 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Ana Hedef</label>
                <select value={goal} onChange={(e) => setGoal(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none">
                  <option>Takipçi Kazanmak</option>
                  <option>Satış Arttırmak</option>
                  <option>Marka Bilinirliği</option>
                  <option>Etkileşim (Beğeni/Yorum)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6 flex flex-col justify-center items-center text-center space-y-4">
            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
              <Sparkles className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h4 className="font-bold text-blue-100">Akıllı Analiz</h4>
              <p className="text-xs text-slate-400 mt-1">Gemini Deep Thinking ile rakip ve trend analizi.</p>
            </div>
            <button onClick={handleGenerate} disabled={loading || !username}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <><TrendingUp className="w-5 h-5" />Planı Oluştur</>}
            </button>
          </div>
        </div>
      </div>

      {Array.isArray(plan) && plan.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plan.map((day, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.1 }}
              className="glass-card p-6 hover:border-blue-500/50 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Calendar className="w-12 h-12 text-blue-400" />
              </div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-blue-400 font-black text-xs bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20 uppercase tracking-tighter">
                  {day?.day || `GÜN ${idx + 1}`}
                </span>
                <Target className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
              </div>
              <h4 className="text-white font-bold mb-3 text-sm leading-tight">{day?.focus || 'Odak belirlenemedi'}</h4>
              <div className="h-px w-full bg-slate-800 mb-3" />
              <div className="text-slate-400 text-[11px] leading-relaxed prose prose-invert prose-sm max-w-none mb-4">
                <Markdown>{day?.idea || 'Fikir üretilemedi.'}</Markdown>
              </div>
              <button onClick={() => onCreateContent && onCreateContent(day?.focus || '', day?.idea || '')}
                className="w-full mt-auto bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-xs font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2">
                <PenTool className="w-3 h-3" />İçerik Oluştur
              </button>
            </motion.div>
          ))}

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 flex flex-col justify-center items-center text-center text-white shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.2),transparent)]" />
            <User className="w-10 h-10 mb-4 opacity-80" />
            <h4 className="font-black text-xl mb-2 tracking-tight">@{username}</h4>
            <p className="text-xs opacity-80 font-medium uppercase tracking-widest mb-4">Hazır!</p>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <p className="text-[10px] leading-tight">
                Bu strateji, <strong>{niche || 'profilinizdeki'}</strong> güncel trendlere göre optimize edilmiştir.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Strategy;