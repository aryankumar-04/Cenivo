import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Check, FileText, Loader2, X } from 'lucide-react';

export default function ImportSection() {
  const [activeImport, setActiveImport] = useState<string | null>(null);
  const [fileSelected, setFileSelected] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);

  const triggerImport = (source: string) => {
    setActiveImport(source);
    setFileSelected(false);
    setSuccess(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileSelected(true);
    }
  };

  const executeImport = () => {
    setImporting(true);
    setTimeout(() => {
      setImporting(false);
      setSuccess(true);
      setTimeout(() => {
        setActiveImport(null);
        setSuccess(false);
        setFileSelected(false);
      }, 2500);
    }, 2000);
  };

  return (
    <section id="importer" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#050505] relative overflow-hidden">
      <div className="max-w-4xl mx-auto w-full relative z-10">
        <div className="p-8 sm:p-12 bg-[#0B0B0B] border border-white/5 rounded-3xl relative overflow-hidden flex flex-col md:flex-row gap-12 items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
          {/* Left panel */}
          <div className="text-left space-y-6 max-w-lg">
            <h3 className="font-sans font-extrabold text-3xl sm:text-4xl text-white tracking-tight">
              Got ratings elsewhere?
            </h3>
            <p className="font-sans text-sm sm:text-base text-zinc-400 leading-relaxed">
              We've got you covered. You can easily import your existing ratings from other popular cinema portals and start getting accurate recommendations instantly.
            </p>

            {/* Platform badges matching screenshot */}
            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-1.5 font-sans font-bold text-sm text-[#FFFFFF]/90">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                <span>Letterboxd</span>
              </div>
              <div className="px-2.5 py-1 bg-white text-black font-extrabold text-[10px] uppercase tracking-wide rounded">
                IMDb
              </div>
              <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-400">
                <FileText className="w-4 h-4 text-zinc-500" />
                <span>CSV</span>
              </div>
            </div>
          </div>

          {/* Right panel (Links) */}
          <div className="w-full md:w-[320px] shrink-0 border-t md:border-t-0 md:border-l border-white/5 pt-8 md:pt-0 md:pl-10 space-y-2">
            {[
              { id: 'letterboxd', label: "Import your ratings from Letterboxd" },
              { id: 'imdb', label: "Import your ratings from IMDb" },
              { id: 'csv', label: "Import your ratings from a CSV file" }
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => triggerImport(option.label)}
                className="w-full p-4 flex items-center justify-between text-left text-sm font-sans font-semibold text-zinc-300 hover:text-white rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all group cursor-pointer"
              >
                <span>{option.label}</span>
                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic interactive Modal overlay within imported flow */}
        <AnimatePresence>
          {activeImport && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-md p-8 bg-[#0B0B0B] border border-white/10 rounded-2xl relative shadow-2xl text-left"
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
              >
                {/* Form closing */}
                <button
                  onClick={() => setActiveImport(null)}
                  className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-full bg-white/5 border border-white/5 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                <h4 className="font-sans font-bold text-xl text-white tracking-tight mb-2">
                  {activeImport}
                </h4>
                <p className="font-sans text-xs sm:text-sm text-zinc-400 mb-6">
                  Select your exported cinema history file (.csv or .json) to synchronize with your Cenivo profile.
                </p>

                {success ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
                    <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                      <Check className="w-6 h-6 text-white" />
                    </div>
                    <span className="font-sans font-bold text-base text-white">Import Complete!</span>
                    <span className="font-sans text-xs text-zinc-400">Synchronized 146 movie ratings to your dashboard.</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="border border-dashed border-white/10 hover:border-white/30 bg-white/5 p-6 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-colors relative">
                      <input
                        type="file"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <FileText className="w-8 h-8 text-zinc-400 mb-2" />
                      <span className="font-sans text-sm font-semibold text-white">
                        {fileSelected ? "File Selected!" : "Click to select file"}
                      </span>
                      <span className="font-sans text-xs text-[#A1A1AA] pt-1">
                        {fileSelected ? "Ready to import library" : "Supports CSV, XML, or JSON"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 justify-end">
                      <button
                        onClick={() => setActiveImport(null)}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-white transition-colors hover:bg-white/5 cursor-pointer"
                        disabled={importing}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={executeImport}
                        disabled={!fileSelected || importing}
                        className="px-5 py-2.5 rounded-lg text-sm font-semibold text-black bg-white hover:bg-zinc-200 disabled:bg-white/5 disabled:text-zinc-500 transition-all flex items-center gap-2 cursor-pointer shadow-md"
                      >
                        {importing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Synchronizing...
                          </>
                        ) : (
                          "Start Import"
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
