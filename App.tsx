
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Sparkles, 
  Download, 
  RotateCcw, 
  MessageSquarePlus,
  ArrowRight,
  Trash2,
  AlertCircle,
  Eye,
  EyeOff,
  FileText,
  RefreshCw,
  Clock,
  Eraser,
  XCircle
} from 'lucide-react';
import FileUploader from './components/FileUploader';
import LoadingOverlay from './components/LoadingOverlay';
import { purifyTranscript } from './services/geminiService';
import { AppStatus, PurificationResult } from './types';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [originalText, setOriginalText] = useState("");
  const [fileName, setFileName] = useState("");
  const [purifiedResult, setPurifiedResult] = useState<PurificationResult | null>(null);
  const [editedPurifiedText, setEditedPurifiedText] = useState("");
  const [userHints, setUserHints] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'original' | 'purified'>('purified');
  const [showDiff, setShowDiff] = useState(true);
  
  const [cooldown, setCooldown] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (purifiedResult) {
      setEditedPurifiedText(purifiedResult.purifiedText);
      setActiveTab('purified');
    }
  }, [purifiedResult]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  useEffect(() => {
    let timer: any;
    if (confirmReset) {
      timer = setTimeout(() => setConfirmReset(false), 3000);
    }
    return () => clearTimeout(timer);
  }, [confirmReset]);

  const handleFileUpload = (text: string, name: string) => {
    setOriginalText(text);
    setFileName(name);
    setStatus(AppStatus.REVIEWING);
    setPurifiedResult(null);
    setEditedPurifiedText("");
    setError(null);
    setConfirmReset(false);
  };

  const startPurification = async () => {
    if (!originalText || cooldown > 0) return;
    setStatus(AppStatus.LOADING);
    setError(null);
    try {
      const result = await purifyTranscript(originalText, userHints);
      setPurifiedResult(result);
      setStatus(AppStatus.REVIEWING);
    } catch (err: any) {
      if (err.message === "RATE_LIMIT_EXCEEDED") {
        setError("触发 API 频率限制：请等待冷静期结束再试。");
        setCooldown(20); 
      } else {
        setError(err.message || "连接服务超时，请重试。");
      }
      setStatus(AppStatus.REVIEWING);
    }
  };

  const handleDownload = () => {
    const finalContent = editedPurifiedText || (purifiedResult?.purifiedText) || originalText;
    if (!finalContent) return;
    const blob = new Blob([finalContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `净化后_${fileName || 'transcript.txt'}`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 200);
  };

  // 修复重置逻辑
  const reset = useCallback(() => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    
    // 强制清理所有状态
    setOriginalText("");
    setFileName("");
    setPurifiedResult(null);
    setEditedPurifiedText("");
    setUserHints("");
    setError(null);
    setCooldown(0);
    setConfirmReset(false);
    setActiveTab('purified');
    setStatus(AppStatus.IDLE);
  }, [confirmReset]);

  const renderedDiffText = useMemo(() => {
    if (!purifiedResult || !editedPurifiedText) return editedPurifiedText;
    const sortedCorrections = [...purifiedResult.corrections].sort((a, b) => b.corrected.length - a.corrected.length);
    let text = editedPurifiedText;
    const parts: React.ReactNode[] = [];
    const segments: { start: number; end: number; correction: any }[] = [];
    
    sortedCorrections.forEach(c => {
      let pos = text.indexOf(c.corrected);
      while (pos !== -1) {
        const isOverlapping = segments.some(s => (pos >= s.start && pos < s.end) || (pos + c.corrected.length > s.start && pos + c.corrected.length <= s.end));
        if (!isOverlapping) segments.push({ start: pos, end: pos + c.corrected.length, correction: c });
        pos = text.indexOf(c.corrected, pos + 1);
      }
    });
    
    segments.sort((a, b) => a.start - b.start);
    let currentPos = 0;
    
    segments.forEach((s, i) => {
      if (s.start > currentPos) {
        const prefix = text.substring(currentPos, s.start);
        parts.push(prefix);
      }
      
      parts.push(
        <span key={i} className="relative group inline-block">
          <span className="font-bold text-blue-600 underline decoration-blue-200 decoration-2 underline-offset-4 cursor-help transition-all hover:bg-blue-50 px-0.5 rounded">
            {s.correction.corrected}
          </span>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 text-white text-[11px] rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl pointer-events-none">
            <div className="flex items-center gap-2 mb-1 text-slate-400 font-bold uppercase tracking-widest text-[9px]">
              <RotateCcw className="w-3 h-3" /> 修改详情
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="line-through text-red-400 opacity-80">{s.correction.original}</span>
                <ArrowRight className="w-3 h-3 text-slate-500" />
                <span className="text-blue-300 font-bold">{s.correction.corrected}</span>
              </div>
              <p className="text-slate-300 italic border-t border-slate-700 pt-1 mt-1 leading-relaxed">{s.correction.reason}</p>
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
          </div>
        </span>
      );
      currentPos = s.end;
    });
    
    if (currentPos < text.length) {
      parts.push(text.substring(currentPos));
    }
    
    return parts.length > 0 ? parts : editedPurifiedText;
  }, [editedPurifiedText, purifiedResult]);

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex flex-col font-sans">
      {status === AppStatus.LOADING && <LoadingOverlay />}

      <nav className="h-16 border-b bg-white/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-100">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <span className="font-extrabold text-slate-800 tracking-tight">文字稿净化器</span>
          <span className="ml-2 px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-400 uppercase tracking-tighter">Gemini v2.1</span>
        </div>
        
        {status !== AppStatus.IDLE && (
          <div className="flex items-center gap-3">
            <button onClick={handleDownload} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-100">
              <Download className="w-4 h-4" /> 导出
            </button>
            <button 
              onClick={reset} 
              title={confirmReset ? "确认清空" : "清空"} 
              className={`p-2 transition-all rounded-full ${confirmReset ? 'bg-red-500 text-white scale-110' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`}
            >
              {confirmReset ? <XCircle className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
            </button>
          </div>
        )}
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 flex flex-col min-h-0">
        {status === AppStatus.IDLE ? (
          <div className="max-w-xl mx-auto mt-20 text-center animate-in fade-in zoom-in-95 duration-500">
            <h1 className="text-5xl font-black text-slate-900 mb-6 tracking-tighter">高保真逐字稿净化</h1>
            <p className="text-slate-500 mb-10 text-lg leading-relaxed">基于精准识别模型，仅去除口癖与转录错误，保留完整逻辑与细节。</p>
            <FileUploader onTextLoaded={handleFileUpload} />
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 h-full min-h-0">
            <div className="lg:w-80 flex flex-col gap-6 shrink-0">
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 text-blue-600 font-bold mb-4">
                  <MessageSquarePlus className="w-5 h-5" />
                  名词与逻辑修正
                </div>
                <textarea
                  value={userHints}
                  onChange={(e) => setUserHints(e.target.value)}
                  placeholder="如：'小明' 应为 '晓鸣'，'AI' 应为 '人工智能'..."
                  className="w-full h-40 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-4 focus:ring-blue-50 focus:border-blue-400 outline-none transition-all resize-none mb-6 font-medium"
                />
                
                <div className="space-y-3">
                  <button
                    disabled={cooldown > 0}
                    onClick={startPurification}
                    className={`w-full font-bold py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 ${
                      cooldown > 0 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100'
                    }`}
                  >
                    {cooldown > 0 ? (
                      <><Clock className="w-4 h-4" /> 冷却中 ({cooldown}s)</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> 开始净化</>
                    )}
                  </button>

                  <button
                    onClick={reset}
                    className={`w-full font-bold py-3 rounded-2xl border transition-all flex items-center justify-center gap-2 ${
                      confirmReset 
                      ? 'bg-red-500 border-red-600 text-white animate-pulse shadow-lg shadow-red-100' 
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {confirmReset ? <><XCircle className="w-4 h-4" /> 确定要清空吗？</> : <><Eraser className="w-4 h-4" /> 清空文档</>}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-0 relative">
              {error && (
                <div className="absolute inset-x-0 top-0 z-40 p-4 bg-red-50 border-b border-red-100 text-red-700 flex items-center justify-between animate-in slide-in-from-top duration-300">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-sm">净化失败</p>
                      <p className="text-xs mt-0.5 opacity-90">{error}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setError(null)} className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-600">忽略</button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between px-5 py-3 border-b bg-slate-50/50">
                <div className="flex gap-1 bg-slate-200/50 p-1 rounded-xl">
                  <button onClick={() => setActiveTab('original')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'original' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>原始内容</button>
                  <button onClick={() => setActiveTab('purified')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'purified' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>净化成品</button>
                </div>
                {activeTab === 'purified' && purifiedResult && (
                  <button onClick={() => setShowDiff(!showDiff)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${showDiff ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                    {showDiff ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    修订标记
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-hidden">
                {activeTab === 'original' ? (
                  <textarea value={originalText} onChange={(e) => setOriginalText(e.target.value)} className="w-full h-full p-8 md:p-12 outline-none resize-none text-slate-600 leading-relaxed text-lg font-normal bg-transparent" />
                ) : (
                  <div className="h-full flex flex-col">
                    {showDiff && purifiedResult ? (
                      <div className="w-full h-full p-8 md:p-12 overflow-y-auto text-slate-900 leading-relaxed text-lg font-medium whitespace-pre-wrap select-text">
                        {renderedDiffText}
                      </div>
                    ) : (
                      <textarea value={editedPurifiedText} onChange={(e) => setEditedPurifiedText(e.target.value)} className="w-full h-full p-8 md:p-12 outline-none resize-none text-slate-900 leading-relaxed text-lg font-medium bg-transparent" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="h-10 border-t bg-white flex items-center justify-between px-8 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <FileText className="w-3 h-3" />
            <span>{fileName || "无文件"}</span>
          </div>
          <span>{editedPurifiedText.length || originalText.length} 字</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-red-500' : 'bg-green-500'}`}></div>
          精准修复模式
        </div>
      </footer>
    </div>
  );
};

export default App;
