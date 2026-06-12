import React, { useState, useEffect, useCallback } from 'react';
import { 
  ChevronLeft, FileJson, FileSpreadsheet, Download,
  CheckCircle2, AlertTriangle, Eye, EyeOff
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import debounce from 'lodash/debounce';
import type { InvoiceData } from '../services/api';
import { apiService } from '../services/api';

interface InvoiceDashboardProps {
  initialData: InvoiceData;
  invoiceId: string;
  onBack: () => void;
}

export const InvoiceDashboard: React.FC<InvoiceDashboardProps> = ({ initialData, invoiceId, onBack }) => {
  const [data, setData] = useState<InvoiceData>(initialData);
  const [editorValue, setEditorValue] = useState<string>('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [showPdf, setShowPdf] = useState(true);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  
  const [exportLoading, setExportLoading] = useState<'json' | 'csv' | 'excel' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Initialize editor value from initial data (excluding confidence_details for cleaner editing)
  useEffect(() => {
    const editData = { ...initialData };
    if ('confidence_details' in editData) {
      delete editData.confidence_details;
    }
    setEditorValue(JSON.stringify(editData, null, 2));
  }, [initialData]);

  // Fetch rendered PDF page image paths from backend
  useEffect(() => {
    if (!invoiceId || !showPdf) return;

    const fetchPdfPages = async () => {
      setPdfLoading(true);
      setPdfError(null);
      try {
        const res = await apiService.getPdfPages(invoiceId);
        setPdfPages(res.pages);
      } catch (err) {
        console.error('Error fetching PDF pages:', err);
        setPdfError('Failed to render PDF pages for sync view.');
      } finally {
        setPdfLoading(false);
      }
    };

    fetchPdfPages();
  }, [invoiceId, showPdf]);

  // Debounced save function
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const autoSave = useCallback(
    debounce((parsedData: InvoiceData) => {
      // We don't have a backend save endpoint, but we update the local state 
      // which acts as the single source of truth for exports.
      setData(prev => ({
        ...parsedData,
        // Re-attach confidence details if they existed
        confidence_details: prev.confidence_details
      }));
      setIsSaving(false);
    }, 800),
    []
  );

  const handleEditorChange = (value: string | undefined) => {
    if (!value) return;
    setEditorValue(value);
    
    try {
      const parsed = JSON.parse(value);
      setJsonError(null);
      setIsSaving(true);
      autoSave(parsed);
    } catch (e: any) {
      setJsonError(e.message || 'Invalid JSON syntax');
      setIsSaving(false);
    }
  };

  // Trigger exports
  const handleExport = async (type: 'json' | 'csv' | 'excel') => {
    // If there is a json error, prevent export or use last valid state
    if (jsonError) {
      setExportError("Cannot export invalid JSON. Please fix syntax errors first.");
      return;
    }
    
    setExportLoading(type);
    setExportError(null);
    try {
      // Use current valid `data` (excluding confidence_details)
      const exportData = { ...data };
      if ('confidence_details' in exportData) {
        delete exportData.confidence_details;
      }
      
      if (type === 'json') {
        await apiService.exportJson(exportData);
      } else if (type === 'csv') {
        await apiService.exportCsv(exportData);
      } else if (type === 'excel') {
        await apiService.exportExcel(exportData);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setExportError(message || `Failed to export to ${type.toUpperCase()}`);
    } finally {
      setExportLoading(null);
    }
  };

  return (
    <div className={`w-full mx-auto px-4 py-6 space-y-6 animate-float-none transition-all duration-300 min-h-0 ${showPdf && invoiceId ? 'max-w-[1550px]' : 'max-w-6xl'} flex flex-col h-[calc(100vh-2rem)]`}>
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-dark-border pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2.5 rounded-xl border border-dark-border bg-dark-card hover:bg-dark-hover transition-colors text-dark-muted hover:text-white"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold font-sans tracking-wide">
              Invoice Document Editor
            </h1>
            <div className="flex items-center gap-3 mt-1 text-xs">
              <span className="text-dark-muted">Validate and edit extracted JSON directly.</span>
              
              {/* Validation Status */}
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md ${jsonError ? 'bg-red-500/10 text-red-400' : isSaving ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-400'}`}>
                {jsonError ? (
                  <><AlertTriangle size={14} /> <span>{jsonError}</span></>
                ) : isSaving ? (
                  <span>Saving...</span>
                ) : (
                  <><CheckCircle2 size={14} /> <span>Auto Saved ✓</span></>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* EXPORTS GROUP */}
        <div className="flex flex-wrap gap-3">
          {invoiceId && (
            <button
              onClick={() => setShowPdf(!showPdf)}
              className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all flex items-center gap-2 shadow ${
                showPdf 
                  ? 'bg-primary-950/45 text-primary-400 border-primary-500/30 hover:bg-primary-900/50' 
                  : 'bg-dark-card text-dark-muted border-dark-border hover:bg-dark-hover hover:text-white'
              }`}
            >
              {showPdf ? <EyeOff size={16} /> : <Eye size={16} />}
              {showPdf ? 'Hide PDF' : 'Compare PDF'}
            </button>
          )}

          <button
            onClick={() => handleExport('json')}
            disabled={exportLoading !== null}
            className="py-2 px-3 rounded-xl border border-dark-border bg-dark-card hover:bg-dark-hover hover:border-primary-500/20 text-sm font-medium text-gray-200 hover:text-white transition-all flex items-center gap-2 shadow"
          >
            <FileJson size={16} className="text-yellow-500" />
            {exportLoading === 'json' ? '...' : 'JSON'}
          </button>

          <button
            onClick={() => handleExport('csv')}
            disabled={exportLoading !== null}
            className="py-2 px-3 rounded-xl border border-dark-border bg-dark-card hover:bg-dark-hover hover:border-primary-500/20 text-sm font-medium text-gray-200 hover:text-white transition-all flex items-center gap-2 shadow"
          >
            <FileSpreadsheet size={16} className="text-emerald-500" />
            {exportLoading === 'csv' ? '...' : 'CSV'}
          </button>

          <button
            onClick={() => handleExport('excel')}
            disabled={exportLoading !== null}
            className="py-2 px-4 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-sm font-semibold text-white transition-all flex items-center gap-2 shadow-lg shadow-primary-950/40"
          >
            <Download size={16} />
            {exportLoading === 'excel' ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {exportError && (
        <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/30 text-red-200 text-sm flex-shrink-0">
          {exportError}
        </div>
      )}

      {/* Split Grid */}
      <div className={`flex-1 min-h-0 grid gap-6 items-stretch ${showPdf && invoiceId ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        
        {/* Left Panel: PDF Viewer */}
        {showPdf && invoiceId && (
          <div className="flex flex-col h-full rounded-xl border border-dark-border bg-dark-card shadow-2xl overflow-hidden">
            <div className="p-3 bg-dark-card/85 border-b border-dark-border flex items-center justify-between text-xs text-dark-muted flex-shrink-0">
              <span className="font-semibold text-gray-300">Original Invoice PDF</span>
              <a 
                href={`${import.meta.env.VITE_API_URL || 'http://localhost:8001'}/pdf/${invoiceId}`} 
                target="_blank" 
                rel="noreferrer"
                className="text-primary-400 hover:text-primary-300 hover:underline transition-all font-medium"
              >
                Open in new tab
              </a>
            </div>
            {pdfLoading ? (
              <div className="flex-1 flex items-center justify-center text-sm text-dark-muted">
                Rendering PDF pages...
              </div>
            ) : pdfError ? (
              <div className="flex-1 flex items-center justify-center text-sm text-red-400 p-4 text-center">
                {pdfError}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-dark/40 custom-scrollbar">
                {pdfPages.map((pageUrl, idx) => (
                  <div key={idx} className="relative rounded-lg overflow-hidden border border-dark-border bg-dark shadow-md">
                    <img 
                      src={`${import.meta.env.VITE_API_URL || 'http://localhost:8001'}${pageUrl}`} 
                      alt={`Invoice Page ${idx + 1}`} 
                      className="w-full h-auto object-contain"
                      loading="lazy"
                    />
                    <div className="absolute bottom-2 right-2 bg-dark/80 backdrop-blur px-2 py-1 rounded text-[10px] text-dark-muted font-mono font-bold">
                      Page {idx + 1} of {pdfPages.length}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Right Panel: JSON Editor */}
        <div className={`flex flex-col h-full rounded-xl border ${jsonError ? 'border-red-500/50' : 'border-dark-border'} bg-[#1e1e1e] shadow-2xl overflow-hidden`}>
          <div className="p-3 bg-[#2d2d2d] border-b border-[#3e3e3e] flex items-center justify-between text-xs text-dark-muted flex-shrink-0">
            <span className="font-semibold text-gray-300 font-mono">invoice.json</span>
            <span className="text-gray-400">Ctrl+F to Find, Ctrl+Z to Undo</span>
          </div>
          <div className="flex-1 min-h-0 pt-2">
            <Editor
              height="100%"
              defaultLanguage="json"
              theme="vs-dark"
              value={editorValue}
              onChange={handleEditorChange}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                lineNumbers: 'on',
                roundedSelection: true,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: 'on',
                formatOnPaste: true,
                tabSize: 2,
              }}
            />
          </div>
        </div>

      </div>
    </div>
  );
};
