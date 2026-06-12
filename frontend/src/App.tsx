import React, { useState, useEffect, useRef } from 'react';
import { FileSearch, UploadCloud } from 'lucide-react';
import { UploadCard } from './components/UploadCard';
import { LoadingProgress } from './components/LoadingProgress';
import { InvoiceDashboard } from './components/InvoiceDashboard';
import type { InvoiceData } from './services/api';
import { apiService } from './services/api';

type ViewState = 'upload' | 'loading' | 'dashboard';

export const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('upload');
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isGlobalDragActive, setIsGlobalDragActive] = useState(false);

  // Refs for event listeners
  const viewRef = useRef(view);
  const handleFileSelectRef = useRef<((file: File, workflow: 'digital' | 'scanned' | 'handwritten') => void) | undefined>(undefined);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Track mouse for interactive background glow
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Global drag events
  useEffect(() => {
    let dragCounter = 0;
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (viewRef.current !== 'upload') return;
      dragCounter++;
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        setIsGlobalDragActive(true);
      }
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (viewRef.current !== 'upload') return;
      dragCounter--;
      if (dragCounter === 0) {
        setIsGlobalDragActive(false);
      }
    };
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (viewRef.current !== 'upload') return;
      setIsGlobalDragActive(false);
      dragCounter = 0;
      if (e.dataTransfer?.files && e.dataTransfer.files[0] && handleFileSelectRef.current) {
        // Default to digital PDF on global drop
        handleFileSelectRef.current(e.dataTransfer.files[0], 'digital');
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  // Smooth loading progression animator
  useEffect(() => {
    if (view !== 'loading' || errorMsg) return;

    const timers: number[] = [];

    // Step 0: Uploading PDF (starts immediately at 0)
    
    // Step 1: Extracting Content (simulated after 1s)
    timers.push(
      window.setTimeout(() => {
        setCurrentStep(1);
      }, 1200)
    );

    // Step 2: Running AI Analysis (simulated after 3s)
    timers.push(
      window.setTimeout(() => {
        setCurrentStep(2);
      }, 3500)
    );

    // Step 3: Generating Structured Output (simulated after 6s)
    timers.push(
      window.setTimeout(() => {
        setCurrentStep(3);
      }, 6500)
    );

    return () => {
      timers.forEach(t => window.clearTimeout(t));
    };
  }, [view, errorMsg]);

  const handleFileSelect = async (file: File, workflow: 'digital' | 'scanned' | 'handwritten') => {
    setView('loading');
    setCurrentStep(0);
    setErrorMsg(null);
    setInvoiceData(null);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let result: any;
      if (workflow === 'digital') {
        result = await apiService.uploadDigital(file);
      } else if (workflow === 'scanned') {
        result = await apiService.uploadScanned(file);
      } else if (workflow === 'handwritten') {
        result = await apiService.uploadHandwritten(file);
      }

      // Fast-forward to completed state
      setCurrentStep(4);
      
      // Delay slightly for smooth completion visual transition
      setTimeout(() => {
        setInvoiceId(result.id);
        setInvoiceData(result.data);
        if (result.processing_time) setProcessingTime(result.processing_time);
        setView('dashboard');
      }, 800);

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message || 'An unexpected error occurred during analysis.');
    }
  };

  const handleBackToUpload = () => {
    setView('upload');
    setInvoiceId(null);
    setInvoiceData(null);
    setProcessingTime(null);
    setErrorMsg(null);
  };

  useEffect(() => {
    handleFileSelectRef.current = handleFileSelect;
  }, [handleFileSelect]);

  return (
    <div className="min-h-screen bg-dark text-white flex flex-col relative overflow-hidden">
      {/* Global Drag Drop Overlay */}
      {isGlobalDragActive && view === 'upload' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark/80 backdrop-blur-sm border-4 border-dashed border-primary-500 pointer-events-none">
          <div className="text-primary-400 text-3xl font-bold font-sans flex flex-col items-center gap-4 bg-dark-card/90 p-12 rounded-3xl border border-primary-500/30 shadow-2xl">
            <UploadCloud size={80} className="animate-bounce text-primary-500" />
            Drop anywhere to upload
            <p className="text-sm text-dark-muted font-normal mt-2">Will be processed as a standard Digital PDF</p>
          </div>
        </div>
      )}

      {/* Background Glow Blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary-600/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-accent-cyan/10 blur-[150px] pointer-events-none"></div>

      {/* TOP NAVBAR */}
      <header className="border-b border-dark-border/60 bg-dark-card/30 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={handleBackToUpload}>
            <div className="p-2 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white shadow-md shadow-primary-950/20">
              <FileSearch size={22} />
            </div>
            <div>
              <span className="font-extrabold font-sans tracking-wide text-lg bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                AI Invoice Parser
              </span>
              <span className="text-[10px] text-primary-400 font-bold tracking-widest uppercase ml-2 bg-primary-950/60 border border-primary-500/20 py-0.5 px-1.5 rounded">
                v1.0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-dark-muted font-medium">
            {processingTime !== null && view === 'dashboard' && (
              <span className="hidden sm:inline bg-dark-input border border-dark-border px-2 py-1 rounded text-primary-400 font-mono">
                Processed in {processingTime.toFixed(2)}s
              </span>
            )}
            <span className="hidden sm:inline">Cloud AI: Gemini 3.5 Flash</span>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          </div>
        </div>
      </header>

      {/* MAIN VIEW ROUTING */}
      <main className="flex-1 flex items-center justify-center py-12 relative z-10 w-full min-h-[600px]">
        {/* Interactive Mouse Glow Background */}
        <div 
          className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-500 opacity-60"
          style={{
            background: `radial-gradient(circle 600px at ${mousePos.x}px ${mousePos.y}px, rgba(99, 102, 241, 0.15), transparent 80%)`
          }}
        />

        {view === 'upload' && (
          <div className="w-full relative">
            <div className="relative z-10 w-full space-y-12">
              <div className="text-center space-y-4 px-4 pt-10">
                <h1 className="text-4xl md:text-5xl font-extrabold font-sans tracking-tight leading-none drop-shadow-lg">
                  Parse Invoices with{' '}
                  <span className="bg-gradient-to-r from-primary-400 via-indigo-400 to-accent-cyan bg-clip-text text-transparent">
                    Gemini AI
                  </span>
                </h1>
                <p className="text-dark-muted text-sm md:text-base max-w-xl mx-auto leading-relaxed drop-shadow-md bg-dark-card/50 backdrop-blur-sm p-4 rounded-xl border border-dark-border/50">
                  Extract line items, company metadata, taxes, and totals from digital invoices 
                  or scanned blurry receipts instantly. Run securely in the cloud.
                </p>
              </div>

              <UploadCard onFileSelect={handleFileSelect} />
            </div>
          </div>
        )}

        {view === 'loading' && (
          <div className="w-full">
            <LoadingProgress currentStep={currentStep} errorMsg={errorMsg || undefined} />
            {errorMsg && (
              <div className="text-center mt-6">
                <button
                  onClick={handleBackToUpload}
                  className="py-2 px-6 rounded-xl border border-dark-border bg-dark-card hover:bg-dark-hover transition-colors text-sm font-semibold"
                >
                  Return to Upload
                </button>
              </div>
            )}
          </div>
        )}

        {view === 'dashboard' && invoiceData && (
          <InvoiceDashboard 
            initialData={invoiceData} 
            invoiceId={invoiceId || ''} 
            onBack={handleBackToUpload} 
          />
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-dark-border/40 py-6 text-center text-xs text-dark-muted">
        <div className="max-w-6xl mx-auto px-6">
          <p>© {new Date().getFullYear()} AI Invoice Parser. Engineered with React, TypeScript, and FastAPI.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
