import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, SlidersHorizontal, X, ChevronDown, Bookmark, 
  MonitorPlay, Calendar, Star, Globe, Trophy, Film, Zap, 
  Clock, Shield, LayoutGrid, Check, Settings, Sparkles, Filter, Users, PlayCircle, EyeOff, LayoutPanelLeft, Hash,
  Tv, TrendingUp, CalendarDays, Target, Smile, VenetianMask, Wand2, Compass, Heart, Palette, Book
} from 'lucide-react';

interface RecommendationTabProps {
  currentUser?: any;
  onOpenMovieDetails?: (movie: any) => void;
  watchlistIds?: string[];
  onAddToWatchlist?: (item: any) => Promise<void>;
}

// Data Constants
const QUICK_CHIPS = [
  { label: 'Movies', icon: Film },
  { label: 'Series', icon: Tv },
  { label: 'Anime', icon: Sparkles },
  { label: 'Trending', icon: TrendingUp },
  { label: 'Top Rated', icon: Star },
  { label: 'New Releases', icon: CalendarDays },
  { label: 'Oscar Winners', icon: Trophy },
  { label: 'Sci-Fi', icon: Globe },
  { label: 'Thriller', icon: Target },
  { label: 'Action', icon: Zap },
  { label: 'Comedy', icon: Smile },
  { label: 'Drama', icon: VenetianMask },
  { label: 'Mystery', icon: Search },
  { label: 'Crime', icon: Shield },
  { label: 'Fantasy', icon: Wand2 },
  { label: 'Adventure', icon: Compass },
  { label: 'Romance', icon: Heart },
  { label: 'Animation', icon: Palette },
  { label: 'Family', icon: Users },
  { label: 'Documentary', icon: Book }
];

const SEARCH_PLACEHOLDERS = [
  "Movies like Interstellar",
  "Dark Korean thrillers",
  "Mind bending sci-fi",
  "Time travel movies after 2010"
];

const CATEGORIES = [
  { id: 'basic', label: 'Basic', icon: <MonitorPlay className="w-4 h-4" /> },
  { id: 'release', label: 'Release & Ratings', icon: <Calendar className="w-4 h-4" /> },
  { id: 'genres', label: 'Genres & Keywords', icon: <Hash className="w-4 h-4" /> },
  { id: 'people', label: 'People & Cast', icon: <Users className="w-4 h-4" /> },
  { id: 'awards', label: 'Awards & Recognition', icon: <Trophy className="w-4 h-4" /> },
  { id: 'content', label: 'Content Details', icon: <Film className="w-4 h-4" /> },
  { id: 'availability', label: 'Availability', icon: <PlayCircle className="w-4 h-4" /> },
  { id: 'advanced', label: 'Advanced Options', icon: <SlidersHorizontal className="w-4 h-4" /> }
];

const COUNTRIES = [
  "United States", "India", "United Kingdom", "Canada", "Japan", "South Korea", 
  "China", "Germany", "France", "Italy", "Spain", "Australia", "Brazil", "Mexico"
];

const LANGUAGES = [
  "English", "Hindi", "Spanish", "French", "German", "Japanese", "Korean", 
  "Chinese", "Arabic", "Russian", "Portuguese", "Tamil", "Telugu", "Urdu", 
  "Italian", "Turkish", "Thai", "Vietnamese", "Bengali"
];

const GENRES = [
  'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime', 
  'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror', 
  'Music', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western'
];

const MOODS = [
  'Mind Bending', 'Dark', 'Emotional', 'Twist Ending', 'Underrated', 
  'Masterpiece', 'Slow Burn', 'Fast Paced', 'Thought Provoking', 'Feel Good'
];

const AWARDS = [
  'Oscar-Winning', 'Oscar-Nominated', 'Golden Globe-Winning', 'Golden Globe-Nominated', 
  'Emmy Award-Winning', 'Emmy Award-Nominated', 'Best Picture-Winning', 'Best Director-Winning',
  'IMDb Top 100 Movies', 'IMDb Top 250 Movies', 'IMDb Bottom 100 Movies', 'National Film Registry'
];

const PROVIDERS = [
  'Netflix', 'Prime Video', 'Disney+', 'Apple TV+', 'Max', 'Hulu', 'Crunchyroll', 'Paramount+', 'Peacock'
];

const DEFAULT_FILTERS = {
  contentType: 'Movies',
  titleName: '',
  country: '',
  language: '',
  adultContent: false,
  releaseStart: '',
  releaseEnd: '',
  tmdbRatingMin: '',
  tmdbRatingMax: '',
  votesMin: '',
  votesMax: '',
  popularityMin: '',
  popularityMax: '',
  genres: [],
  keywords: [],
  moodTags: [],
  cast: [],
  director: [],
  writer: [],
  producer: [],
  character: [],
  awards: [],
  runtimeMin: '',
  runtimeMax: '',
  contentStatus: '',
  productionCompany: '',
  originalLanguage: '',
  countryOfOrigin: '',
  certification: [],
  streamingProviders: [],
  regionAvailability: '',
  sortBy: 'Popularity',
  order: 'Descending',
  excludeWatched: false,
  excludeRated: false,
  includeFavorites: false
};

