import React from 'react';
import { CheckCircle2, Loader2, Circle } from 'lucide-react';

interface LoadingProgressProps {
  currentStep: number; // 0 to 4
  errorMsg?: string;
}

const pipelineSteps = [
  { label: 'Uploading PDF', desc: 'Saving document securely to backend workspace.' },
  { label: 'Extracting Content', desc: 'Parsing digital layout or running PaddleOCR image scanner.' },
  { label: 'Running AI Analysis', desc: 'Querying Gemini to extract values and map fields.' },
  { label: 'Generating Structured Output', desc: 'Validating invoice schema and generating JSON payload.' },
  { label: 'Completed', desc: 'Invoice parsed successfully! Rendering editor dashboard.' },
];

export const LoadingProgress: React.FC<LoadingProgressProps> = ({ currentStep, errorMsg }) => {
  return (
    <div className="max-w-md mx-auto w-full px-6 py-10 glass-panel rounded-2xl border border-primary-500/10 shadow-2xl relative overflow-hidden animate-float">
      {/* Glow Ambient Effect */}
      <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary-500/10 rounded-full blur-2xl pointer-events-none"></div>
      <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-accent-cyan/10 rounded-full blur-2xl pointer-events-none"></div>

      <h3 className="text-xl font-bold font-sans text-center mb-1 bg-gradient-to-r from-primary-400 to-accent-cyan bg-clip-text text-transparent">
        Processing Invoice
      </h3>
      <p className="text-xs text-dark-muted text-center mb-8">Please wait while the AI parses your invoice details</p>

      {errorMsg ? (
        <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 text-red-200 text-sm text-center relative z-10">
          <p className="font-semibold mb-1">Process Interrupted</p>
          <p className="text-xs opacity-80">{errorMsg}</p>
        </div>
      ) : (
        <div className="space-y-6 relative z-10">
          {pipelineSteps.map((step, idx) => {
            const isCompleted = idx < currentStep;
            const isActive = idx === currentStep;
            const isPending = idx > currentStep;

            return (
              <div 
                key={idx} 
                className={`flex gap-4 items-start transition-opacity duration-300 ${
                  isPending ? 'opacity-40' : 'opacity-100'
                }`}
              >
                {/* Stepper Icon */}
                <div className="mt-1 flex-shrink-0">
                  {isCompleted && (
                    <CheckCircle2 className="text-emerald-400 w-6 h-6 animate-pulse-slow" />
                  )}
                  {isActive && (
                    <div className="relative">
                      <div className="absolute -inset-1 rounded-full bg-primary-500/30 blur animate-ping"></div>
                      <Loader2 className="text-primary-400 w-6 h-6 animate-spin relative" />
                    </div>
                  )}
                  {isPending && (
                    <Circle className="text-dark-border w-6 h-6" />
                  )}
                </div>

                {/* Step Metadata */}
                <div>
                  <h4 className={`font-semibold text-sm ${
                    isActive ? 'text-primary-400 glow-text' : isCompleted ? 'text-emerald-400/90' : 'text-gray-300'
                  }`}>
                    {step.label}
                  </h4>
                  <p className="text-xs text-dark-muted mt-1 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
