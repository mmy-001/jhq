
import React, { useRef, useState } from 'react';
import { Upload, FileText, Loader2, FileWarning } from 'lucide-react';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs`;

interface FileUploaderProps {
  onTextLoaded: (text: string, fileName: string) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onTextLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const extractPdfText = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    try {
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }
      return fullText;
    } catch (err) {
      console.error('PDF Extraction Error:', err);
      throw new Error('无法读取 PDF 文件内容，请确保文件未加密或损坏。');
    }
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    try {
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
        const text = await file.text();
        onTextLoaded(text, file.name);
      } 
      else if (fileName.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        onTextLoaded(result.value, file.name);
      } 
      else if (fileName.endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        const text = await extractPdfText(arrayBuffer);
        if (!text.trim()) {
          throw new Error('PDF 似乎是扫描件或不包含可识别的文本内容。');
        }
        onTextLoaded(text, file.name);
      } 
      else {
        throw new Error('暂不支持此文件格式。请上传 .txt, .md, .docx 或 .pdf 文件。');
      }
    } catch (err: any) {
      setError(err.message || '文件处理失败');
      console.error('File processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div className="w-full">
      <div 
        className={`relative border-2 border-dashed rounded-3xl p-12 transition-all duration-300 flex flex-col items-center justify-center cursor-pointer min-h-[300px]
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xl hover:shadow-slate-100'}
          ${isProcessing ? 'pointer-events-none opacity-80' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleFileChange}
          accept=".txt,.md,.docx,.pdf"
        />
        
        <div className={`p-5 rounded-2xl mb-6 transition-colors ${error ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-600'}`}>
          {isProcessing ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : error ? (
            <FileWarning className="w-8 h-8" />
          ) : (
            <Upload className="w-8 h-8" />
          )}
        </div>
        
        <h3 className={`text-xl font-bold mb-3 ${error ? 'text-red-600' : 'text-slate-800'}`}>
          {isProcessing ? '正在处理文件...' : error ? '处理出错' : '上传您的文字稿'}
        </h3>
        
        <p className="text-slate-400 text-center max-w-sm text-sm leading-relaxed">
          {error ? error : '拖拽文件到这里，或点击上传。支持 TXT, MD, DOCX 和 PDF。'}
        </p>
        
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          {['.TXT', '.MD', '.DOCX', '.PDF'].map(ext => (
            <span key={ext} className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 tracking-wider">
              {ext}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-8 flex justify-center gap-8 opacity-40">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-widest">Windows / Mac</span>
        </div>
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-widest">iOS / Android</span>
        </div>
      </div>
    </div>
  );
};

export default FileUploader;