export default function RecommendationTab({ currentUser }: RecommendationTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  
  const [selectedQuickChips, setSelectedQuickChips] = useState<string[]>([]);
  const [isAdvancedDiscoveryOpen, setIsAdvancedDiscoveryOpen] = useState(false);
  
  const [activeCategory, setActiveCategory] = useState('basic');
  const [viewAllCategories, setViewAllCategories] = useState(false);

  // Filter States
  const [filters, setFilters] = useState<any>(JSON.parse(JSON.stringify(DEFAULT_FILTERS)));

  // Rotating placeholder logic
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % SEARCH_PLACEHOLDERS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleQuickChip = (chipLabel: string) => {
    setSelectedQuickChips(prev => 
      prev.includes(chipLabel) ? prev.filter(c => c !== chipLabel) : [...prev, chipLabel]
    );
  };

  const removeFilterChip = (key: string, value?: any) => {
    if (Array.isArray(filters[key])) {
      setFilters((prev: any) => ({ ...prev, [key]: prev[key].filter((v: any) => v !== value) }));
    } else if (typeof filters[key] === 'boolean') {
      setFilters((prev: any) => ({ ...prev, [key]: false }));
    } else {
      setFilters((prev: any) => ({ ...prev, [key]: '' }));
    }
  };

  const clearAllFilters = () => {
    setSelectedQuickChips([]);
    setFilters(JSON.parse(JSON.stringify(DEFAULT_FILTERS)));
  };

  // Derive active selections for display
  const activeFilterChips: {key: string, label: string, value: any}[] = [];
  
  selectedQuickChips.forEach(c => activeFilterChips.push({ key: 'quick', label: c, value: c }));
  
  if (filters.contentType) activeFilterChips.push({ key: 'contentType', label: filters.contentType, value: filters.contentType });
  if (filters.titleName) activeFilterChips.push({ key: 'titleName', label: `Title: ${filters.titleName}`, value: filters.titleName });
  if (filters.country) activeFilterChips.push({ key: 'country', label: `Country: ${filters.country}`, value: filters.country });
  if (filters.language) activeFilterChips.push({ key: 'language', label: `Lang: ${filters.language}`, value: filters.language });
  if (filters.adultContent) activeFilterChips.push({ key: 'adultContent', label: 'Adult Content', value: true });
  
  if (filters.releaseStart) activeFilterChips.push({ key: 'releaseStart', label: `From: ${filters.releaseStart}`, value: filters.releaseStart });
  if (filters.releaseEnd) activeFilterChips.push({ key: 'releaseEnd', label: `To: ${filters.releaseEnd}`, value: filters.releaseEnd });
  
  filters.genres.forEach((g:string) => activeFilterChips.push({ key: 'genres', label: g, value: g }));
  filters.keywords.forEach((k:string) => activeFilterChips.push({ key: 'keywords', label: k, value: k }));
  filters.moodTags.forEach((m:string) => activeFilterChips.push({ key: 'moodTags', label: m, value: m }));
  filters.cast.forEach((c:string) => activeFilterChips.push({ key: 'cast', label: `Cast: ${c}`, value: c }));
  filters.director.forEach((c:string) => activeFilterChips.push({ key: 'director', label: `Director: ${c}`, value: c }));
  filters.writer.forEach((c:string) => activeFilterChips.push({ key: 'writer', label: `Writer: ${c}`, value: c }));
  filters.producer.forEach((c:string) => activeFilterChips.push({ key: 'producer', label: `Producer: ${c}`, value: c }));
  filters.character.forEach((c:string) => activeFilterChips.push({ key: 'character', label: `Character: ${c}`, value: c }));
  filters.awards.forEach((a:string) => activeFilterChips.push({ key: 'awards', label: a, value: a }));
  filters.streamingProviders.forEach((p:string) => activeFilterChips.push({ key: 'streamingProviders', label: p, value: p }));
  
  if (filters.excludeWatched) activeFilterChips.push({ key: 'excludeWatched', label: 'Exclude Watched', value: true });
  if (filters.excludeRated) activeFilterChips.push({ key: 'excludeRated', label: 'Exclude Rated', value: true });
  if (filters.includeFavorites) activeFilterChips.push({ key: 'includeFavorites', label: 'Favorites Only', value: true });

  return (
    <div className="w-full min-h-screen relative text-zinc-100 py-12 flex flex-col justify-start overflow-hidden bg-[#0B0B0B]">
      
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-12 relative z-10 w-full text-left pt-8">
        
        {/* TOP SEARCH AREA */}
        <div className="w-full relative max-w-5xl mx-auto">
          <div className="relative">
            <div 
              className={`flex items-center bg-[#111111] border rounded-full overflow-hidden transition-all duration-300 relative z-30 ${isSearchFocused ? 'border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)]' : 'border-white/10 hover:border-white/20'}`}
            >
              <div className="pl-6 pr-3 flex items-center justify-center">
                <Search className={`w-5 h-5 transition-colors duration-300 ${isSearchFocused ? 'text-amber-500' : 'text-zinc-500'}`} />
              </div>
              
              <div className="flex-1 relative h-14 sm:h-16">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  className="w-full h-full bg-transparent text-white font-sans text-sm sm:text-base focus:outline-none z-10 relative"
                  placeholder="" 
                />
                {!searchQuery && (
                  <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none text-zinc-500 text-sm sm:text-base">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={placeholderIndex}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="truncate pr-4"
                      >
                         Search anything... e.g. "{SEARCH_PLACEHOLDERS[placeholderIndex]}"
                      </motion.span>
                    </AnimatePresence>
                  </div>
                )}
              </div>
              
              <div className="pr-2 pl-2 h-full flex items-center">
                 <button className="flex items-center gap-2 px-6 py-2.5 rounded-full border border-amber-500/50 text-amber-500 hover:bg-amber-500/10 transition-colors text-sm font-bold">
                    <Sparkles className="w-4 h-4" />
                    AI Search
                 </button>
              </div>
            </div>
          </div>
        </div>

        {/* QUICK PICK CHIPS */}
        <div className="max-w-[1400px] mx-auto w-full">
          <h4 className="text-xs font-bold text-white mb-4">Quick Picks</h4>
          <div className="overflow-x-auto no-scrollbar pb-2">
            <div className="flex items-center gap-2.5 w-max">
              {QUICK_CHIPS.map(chipInfo => {
                const isSelected = selectedQuickChips.includes(chipInfo.label);
                const Icon = chipInfo.icon;
                return (
                  <button
                    key={chipInfo.label}
                    onClick={() => handleToggleQuickChip(chipInfo.label)}
                    className={`px-4 py-2 rounded-xl border text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-300 select-none flex items-center gap-2 ${
                        isSelected 
                        ? 'bg-gradient-to-r from-zinc-800 to-zinc-900 border-white text-white shadow-[0_0_15px_rgba(255,255,255,0.15)] ring-1 ring-white/20' 
                        : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 hover:border-white/20'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {chipInfo.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* SELECTED FILTERS BAR */}
        <div className="max-w-[1400px] mx-auto w-full bg-[#111111] border border-white/5 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
           <div className="flex-1">
             <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">Your Selections</div>
             <div className="flex flex-wrap items-center gap-2">
                {activeFilterChips.map((sel, idx) => (
                  <span key={`${sel.key}-${sel.value}-${idx}`} className="px-3 py-1.5 bg-[#1A1A1A] border border-white/10 rounded-lg text-xs font-medium text-zinc-300 flex items-center gap-2">
                    {sel.label}
                    <button 
                      className="text-zinc-500 hover:text-white transition-colors"
                      onClick={() => {
                        if(sel.key === 'quick') handleToggleQuickChip(sel.value);
                        else removeFilterChip(sel.key, sel.value);
                      }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
                {activeFilterChips.length === 0 && <span className="text-xs text-zinc-500">No filters selected</span>}
                {activeFilterChips.length > 0 && (
                  <button onClick={clearAllFilters} className="text-xs text-red-500 font-bold flex items-center gap-1.5 ml-2 hover:text-red-400 transition-colors">
                     <span className="w-4 h-4 flex items-center justify-center bg-red-500/10 rounded"><X className="w-3 h-3" /></span> Clear All
                  </button>
                )}
             </div>
           </div>
           <div className="flex items-center gap-3 w-full sm:w-auto">
             <button className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition-colors whitespace-nowrap">
               <Bookmark className="w-4 h-4" /> Save Search
             </button>
             <button 
                onClick={() => setIsAdvancedDiscoveryOpen(!isAdvancedDiscoveryOpen)}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-semibold transition-colors whitespace-nowrap ${isAdvancedDiscoveryOpen ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-purple-500/50 text-white shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'border-white/10 text-white hover:bg-white/5'}`}
             >
               <SlidersHorizontal className="w-4 h-4" /> Advanced Discovery
             </button>
           </div>
        </div>

        {/* ADVANCED DISCOVERY PANEL */}
        {isAdvancedDiscoveryOpen && (
           <div className="max-w-[1400px] mx-auto w-full bg-[#0F0F0F] border border-white/10 rounded-2xl overflow-hidden mt-6">
              <div className="flex flex-col sm:flex-row shadow-[0_0_80px_rgba(0,0,0,0.5)]">
                 
                 {/* Sidebar */}
                 <div className="w-full sm:w-[260px] border-r border-white/5 bg-[#0B0B0B] flex flex-col h-[600px]">
                    <div className="p-5 border-b border-white/5 flex items-center justify-between">
                       <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide">
                          <SlidersHorizontal className="w-4 h-4 text-amber-500"/> Advanced Discovery
                       </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto no-scrollbar py-2">
                       {CATEGORIES.map(cat => (
                         <button
                           key={cat.id}
                           onClick={() => { setActiveCategory(cat.id); setViewAllCategories(false); }}
                           className={`w-full text-left px-5 py-3 flex items-center gap-3 text-sm font-medium transition-colors border-l-2 ${activeCategory === cat.id && !viewAllCategories ? 'border-amber-500 bg-white/5 text-white' : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.02]'}`}
                         >
                           <span className={activeCategory === cat.id && !viewAllCategories ? "text-amber-500" : ""}>{cat.icon}</span>
                           {cat.label}
                         </button>
                       ))}
                    </div>
                 </div>

                 {/* Main Content Area */}
                 <div className="flex-1 flex flex-col h-[600px] bg-[#0F0F0F] relative">
                    <div className="p-5 border-b border-white/5 flex items-center justify-between sticky top-0 z-10 bg-[#0F0F0F] shadow-sm">
                       <button 
                         onClick={() => {
                           if(viewAllCategories) {
                             setViewAllCategories(false);
                             setActiveCategory('basic');
                           } else {
                             setViewAllCategories(true);
                           }
                         }} 
                         className="flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white border border-white/10 rounded-lg px-3 py-1.5 transition-colors bg-[#111] hover:bg-[#1A1A1A]"
                       >
                          <LayoutGrid className="w-3.5 h-3.5" /> 
                          {viewAllCategories ? "Collapse Categories" : "View All Categories"}
                       </button>
                       <button onClick={clearAllFilters} className="text-xs text-red-500 font-semibold hover:text-red-400 flex items-center gap-1.5 transition-colors">
                          Reset All <X className="w-3.5 h-3.5"/>
                       </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-16 no-scrollbar relative scroll-smooth">
                       <AdvancedFiltersContent 
                          activeCategory={activeCategory} 
                          viewAllCategories={viewAllCategories}
                          filters={filters}
                          setFilters={setFilters}
                       />
                    </div>
                    
                    {/* Action Footer */}
                    <div className="p-5 border-t border-white/5 bg-[#0B0B0B] flex justify-end gap-3 shrink-0">
                       <button onClick={clearAllFilters} className="px-6 py-2.5 rounded-xl border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition-colors">
                         Clear Filters
                       </button>
                       <button className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-sm font-bold shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all">
                         Apply Filters
                       </button>
                    </div>
                 </div>
              </div>
           </div>
        )}

        {/* RESULTS AREA PLACEHOLDER */}
        <div className="mt-16 border border-dashed border-white/10 rounded-3xl min-h-[400px] flex flex-col items-center justify-center p-8 text-center bg-[#0B0B0B]">
           <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6 shadow-sm">
              <Search className="w-8 h-8 text-zinc-600" />
           </div>
           <h3 className="text-2xl font-bold text-white mb-2">0 Results</h3>
           <p className="text-zinc-500 text-sm max-w-sm">Configure filters and search criteria to discover content. Results will appear here dynamically.</p>
        </div>

      </div>
    </div>
  );
}

// ---------------- UI Building Blocks ----------------

interface SearchableSelectProps {
  label: string;
  placeholder: string;
  options: string[];
  value: string;
  onChange: (val: string) => void;
}

function SearchableSelect({ label, placeholder, options, value, onChange }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-3 relative" ref={wrapperRef}>
      <label className="text-sm font-semibold text-zinc-300">{label}</label>
      <div 
        className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-400 focus:outline-none cursor-pointer flex justify-between items-center hover:border-white/20"
        onClick={() => { setOpen(!open); setSearch(''); }}
      >
        <span className={value ? "text-white" : "text-zinc-500"}>{value || placeholder}</span>
        {value ? (
           <X 
              className="w-4 h-4 text-zinc-400 hover:text-white" 
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
           />
        ) : (
           <ChevronDown className="w-4 h-4" />
        )}
      </div>
      
      {open && (
        <div className="absolute z-50 mt-2 w-full bg-[#1A1A1A] border border-white/10 rounded-xl shadow-xl overflow-hidden max-h-60 flex flex-col">
          <div className="p-2 border-b border-white/5">
            <input 
              type="text" 
              placeholder="Search..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#111111] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50 border border-transparent transition-colors"
               onClick={(e)=>e.stopPropagation()}
            />
          </div>
          <div className="overflow-y-auto no-scrollbar flex-1">
            {filteredOptions.length === 0 && <div className="p-3 text-sm text-zinc-500 text-center">No results found</div>}
            {filteredOptions.map(opt => (
              <div 
                key={opt} 
                className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-white/5 transition-colors ${value === opt ? 'bg-amber-500/10 text-amber-500' : 'text-zinc-300'}`}
                onClick={() => { onChange(opt); setOpen(false); setSearch(''); }}
              >
                {opt}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchableMultiSelect({ label, placeholder, options, values, onChange }: { label: string, placeholder: string, options: string[], values: string[], onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  const removeVal = (val: string) => onChange(values.filter(v => v !== val));

  const toggleVal = (val: string) => {
     if(values.includes(val)) {
        onChange(values.filter(v => v !== val));
     } else {
        onChange([...values, val]);
     }
  };

  return (
    <div className="space-y-3 relative" ref={wrapperRef}>
      <div className="flex justify-between items-center">
         <label className="text-sm font-semibold text-zinc-300">{label}</label>
      </div>
      <div 
        className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-3 min-h-[50px] text-sm text-zinc-400 focus-within:border-amber-500/50 cursor-text flex flex-wrap items-center gap-2 transition-colors relative"
        onClick={() => setOpen(true)}
      >
        {values.length === 0 && !search && (
           <span className="absolute left-4 top-3.5 text-zinc-500 pointer-events-none">{placeholder}</span>
        )}
        {values.map(v => (
           <span key={v} className="bg-amber-500 border border-amber-500 rounded-lg px-2 py-1 text-xs font-semibold text-black flex items-center gap-1.5 z-10 hover:bg-amber-600 transition-colors" onClick={(e) => { e.stopPropagation(); removeVal(v); }}>
             {v}
             <X className="w-3.5 h-3.5 text-black hover:scale-110 transition-transform" />
           </span>
        ))}
        <input 
           type="text"
           value={search}
           onChange={(e) => setSearch(e.target.value)}
           className="flex-1 bg-transparent border-none focus:outline-none min-w-[100px] text-white z-10 py-1"
        />
        <ChevronDown className="w-4 h-4 absolute right-4 top-4 text-zinc-500 pointer-events-none" />
      </div>
      
      {open && (
        <div className="absolute z-50 mt-2 w-full bg-[#1A1A1A] border border-white/10 rounded-xl shadow-xl overflow-hidden max-h-60 flex flex-col">
          <div className="overflow-y-auto no-scrollbar flex-1">
            {filteredOptions.length === 0 && <div className="p-3 text-sm text-zinc-500 text-center">No results found</div>}
            {filteredOptions.map(opt => {
              const isSelected = values.includes(opt);
              return (
                 <div 
                   key={opt} 
                   className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-white/5 transition-colors flex items-center gap-2 ${isSelected ? 'text-amber-500 font-semibold' : 'text-zinc-300'}`}
                   onClick={() => { toggleVal(opt); setSearch(''); }}
                 >
                   <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-amber-500 border-amber-500 text-black' : 'border-white/20'}`}>
                      {isSelected && <Check className="w-3 h-3" />}
                   </div>
                   {opt}
                 </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ArrayInputBox({ label, placeholder, values, onChange }: { label: string, placeholder: string, values: string[], onChange: (v: string[]) => void }) {
  const [inputVal, setInputVal] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const parts = inputVal.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length > 0) {
        const newValues = Array.from(new Set([...values, ...parts]));
        onChange(newValues);
        setInputVal('');
      }
    }
  };

  const removeVal = (val: string) => {
    onChange(values.filter(v => v !== val));
  };

  return (
    <div className="space-y-3">
       <label className="text-sm font-semibold text-zinc-300">{label}</label>
       <div className="w-full bg-[#111111] border border-white/10 rounded-xl p-2 min-h-[50px] flex flex-wrap gap-2 items-center focus-within:border-amber-500/50 transition-colors">
          {values.map(v => (
             <span key={v} className="bg-[#1A1A1A] border border-white/10 rounded-lg px-2 py-1 flex items-center gap-1.5 shadow-sm">
               <span className="text-xs text-zinc-200">{v}</span>
               <X className="w-3.5 h-3.5 text-zinc-500 hover:text-white cursor-pointer transition-colors" onClick={() => removeVal(v)} />
             </span>
          ))}
          <input 
            type="text" 
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={values.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[150px] bg-transparent border-none focus:outline-none text-sm text-white px-2 py-1 placeholder:text-zinc-500"
          />
       </div>
    </div>
  );
}

function AdvancedFiltersContent({ activeCategory, viewAllCategories, filters, setFilters }: { activeCategory: string, viewAllCategories: boolean, filters: any, setFilters: any }) {
  
  const SectionHeader = ({ title, icon }: { title: string, icon?: React.ReactNode }) => (
     <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-3">
       {icon && <span className="text-amber-500">{icon}</span>}
       <h4 className="text-base font-bold text-white tracking-wide">{title}</h4>
     </div>
  );

  const shouldShow = (id: string) => viewAllCategories || activeCategory === id;

  const toggleArrayFilter = (key: string, val: string) => {
     setFilters((prev: any) => ({
        ...prev,
        [key]: prev[key].includes(val) ? prev[key].filter((v: string) => v !== val) : [...prev[key], val]
     }));
  }

  return (
    <div className="space-y-16 lg:max-w-4xl mx-auto w-full">
      
      {/* 1. Basic Content */}
      {shouldShow('basic') && (
        <section>
          {viewAllCategories && <SectionHeader title="Basic" icon={<MonitorPlay className="w-5 h-5"/>} />}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            <div className="space-y-3 md:col-span-2">
              <label className="text-sm font-semibold text-zinc-300">Content Type</label>
              <div className="flex bg-[#111111] p-1 rounded-xl border border-white/10 w-max shadow-sm">
                {['Movies', 'Series', 'Anime'].map(t => (
                  <button 
                    key={t}
                    onClick={() => {
                       setFilters({ ...filters, contentType: filters.contentType === t ? '' : t });
                    }}
                    className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${filters.contentType === t ? 'bg-zinc-200 border-white/20 text-black shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                  >
                    {t === 'Movies' && <Film className="w-4 h-4 inline mr-2"/>}
                    {t === 'Series' && <Tv className="w-4 h-4 inline mr-2"/>}
                    {t === 'Anime' && <Sparkles className="w-4 h-4 inline mr-2"/>}
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
               <label className="text-sm font-semibold text-zinc-300">Title Name</label>
               <input 
                 type="text" 
                 placeholder="e.g. The Godfather" 
                 value={filters.titleName}
                 onChange={(e) => setFilters({...filters, titleName: e.target.value})}
                 className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors placeholder:text-zinc-600" 
               />
            </div>

            <div className="space-y-3">
              <SearchableSelect 
                 label="Country Menu"
                 placeholder="Any Country"
                 options={COUNTRIES}
                 value={filters.country}
                 onChange={(val) => setFilters({...filters, country: val})}
              />
            </div>

            <div className="space-y-3">
              <SearchableSelect 
                 label="Primary Language"
                 placeholder="Any Language"
                 options={LANGUAGES}
                 value={filters.language}
                 onChange={(val) => setFilters({...filters, language: val})}
              />
            </div>
            
            <div className="space-y-3 md:col-span-2 mt-2">
              <label className="flex items-center gap-4 p-4 bg-[#111111] border border-white/5 rounded-xl cursor-pointer hover:bg-white/5 hover:border-white/10 transition-colors w-max shadow-sm">
                 <input 
                   type="checkbox" 
                   checked={filters.adultContent}
                   onChange={(e) => setFilters({...filters, adultContent: e.target.checked})}
                   className="w-5 h-5 accent-amber-500 rounded border-white/10 bg-black cursor-pointer" 
                 />
                 <div>
                    <div className="font-semibold text-white text-sm flex items-center gap-2">Include Adult Content <EyeOff className="w-4 h-4 text-zinc-500"/></div>
                    <div className="text-xs text-zinc-500 mt-0.5">Allow rated 18+ and adult content in results.</div>
                 </div>
              </label>
            </div>
          </div>
        </section>
      )}

      {/* 2. Release & Ratings */}
      {shouldShow('release') && (
        <section>
          {viewAllCategories && <SectionHeader title="Release & Ratings" icon={<Calendar className="w-5 h-5"/>} />}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
             
             <div className="space-y-3 md:col-span-2 bg-[#141414] border border-white/5 p-6 rounded-2xl">
                <label className="text-sm font-semibold text-zinc-300 block mb-2">Precise Date Range</label>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                   <div className="w-full">
                     <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">Start Date</span>
                     <input 
                       type="date" 
                       value={filters.releaseStart}
                       onChange={(e) => setFilters({...filters, releaseStart: e.target.value})}
                       className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-amber-500/50 transition-colors" 
                     />
                   </div>
                   <div className="text-zinc-600 font-medium sm:mt-6 hidden sm:block px-2">to</div>
                   <div className="w-full">
                     <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">End Date</span>
                     <input 
                       type="date" 
                       value={filters.releaseEnd}
                       onChange={(e) => setFilters({...filters, releaseEnd: e.target.value})}
                       className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-amber-500/50 transition-colors" 
                     />
                   </div>
                </div>
             </div>

             <div className="space-y-3">
                <label className="text-sm font-semibold text-zinc-300">TMDB Rating</label>
                <div className="flex items-center gap-3">
                   <input 
                     type="number" 
                     placeholder="Min (1.0)" 
                     value={filters.tmdbRatingMin}
                     onChange={(e) => setFilters({...filters, tmdbRatingMin: e.target.value})}
                     className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors text-center placeholder:text-zinc-600" 
                   />
                   <span className="text-zinc-600">-</span>
                   <input 
                     type="number" 
                     placeholder="Max (10.0)" 
                     value={filters.tmdbRatingMax}
                     onChange={(e) => setFilters({...filters, tmdbRatingMax: e.target.value})}
                     className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors text-center placeholder:text-zinc-600" 
                   />
                </div>
             </div>

             <div className="space-y-3">
                <label className="text-sm font-semibold text-zinc-300">Number of Votes</label>
                <div className="flex items-center gap-3">
                   <input 
                     type="number" 
                     placeholder="Min (0)" 
                     value={filters.votesMin}
                     onChange={(e) => setFilters({...filters, votesMin: e.target.value})}
                     className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors text-center placeholder:text-zinc-600" 
                   />
                   <span className="text-zinc-600">-</span>
                   <input 
                     type="number" 
                     placeholder="Max (50000+)" 
                     value={filters.votesMax}
                     onChange={(e) => setFilters({...filters, votesMax: e.target.value})}
                     className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors text-center placeholder:text-zinc-600" 
                   />
                </div>
             </div>

             <div className="space-y-3 md:col-span-2 max-w-sm">
                <label className="text-sm font-semibold text-zinc-300">Popularity Score</label>
                <div className="flex items-center gap-3">
                   <input 
                     type="number" 
                     placeholder="Min" 
                     value={filters.popularityMin}
                     onChange={(e) => setFilters({...filters, popularityMin: e.target.value})}
                     className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors text-center placeholder:text-zinc-600" 
                   />
                   <span className="text-zinc-600">-</span>
                   <input 
                     type="number" 
                     placeholder="Max" 
                     value={filters.popularityMax}
                     onChange={(e) => setFilters({...filters, popularityMax: e.target.value})}
                     className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors text-center placeholder:text-zinc-600" 
                   />
                </div>
             </div>

          </div>
        </section>
      )}

      {/* 3. Genres & Keywords */}
      {shouldShow('genres') && (
        <section>
          {viewAllCategories && <SectionHeader title="Genres & Keywords" icon={<Hash className="w-5 h-5"/>} />}
          <div className="space-y-10">
             
             <div className="space-y-4">
                <SearchableMultiSelect 
                   label="Genres"
                   placeholder="Search genres..."
                   options={GENRES}
                   values={filters.genres}
                   onChange={(vals) => setFilters({...filters, genres: vals})}
                />
             </div>

             <ArrayInputBox 
                label="Additional Keywords" 
                placeholder="e.g. time travel, post apocalyptic (Press Enter)" 
                values={filters.keywords} 
                onChange={(vals) => setFilters({...filters, keywords: vals})}
             />

             <div className="space-y-4">
                <label className="text-sm font-semibold text-zinc-300">Mood Tags</label>
                <div className="flex flex-wrap gap-2.5">
                   {MOODS.map(m => {
                      const isSelected = filters.moodTags.includes(m);
                      return (
                         <button 
                           key={m} 
                           onClick={() => toggleArrayFilter('moodTags', m)}
                           className={`px-4 py-2 border border-dashed rounded-full text-xs font-medium transition-all duration-200 ${isSelected ? 'bg-amber-500 text-black border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'border-white/20 text-amber-500/80 hover:text-amber-500 hover:border-amber-500/50 bg-amber-500/5'}`}
                         >
                           {m}
                         </button>
                      )
                   })}
                </div>
             </div>
          </div>
        </section>
      )}

      {/* 4. People & Cast */}
      {shouldShow('people') && (
        <section>
          {viewAllCategories && <SectionHeader title="People & Cast" icon={<Users className="w-5 h-5"/>} />}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <ArrayInputBox 
                label="Cast / Actor Search" 
                placeholder="Person's name..." 
                values={filters.cast} 
                onChange={(vals) => setFilters({...filters, cast: vals})}
             />
             <ArrayInputBox 
                label="Director Search" 
                placeholder="Director's name..." 
                values={filters.director} 
                onChange={(vals) => setFilters({...filters, director: vals})}
             />
             <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-white/5">
                <ArrayInputBox 
                   label="Writer / Screenplay" 
                   placeholder="Writer's name..." 
                   values={filters.writer} 
                   onChange={(vals) => setFilters({...filters, writer: vals})}
                />
                <ArrayInputBox 
                   label="Producer Search" 
                   placeholder="Producer's name..." 
                   values={filters.producer} 
                   onChange={(vals) => setFilters({...filters, producer: vals})}
                />
             </div>
             <div className="md:col-span-2 pt-4 border-t border-white/5">
                <ArrayInputBox 
                   label="Character Search" 
                   placeholder="e.g. James Bond, Batman..." 
                   values={filters.character} 
                   onChange={(vals) => setFilters({...filters, character: vals})}
                />
             </div>
          </div>
        </section>
      )}

      {/* 5. Awards & Recognition */}
      {shouldShow('awards') && (
        <section>
          {viewAllCategories && <SectionHeader title="Awards & Recognition" icon={<Trophy className="w-5 h-5"/>} />}
          <div className="space-y-6">
             <div className="flex flex-wrap gap-2.5">
                {AWARDS.slice(0,8).map(a => {
                   const isSelected = filters.awards.includes(a);
                   return (
                      <button 
                        key={a} 
                        onClick={() => toggleArrayFilter('awards', a)}
                        className={`px-4 py-2 border rounded-full text-xs font-semibold transition-colors ${isSelected ? 'bg-amber-500 border-amber-500 text-black shadow-sm' : 'border-amber-500/30 text-amber-500/80 hover:text-amber-500 hover:bg-amber-500/10'}`}
                      >
                        {a}
                      </button>
                   );
                })}
             </div>
             <div className="flex flex-wrap gap-2.5 pt-6 border-t border-white/5">
                {AWARDS.slice(8).map(a => {
                   const isSelected = filters.awards.includes(a);
                   return (
                      <button 
                        key={a} 
                        onClick={() => toggleArrayFilter('awards', a)}
                        className={`px-4 py-2 border rounded-lg text-xs font-semibold transition-colors ${isSelected ? 'bg-yellow-500 border-yellow-500 text-black shadow-sm' : 'bg-yellow-500/5 border-yellow-500/20 text-yellow-500/80 hover:text-yellow-500 hover:bg-yellow-500/10'}`}
                      >
                        {a}
                      </button>
                   );
                })}
             </div>
          </div>
        </section>
      )}

      {/* 6. Content Details */}
      {shouldShow('content') && (
        <section>
          {viewAllCategories && <SectionHeader title="Content Details" icon={<Film className="w-5 h-5"/>} />}
          <div className="space-y-8">
             <div className="space-y-5 max-w-2xl bg-[#141414] p-6 rounded-2xl border border-white/5">
                <div className="flex justify-between items-center">
                   <label className="text-sm font-semibold text-zinc-300">Runtime (minutes)</label>
                   <Clock className="w-4 h-4 text-zinc-500" />
                </div>
                <div className="flex items-center gap-4">
                   <input 
                     type="number" 
                     placeholder="Min" 
                     value={filters.runtimeMin}
                     onChange={(e)=>setFilters({...filters, runtimeMin: e.target.value})}
                     className="w-24 bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-center text-white focus:outline-none focus:border-amber-500/50" 
                   />
                   <div className="flex-1 h-1 bg-white/10 rounded-full relative mx-2">
                       <div className="absolute top-0 bottom-0 left-[10%] right-[30%] bg-amber-500/50 rounded-full"></div>
                   </div>
                   <input 
                     type="number" 
                     placeholder="Max" 
                     value={filters.runtimeMax}
                     onChange={(e)=>setFilters({...filters, runtimeMax: e.target.value})}
                     className="w-24 bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-center text-white focus:outline-none focus:border-amber-500/50" 
                   />
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                   <label className="text-sm font-semibold text-zinc-300">Content Status</label>
                   <select 
                     value={filters.contentStatus}
                     onChange={(e)=>setFilters({...filters, contentStatus: e.target.value})}
                     className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-400 focus:outline-none appearance-none hover:border-white/20 cursor-pointer"
                   >
                      <option value="">Any Status</option>
                      <option value="Released">Released</option>
                      <option value="Upcoming">Upcoming</option>
                      <option value="In Production">In Production</option>
                   </select>
                </div>
                <div className="space-y-3">
                   <label className="text-sm font-semibold text-zinc-300">Production Company</label>
                   <input 
                     type="text" 
                     value={filters.productionCompany}
                     onChange={(e)=>setFilters({...filters, productionCompany: e.target.value})}
                     placeholder="e.g. Warner Bros, A24..." 
                     className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50" 
                   />
                </div>
                <div className="space-y-3">
                   <label className="text-sm font-semibold text-zinc-300">Original Language</label>
                   <input 
                     type="text" 
                     value={filters.originalLanguage}
                     onChange={(e)=>setFilters({...filters, originalLanguage: e.target.value})}
                     placeholder="e.g. English, Korean..." 
                     className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50" 
                   />
                </div>
                <div className="space-y-3">
                   <label className="text-sm font-semibold text-zinc-300">Country of Origin</label>
                   <input 
                     type="text" 
                     value={filters.countryOfOrigin}
                     onChange={(e)=>setFilters({...filters, countryOfOrigin: e.target.value})}
                     placeholder="e.g. United States, Japan..." 
                     className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50" 
                   />
                </div>
             </div>

             <div className="space-y-4 pt-4 border-t border-white/5">
                <label className="text-sm font-semibold text-zinc-300">US Certificates / Age Ratings</label>
                <div className="flex flex-wrap gap-2.5">
                   {['G', 'PG', 'PG-13', 'R', 'NC-17', 'TV-Y', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'].map(c => {
                      const isSelected = filters.certification.includes(c);
                      return (
                         <button 
                           key={c} 
                           onClick={() => toggleArrayFilter('certification', c)}
                           className={`px-5 py-2 border rounded-lg text-xs font-bold transition-colors ${isSelected ? 'bg-zinc-200 text-black border-zinc-200 shadow-sm' : 'bg-[#111111] border-white/10 text-zinc-400 hover:text-white hover:border-white/30 hover:bg-white/5'}`}
                         >
                           {c}
                         </button>
                      );
                   })}
                </div>
             </div>
          </div>
        </section>
      )}

      {/* 8. Availability */}
      {shouldShow('availability') && (
        <section>
          {viewAllCategories && <SectionHeader title="Availability" icon={<PlayCircle className="w-5 h-5"/>} />}
          <div className="space-y-8">
             <div className="space-y-4">
                <label className="text-sm font-semibold text-zinc-300">Streaming Providers</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl">
                   {PROVIDERS.map(provider => {
                      const isSelected = filters.streamingProviders.includes(provider);
                      return (
                         <button 
                            key={provider} 
                            onClick={() => toggleArrayFilter('streamingProviders', provider)}
                            className={`flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer transition-colors text-left ${isSelected ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' : 'bg-[#111111] border-white/5 text-zinc-300 hover:border-white/20 hover:bg-[#1A1A1A]'}`}
                         >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-amber-500 border-amber-500 text-black' : 'bg-black border-white/10'}`}>
                               {isSelected && <Check className="w-3 h-3" />}
                            </div>
                            <span className="text-xs font-bold">{provider}</span>
                         </button>
                      );
                   })}
                </div>
             </div>
             
             <div className="max-w-md space-y-3 pt-4 border-t border-white/5">
               <SearchableSelect 
                  label="Streaming Region"
                  placeholder="Select Region (Default: Global)"
                  options={COUNTRIES}
                  value={filters.regionAvailability}
                  onChange={(val) => setFilters({...filters, regionAvailability: val})}
               />
             </div>
          </div>
        </section>
      )}

      {/* 9. Advanced Options */}
      {shouldShow('advanced') && (
        <section>
          {viewAllCategories && <SectionHeader title="Advanced Options" icon={<SlidersHorizontal className="w-5 h-5"/>} />}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
             <div className="space-y-6">
                <div className="space-y-3">
                   <label className="text-sm font-semibold text-zinc-300">Sort By</label>
                   <select 
                     value={filters.sortBy}
                     onChange={(e)=>setFilters({...filters, sortBy: e.target.value})}
                     className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-300 focus:outline-none appearance-none cursor-pointer hover:border-white/20"
                   >
                      <option value="Popularity">Popularity</option>
                      <option value="Rating">Rating</option>
                      <option value="Votes">Number of Votes</option>
                      <option value="Release Date">Release Date</option>
                      <option value="Title">Title (A-Z)</option>
                   </select>
                </div>
                <div className="space-y-3">
                   <label className="text-sm font-semibold text-zinc-300">Order</label>
                   <div className="flex bg-[#111111] p-1.5 rounded-xl border border-white/10 w-full transition-all">
                      <button 
                        onClick={() => setFilters({...filters, order: 'Descending'})}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all text-center ${filters.order === 'Descending' ? 'bg-[#222] border border-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        Descending
                      </button>
                      <button 
                        onClick={() => setFilters({...filters, order: 'Ascending'})}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all text-center ${filters.order === 'Ascending' ? 'bg-[#222] border border-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        Ascending
                      </button>
                   </div>
                </div>
             </div>

             <div className="space-y-4">
                <label className="text-sm font-semibold text-zinc-300">Personalization Filters</label>
                <div className="space-y-3">
                   <button 
                      onClick={() => setFilters({...filters, excludeWatched: !filters.excludeWatched})}
                      className="w-full flex items-center justify-between p-4 bg-[#111111] border border-white/5 rounded-xl cursor-pointer hover:bg-white/5 transition-colors group"
                   >
                      <span className={`font-semibold text-sm transition-colors ${filters.excludeWatched ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-300'}`}>Exclude Titles I've Watched</span>
                      <div className={`relative w-11 h-6 rounded-full transition-colors flex items-center ${filters.excludeWatched ? 'bg-amber-500' : 'bg-[#222]'}`}>
                         <div className={`absolute w-4 h-4 bg-white rounded-full transition-transform ${filters.excludeWatched ? 'translate-x-[22px]' : 'translate-x-1'}`} />
                      </div>
                   </button>
                   <button 
                      onClick={() => setFilters({...filters, excludeRated: !filters.excludeRated})}
                      className="w-full flex items-center justify-between p-4 bg-[#111111] border border-white/5 rounded-xl cursor-pointer hover:bg-white/5 transition-colors group"
                   >
                      <span className={`font-semibold text-sm transition-colors ${filters.excludeRated ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-300'}`}>Exclude Titles I've Rated</span>
                      <div className={`relative w-11 h-6 rounded-full transition-colors flex items-center ${filters.excludeRated ? 'bg-amber-500' : 'bg-[#222]'}`}>
                         <div className={`absolute w-4 h-4 bg-white rounded-full transition-transform ${filters.excludeRated ? 'translate-x-[22px]' : 'translate-x-1'}`} />
                      </div>
                   </button>
                   <button 
                      onClick={() => setFilters({...filters, includeFavorites: !filters.includeFavorites})}
                      className="w-full flex items-center justify-between p-4 bg-[#111111] border border-white/5 rounded-xl cursor-pointer hover:bg-white/5 transition-colors group"
                   >
                      <span className={`font-semibold text-sm transition-colors ${filters.includeFavorites ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-300'}`}>Include My Favorites Only</span>
                      <div className={`relative w-11 h-6 rounded-full transition-colors flex items-center ${filters.includeFavorites ? 'bg-amber-500' : 'bg-[#222]'}`}>
                         <div className={`absolute w-4 h-4 bg-white rounded-full transition-transform ${filters.includeFavorites ? 'translate-x-[22px]' : 'translate-x-1'}`} />
                      </div>
                   </button>
                </div>
             </div>
          </div>
        </section>
      )}

    </div>
  );
}
