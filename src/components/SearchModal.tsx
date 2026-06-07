import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Flame, Film, Tv, Sparkles, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { robustFetch } from '../lib/utils';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDetails: (movie: any) => void;
}

export default function SearchModal({ isOpen, onClose, onOpenDetails }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const [suggestions, setSuggestions] = useState<any[]>(() => {
    try {
      const stored = sessionStorage.getItem('cenivo_search_suggestions');
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return [
      { id: 101, title: "Dune: Part Two", type: "movie" },
      { id: 102, title: "Interstellar", type: "movie" },
      { id: 106, title: "Dark", type: "tv" },
      { id: 107, title: "Attack on Titan", type: "tv" },
      { id: 108, title: "Spirited Away", type: "movie" }
    ];
  });
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Lock body & html scroll of main website when search modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.height = '100vh';
      document.documentElement.style.height = '100vh';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.height = '';
      document.documentElement.style.height = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.height = '';
      document.documentElement.style.height = '';
    };
  }, [isOpen]);

  // Fetch dynamic suggestions from Gemini helper on opening
  useEffect(() => {
    if (isOpen) {
      const fetchSuggestions = async () => {
        setLoadingSuggestions(true);
        try {
          const response = await robustFetch('/api/search-suggestions');
          if (response.ok) {
            const data = await response.json();
            if (data.suggestions && Array.isArray(data.suggestions)) {
              let prev: string[] = [];
              try {
                const stored = sessionStorage.getItem('cenivo_prev_suggestions');
                if (stored) prev = JSON.parse(stored);
              } catch (_) {}

              let incoming = data.suggestions;
              let filtered = incoming.filter((item: any) => !prev.includes(item.title.toLowerCase()));

              if (filtered.length < 3) {
                filtered = incoming;
              }

              const finalSuggestions = filtered.slice(0, 5).map((x: any, idx: number) => ({
                id: 200 + idx,
                title: x.title,
                type: x.type
              }));

              setSuggestions(finalSuggestions);
              sessionStorage.setItem('cenivo_search_suggestions', JSON.stringify(finalSuggestions));

              const newPrev = Array.from(new Set([...prev, ...finalSuggestions.map((x: any) => x.title.toLowerCase())]));
              if (newPrev.length > 30) {
                newPrev.splice(0, newPrev.length - 30);
              }
              sessionStorage.setItem('cenivo_prev_suggestions', JSON.stringify(newPrev));
            }
          }
        } catch (err) {
          console.error("Failed to load search suggestions:", err);
        } finally {
          setLoadingSuggestions(false);
        }
      };

      fetchSuggestions();
    }
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      setQuery('');
      setResults([]);
      setSelectedIndex(-1);
    }
  }, [isOpen]);

  // Debounced TMDB Live Search Query fetching
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const response = await robustFetch(`/api/tmdb?path=search&query=${encodeURIComponent(query)}`);
        if (response.ok && active) {
          const data = await response.json();
          // Filter to items that have posters/backdrops for premium visual aesthetic
          const cleanResults = (data.results || []).filter(
            (item: any) => item.poster_path || item.backdrop_path
          );
          setResults(cleanResults.slice(0, 8));
        }
      } catch (err) {
        if (active) console.error('Error conducting TMDB live search:', err);
      } finally {
        if (active) setLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  // Keyboard navigation controller (Arrows and Enter keys)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelectItem(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSelectItem = (item: any) => {
    onClose();
    onOpenDetails(item);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-[#050505]/95 backdrop-blur-xl flex flex-col p-4 sm:p-8 font-sans text-white select-none"
          onKeyDown={handleKeyDown}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {/* Top Floating Row - Close control */}
          <div className="flex items-center justify-end max-w-5xl mx-auto w-full">
            <button
              onClick={onClose}
              className="p-3.5 rounded-full bg-zinc-900 border border-white/5 hover:border-white/15 text-zinc-400 hover:text-white cursor-pointer transition-all active:scale-95"
              title="Close Search Overlay"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Core Search Stage */}
          <div className="flex-1 max-w-3xl mx-auto w-full flex flex-col justify-start pt-12 sm:pt-20 space-y-10 min-h-0 overflow-hidden">
            
            {/* Main search bar input box */}
            <div className="relative border-b border-white/10 pb-4 flex items-center gap-4">
              <Search className="w-8 h-8 text-zinc-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(-1);
                }}
                placeholder="Search movies, TV series, anime..."
                className="w-full bg-transparent text-2xl sm:text-3xl font-bold tracking-tight text-white placeholder-zinc-600 focus:outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="text-zinc-500 hover:text-white text-xs font-mono border border-white/5 bg-zinc-900 px-2 py-1 rounded cursor-pointer"
                >
                  CLEAR
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pr-2 pb-12 cenivo-scrollbar scroll-smooth">
              
              {/* Show landing suggestions when input is empty */}
              {!query && (
                <div className="space-y-6 text-left">
                  <div className="flex items-center gap-2 text-zinc-400 font-mono text-xs uppercase tracking-widest font-extrabold pb-2 border-b border-white/5">
                    <TrendingUp className="w-4 h-4 text-zinc-400" />
                    <span>Trending Search Suggestions</span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {suggestions.map((item) => (
                      <button
                        key={item.id || item.title}
                        onClick={() => {
                          setQuery(item.title);
                          inputRef.current?.focus();
                        }}
                        className="px-5 py-4 bg-[#0B0B0B] hover:bg-[#111111] border border-white/5 rounded-xl text-left font-sans text-base text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center justify-between group active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3">
                          <Flame className="w-4 h-4 text-zinc-500 group-hover:text-white" />
                          <span className="font-semibold">{item.title}</span>
                        </div>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-500">
                          {item.type}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Results Grid layout when query is typed */}
              {query && (
                <div className="space-y-6 text-left">
                  <div className="flex items-center gap-2 text-zinc-400 font-mono text-xs uppercase tracking-widest font-extrabold pb-2 border-b border-white/5">
                    <Sparkles className="w-4 h-4 text-zinc-400" />
                    <span>
                      {loading ? "Searching indices..." : `About ${results.length} results matching "${query}"`}
                    </span>
                  </div>

                  {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-20 bg-zinc-900 border border-white/5 rounded-xl animate-pulse" />
                      ))}
                    </div>
                  ) : results.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {results.map((item, idx) => {
                        const imagePath = item.poster_path || item.backdrop_path;
                        const imageSrc = imagePath?.startsWith('http')
                          ? imagePath
                          : `https://image.tmdb.org/t/p/w200${imagePath}`;

                        const itemTitle = item.title || item.name;
                        const year = (item.release_date || item.first_air_date || '').substring(0, 4);
                        const isSelected = selectedIndex === idx;

                        return (
                          <div
                            key={item.id}
                            onClick={() => handleSelectItem(item)}
                            className={`p-3 bg-[#0B0B0B] hover:bg-[#111111] border rounded-xl flex items-center justify-between gap-4 cursor-pointer transition-all ${
                              isSelected 
                                ? "border-white bg-[#111111] scale-[1.01]" 
                                : "border-white/5 hover:border-white/20"
                            }`}
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              {/* Small preview avatar */}
                              <div className="w-10 h-14 bg-zinc-900 rounded overflow-hidden shrink-0 border border-white/5">
                                {imageSrc ? (
                                  <img
                                    src={imageSrc}
                                    alt={itemTitle}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-zinc-800" />
                                )}
                              </div>

                              <div className="text-left min-w-0">
                                <h4 className="font-sans font-bold text-base text-white truncate">
                                  {itemTitle}
                                </h4>
                                <div className="flex items-center gap-2 pt-0.5">
                                  {year && (
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/5 border border-white/10 text-zinc-400">
                                      {year}
                                    </span>
                                  )}
                                  <span className="text-xs text-zinc-500 font-mono flex items-center gap-1 capitalize">
                                    {item.media_type === "tv" ? <Tv className="w-3 h-3 text-zinc-500" /> : <Film className="w-3 h-3 text-zinc-500" />}
                                    {item.media_type || "movie"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              {item.vote_average && (
                                <div className="flex items-center gap-1 px-2 py-1 rounded bg-[#111111] border border-white/5 text-xs text-[#E5E5E5] font-bold">
                                  ★ {item.vote_average.toFixed(1)}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-zinc-500 text-sm font-sans">
                      No results found matching "{query}". Try searching for another blockbuster title.
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

        </motion.div>
      )}
    </AnimatePresence>
  );
}
