import React, { useState } from 'react';
import { PenTool, Rocket, UserCircle2, Zap, Images, Palette, LayoutDashboard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Generator from './components/Generator';
import Strategy from './components/Strategy';
import BioAudit from './components/BioAudit';
import CarouselGenerator from './components/CarouselGenerator';
import ImageCreator from './components/ImageCreator';
import { StrategyPlan } from './types';

type Tab = 'generator' | 'strategy' | 'bio' | 'carousel' | 'image';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('generator');
  const [generatorData, setGeneratorData] = useState<{ topic?: string; keywords?: string } | null>(null);
  const [strategyPlan, setStrategyPlan] = useState<StrategyPlan[] | null>(null);

  const handleStrategyToContent = (topic: string, context: string) => {
    setGeneratorData({ topic, keywords: context });
    setActiveTab('generator');
  };

  const navItems = [
    { id: 'generator', label: 'İçerik Üretici', icon: PenTool, color: 'text-purple-400', bg: 'bg-purple-600/10', border: 'border-purple-600/20' },
    { id: 'carousel', label: 'Carousel Stüdyo', icon: Images, color: 'text-indigo-400', bg: 'bg-indigo-600/10', border: 'border-indigo-600/20' },
    { id: 'image', label: 'Görsel Atölyesi', icon: Palette, color: 'text-orange-400', bg: 'bg-orange-600/10', border: 'border-orange-600/20' },
    { id: 'strategy', label: 'Büyüme Planı', icon: Rocket, color: 'text-blue-400', bg: 'bg-blue-600/10', border: 'border-blue-600/20' },
    { id: 'bio', label: 'Profil Analizi', icon: UserCircle2, color: 'text-pink-400', bg: 'bg-pink-600/10', border: 'border-pink-600/20' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'generator': return <Generator initialData={generatorData} />;
      case 'strategy': return <Strategy onCreateContent={handleStrategyToContent} initialPlan={strategyPlan} onPlanUpdate={setStrategyPlan} />;
      case 'bio': return <BioAudit />;
      case 'carousel': return <CarouselGenerator />;
      case 'image': return <ImageCreator />;
      default: return <Generator />;
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark text-white font-sans selection:bg-purple-500 selection:text-white">
      <nav className="sticky top-0 z-50 bg-brand-dark/80 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Zap className="w-5 h-5 text-white fill-current" />
              </motion.div>
              <span className="text-xl font-bold tracking-tight">Fenomen<span className="text-purple-500">AI</span></span>
            </div>
            <div className="hidden md:flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <LayoutDashboard className="w-4 h-4" />
                <span>Panel v2.1</span>
              </div>
              <div className="h-4 w-px bg-slate-800" />
              <div className="text-slate-400">Sosyal Medya Büyütme Aracı</div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex flex-col md:flex-row max-w-7xl mx-auto mt-8 px-4 gap-8">
        <aside className="w-full md:w-64 flex-shrink-0 space-y-2">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id as Tab)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium group ${
                activeTab === item.id
                  ? `${item.bg} ${item.color} border ${item.border}`
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}>
              <item.icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${activeTab === item.id ? item.color : ''}`} />
              {item.label}
            </button>
          ))}

          <div className="pt-8 mt-8 border-t border-slate-800">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-4 rounded-xl border border-slate-700">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">Durum</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs text-emerald-400 font-bold">API Bağlantısı Aktif</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 min-h-[600px] pb-12">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default App;