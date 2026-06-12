import React, { useState, useRef } from 'react';
import { FileText, Scan, UploadCloud, PenTool } from 'lucide-react';
import Tilt from 'react-parallax-tilt';

interface UploadCardProps {
  onFileSelect: (file: File, workflow: 'digital' | 'scanned' | 'handwritten') => void;
}

export const UploadCard: React.FC<UploadCardProps> = ({ onFileSelect }) => {
  const [dragActiveWorkflow, setDragActiveWorkflow] = useState<'digital' | 'scanned' | 'handwritten' | null>(null);

  const digitalInputRef = useRef<HTMLInputElement>(null);
  const scannedInputRef = useRef<HTMLInputElement>(null);
  const handwrittenInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent, workflow: 'digital' | 'scanned' | 'handwritten') => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActiveWorkflow(workflow);
    } else if (e.type === "dragleave") {
      setDragActiveWorkflow(null);
    }
  };

  const handleDrop = (e: React.DragEvent, workflow: 'digital' | 'scanned' | 'handwritten') => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveWorkflow(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf" || file.name.endsWith('.pdf')) {
        onFileSelect(file, workflow);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, workflow: 'digital' | 'scanned' | 'handwritten') => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0], workflow);
    }
  };

  return (
    <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto w-full px-4">
      {/* CARD 1: DIGITAL PDF */}
      <Tilt tiltMaxAngleX={8} tiltMaxAngleY={8} perspective={1000} scale={1.02} transitionSpeed={2000} glareEnable={true} glareMaxOpacity={0.15} glareColor="#818cf8" glarePosition="all" className="h-full rounded-2xl">
      <div
        onDragEnter={(e) => handleDrag(e, 'digital')}
        onDragOver={(e) => handleDrag(e, 'digital')}
        onDragLeave={(e) => handleDrag(e, 'digital')}
        onDrop={(e) => handleDrop(e, 'digital')}
        className={`h-full glow-card glass-panel rounded-2xl p-8 flex flex-col items-center justify-between text-center transition-all duration-300 transform cursor-pointer ${dragActiveWorkflow === 'digital'
            ? 'ring-2 ring-primary-500 bg-primary-950/20'
            : 'border border-dark-border/60 hover:border-primary-500/30'
          }`}
        onClick={() => digitalInputRef.current?.click()}
      >
        <input
          ref={digitalInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => handleFileChange(e, 'digital')}
        />

        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-500/10 flex items-center justify-center mb-6 text-primary-400 group-hover:scale-110 transition-transform">
            <FileText size={36} />
          </div>
          <h2 className="text-2xl font-bold font-sans tracking-wide mb-3">Digital PDF</h2>
          <p className="text-dark-muted text-sm leading-relaxed max-w-xs mb-6">
            Upload machine-generated digital invoices. Extracts text directly with 100% precision.
          </p>
        </div>

        <button
          type="button"
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-primary-950/50 flex items-center justify-center gap-2 group transition-all"
        >
          <UploadCloud size={20} className="group-hover:translate-y-[-2px] transition-transform" />
          Upload Digital PDF
        </button>
      </div>
      </Tilt>

      {/* CARD 2: SCANNED / NOISY / BLURRY PDF */}
      <Tilt tiltMaxAngleX={8} tiltMaxAngleY={8} perspective={1000} scale={1.02} transitionSpeed={2000} glareEnable={true} glareMaxOpacity={0.15} glareColor="#22d3ee" glarePosition="all" className="h-full rounded-2xl">
      <div
        onDragEnter={(e) => handleDrag(e, 'scanned')}
        onDragOver={(e) => handleDrag(e, 'scanned')}
        onDragLeave={(e) => handleDrag(e, 'scanned')}
        onDrop={(e) => handleDrop(e, 'scanned')}
        className={`h-full glow-card glass-panel rounded-2xl p-8 flex flex-col items-center justify-between text-center transition-all duration-300 transform cursor-pointer ${dragActiveWorkflow === 'scanned'
            ? 'ring-2 ring-accent-cyan bg-cyan-950/20'
            : 'border border-dark-border/60 hover:border-accent-cyan/30'
          }`}
        onClick={() => scannedInputRef.current?.click()}
      >
        <input
          ref={scannedInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => handleFileChange(e, 'scanned')}
        />

        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6 text-accent-cyan">
            <Scan size={36} />
          </div>
          <h2 className="text-2xl font-bold font-sans tracking-wide mb-3">Scanned / Noisy PDF</h2>
          <p className="text-dark-muted text-sm leading-relaxed max-w-xs mb-6">
            Upload scanned, noisy, low-quality, or blurred invoices. Analyzed with PaddleOCR + Gemini.
          </p>
        </div>

        <button
          type="button"
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-medium shadow-lg shadow-cyan-950/50 flex items-center justify-center gap-2 group transition-all"
        >
          <UploadCloud size={20} className="group-hover:translate-y-[-2px] transition-transform" />
          Upload Scanned PDF
        </button>
      </div>
      </Tilt>

      {/* CARD 3: HANDWRITTEN PDF */}
      <Tilt tiltMaxAngleX={8} tiltMaxAngleY={8} perspective={1000} scale={1.02} transitionSpeed={2000} glareEnable={true} glareMaxOpacity={0.15} glareColor="#d946ef" glarePosition="all" className="h-full rounded-2xl">
      <div
        onDragEnter={(e) => handleDrag(e, 'handwritten')}
        onDragOver={(e) => handleDrag(e, 'handwritten')}
        onDragLeave={(e) => handleDrag(e, 'handwritten')}
        onDrop={(e) => handleDrop(e, 'handwritten')}
        className={`h-full glow-card glass-panel rounded-2xl p-8 flex flex-col items-center justify-between text-center transition-all duration-300 transform cursor-pointer ${dragActiveWorkflow === 'handwritten'
            ? 'ring-2 ring-purple-500 bg-purple-950/20'
            : 'border border-dark-border/60 hover:border-purple-500/30'
          }`}
        onClick={() => handwrittenInputRef.current?.click()}
      >
        <input
          ref={handwrittenInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => handleFileChange(e, 'handwritten')}
        />

        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 text-purple-400 group-hover:scale-110 transition-transform">
            <PenTool size={36} />
          </div>
          <h2 className="text-2xl font-bold font-sans tracking-wide mb-3">Handwritten PDF</h2>
          <p className="text-dark-muted text-sm leading-relaxed max-w-xs mb-6">
            Upload handwritten invoices or forms. Analyzed directly using Gemini's Multimodal Vision.
          </p>
        </div>

        <button
          type="button"
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-medium shadow-lg shadow-purple-950/50 flex items-center justify-center gap-2 group transition-all"
        >
          <UploadCloud size={20} className="group-hover:translate-y-[-2px] transition-transform" />
          Upload Handwritten PDF
        </button>
      </div>
      </Tilt>

    </div>
  );
};
