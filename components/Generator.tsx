import React, { useState, useRef, useEffect } from 'react';
import { Platform } from '../types';
import { generatePostContent } from '../services/apiService';
import { PenTool, Loader2, Copy, Check, Hash, Sparkles, Image as ImageIcon, X, MessageSquare, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';

interface GeneratorProps {
  initialData?: { topic?: string; keywords?: string } | null;
}

const Generator: React.FC<GeneratorProps> = ({ initialData }) => {
  const [topic, setTopic] = useState(initialData?.topic || '');
  const [platform, setPlatform] = useState<Platform>(Platform.Instagram);
  const [tone, setTone] = useState('Eğlenceli ve Samimi');
  const [keywords, setKeywords] = useState(initialData?.keywords || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData?.topic) setTopic(initialData.topic);
    if (initialData?.keywords) setKeywords(initialData.keywords);
  }, [initialData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      alert("Maksimum dosya boyutu 20MB'dır.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setSelectedFile({
        data: base64String.split(',')[1],
        mimeType: file.type,
        name: file.name
      });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!topic) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await generatePostContent(
        topic,
        platform,
        tone,
        keywords,
        selectedFile ? { data: selectedFile.data, mimeType: selectedFile.mimeType } : undefined
      );
      
      if (!data) {
        setError("İçerik oluşturulamadı. Lütfen tekrar deneyin.");
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError(err.message || "İçerik oluşturulurken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!result?.content) return;
    navigator.clipboard.writeText(result.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-widest"
        >
          <PenTool className="w-3 h-3" />
          İçerik Üreticisi
        </motion.div>
        <h2 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
          Yapay Zeka ile Üret
        </h2>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Sadece konuyu yazın, gerisini yapay zekaya bırakın.
        </p>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm font-medium flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </motion.div>
      )}

      <div className="glass-card p-8 shadow-2xl">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Ne hakkında yazalım?</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Örn: Yapay zekanın sosyal medyaya etkisi..."
                className="w-full h-32 bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Platform</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as Platform)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  {Object.values(Platform).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Ses Tonu</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  <option>Eğlenceli ve Samimi</option>
                  <option>Profesyonel ve Ciddi</option>
                  <option>Bilgilendirici ve Otoriter</option>
                  <option>İlham Verici</option>
                  <option>Meydan Okuyan (Mustafa Şen Tarzı)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Anahtar Kelimeler (Opsiyonel)</label>
              <div className="relative">
                <Hash className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="Yapay zeka, teknoloji, gelecek..."
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 pl-10 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Görsel / Video Ekle (Opsiyonel)</label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 bg-slate-800/50 hover:bg-slate-700 border border-slate-700 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-6 h-6 text-slate-400" />
                  <span className="text-xs text-slate-400 font-medium">Dosya Seç (Max 20MB)</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*,video/*"
                />
                {selectedFile && (
                  <div className="flex-1 bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <ImageIcon className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <span className="text-xs text-purple-300 truncate">{selectedFile.name}</span>
                    </div>
                    <button onClick={() => setSelectedFile(null)} className="text-purple-400 hover:text-purple-300 ml-2">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || !topic}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 disabled:opacity-50 mt-auto"
            >
              {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <><Sparkles className="w-5 h-5" />İçerik Üret</>}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-6 opacity-5">
            <MessageSquare className="w-32 h-32 text-purple-400" />
          </div>
          
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Üretilen İçerik
              </h3>
              <button
                onClick={copyToClipboard}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Kopyalandı!' : 'Kopyala'}
              </button>
            </div>

            <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
              <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                <Markdown>{result.content}</Markdown>
              </div>
            </div>

            {result.hashtags && result.hashtags.length > 0 && (
              <div className="mt-6">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Önerilen Etiketler</h4>
                <div className="flex flex-wrap gap-2">
                  {result.hashtags.map((tag: string, i: number) => (
                    <span key={i} className="bg-purple-500/10 text-purple-300 border border-purple-500/20 px-3 py-1 rounded-full text-xs font-medium">
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Generator;
