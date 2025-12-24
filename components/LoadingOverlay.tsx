
import React, { useState, useEffect } from 'react';

const MESSAGES = [
  "正在深入理解上下文...",
  "正在修补歧义词汇...",
  "消除冗余口癖中...",
  "优化句子结构...",
  "正在为您净化文字稿..."
];

const LoadingOverlay: React.FC = () => {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="relative w-20 h-20 mb-8">
        <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-4 animate-pulse">
        {MESSAGES[msgIndex]}
      </h2>
      <p className="text-slate-500 max-w-md">
        这是深度 AI 修复过程，通常需要 10-20 秒。请稍候，我们将呈现最通顺的成品。
      </p>
    </div>
  );
};

export default LoadingOverlay;
