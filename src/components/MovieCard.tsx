import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Plus, Check, Info, Star, ChevronDown, X } from 'lucide-react';
import { auth } from '../lib/firebase';
import { trackInteraction } from '../lib/tracker';
import { useWatchlistStore } from '../stores/watchlistStore';
import { useRatingsStore } from '../stores/ratingsStore';
import { useSettingsStore } from '../stores/settingsStore';
import { formatRuntime, robustFetch } from '../lib/utils';
import { performanceEngine } from '../lib/performanceEngine';
import toast from 'react-hot-toast';

interface MovieCardProps {
  item: any;
  onOpenDetails: (item: any) => void;
  onAddToWatchlist?: (item: any) => void;
  watchlistIds?: string[];
  
  // Controlled fields (for JioHotstar hover alignment)
  isHoveredControl?: boolean;
  isAnyHoveredControl?: boolean;
  onHoverChangeControl?: (hovering: boolean, alignment?: 'left' | 'right' | 'center') => void;
}

const MovieCard = React.memo(function MovieCard({
  item,
  onOpenDetails,
  onAddToWatchlist,
  watchlistIds = [],
  isHoveredControl,
  isAnyHoveredControl,
  onHoverChangeControl
}: MovieCardProps) {
  const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlistStore();
  const { getRating, upsertRating, removeRating } = useRatingsStore();
  const userId = auth.currentUser?.uid;

  const [localHovered, setLocalHovered] = useState(false);
  const [alignment, setAlignment] = useState<'left' | 'right' | 'center'>('center');
  const [ratingTrayOpen, setRatingTrayOpen] = useState(false);
  
  const cardRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  
  // Hover and analytic tracking refs
  const hoverStartRef = useRef<number | null>(null);
  const hoverEventSentRef = useRef<boolean>(false);

  const isControlled = isHoveredControl !== undefined;
  // keep tray open prevents card from closing during rating
  const isHovered = isControlled ? isHoveredControl : localHovered;

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  // Normalize movie properties
  const isDataSaver = useSettingsStore.getState().playback?.dataSaver || useSettingsStore.getState().playback?.dataSaverMode;
  const posterSize = isDataSaver ? 'w185' : 'w342';
  const backdropSize = isDataSaver ? 'w342' : 'w500';

  const idStr = String(item.id || '');
  const title = item.title || item.name || 'Cinematic Epic';
  const rawPoster = item.poster_path || item.posterUrl;
  const poster = rawPoster?.startsWith('http')
    ? rawPoster
    : rawPoster
    ? `https://image.tmdb.org/t/p/${posterSize}${rawPoster}`
    : "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=500&q=80";

  const backdrop = item.backdrop_path?.startsWith('http')
    ? item.backdrop_path
    : item.backdrop_path
    ? `https://image.tmdb.org/t/p/${backdropSize}${item.backdrop_path}`
    : poster;

  const rawRating = item.vote_average || (item.rating ? item.rating / 10 : 8.2);
  const rating = Number(rawRating).toFixed(1);
  const rawYear = item.release_date || item.first_air_date || item.year || '2024';
  const year = String(rawYear).substring(0, 4);
  const mediaType = item.media_type || (item.first_air_date || item.type === 'series' || item.type === 'tv' ? 'tv' : 'movie');

  const titleLen = title.length;
  const numId = Number(item.id) || 42;

  const isSaved = (userId && isInWatchlist(idStr)) || watchlistIds.map(String).includes(idStr);
  const currentRating = getRating(idStr);
  
  // Calculate specific media runtime label with useMemo for optimal render cycles
  const runtimeLabel = React.useMemo(() => {
    const minutesVal = item.runtime || (item.episode_run_time && item.episode_run_time[0]);
    if (mediaType === 'tv') {
      return minutesVal 
        ? formatRuntime(minutesVal) 
        : `${(numId % 5) + 1} Season${(numId % 5) !== 0 ? 's' : ''}`;
    }
    return formatRuntime(item.runtime || Math.floor((numId % 65) + 95));
  }, [item.runtime, item.episode_run_time, mediaType, numId]);

  // Quality Badges: 4K, HDR, Dolby Atmos, IMAX, etc.
  const isUHD = titleLen % 2 === 0;
  const isHDR = numId % 3 === 0;
  const isAtmos = titleLen % 3 === 0;
  const isIMAX = numId % 7 === 0;
  
  const qualityBadges = [];
  if (isUHD) qualityBadges.push('4K UHD');
  else qualityBadges.push('HD');
  if (isHDR) qualityBadges.push('HDR');
  if (isAtmos) qualityBadges.push('Dolby Atmos');
  if (isIMAX) qualityBadges.push('IMAX');

  // Maturity classification
  const maturityOptions = ['U/A 13+', 'U/A 16+', '18+', 'U/A 7+'];
  const maturityRating = maturityOptions[numId % maturityOptions.length];

  // Specific OTT language logic
  let language = 'English';
  if (item.type === 'anime' || (item.genres && String(item.genres).toLowerCase().includes('anime'))) {
    language = 'Japanese';
  } else if (numId % 11 === 0) {
    language = 'Hindi';
  } else if (numId % 13 === 0) {
    language = 'Tamil';
  }

  const getLanguageLabel = () => {
    const origLang = item.original_language || '';
    if (origLang.toLowerCase() === 'hi') return 'हिंदी';
    if (origLang.toLowerCase() === 'ta') return 'தமிழ்';
    if (origLang.toLowerCase() === 'te') return 'తెలుగు';
    if (origLang.toLowerCase() === 'ko') return '한국어';
    if (origLang.toLowerCase() === 'ja') return '日本語';
    if (language.toLowerCase() === 'hindi') return 'हिंदी';
    if (language.toLowerCase() === 'tamil') return 'தமிழ்';
    return 'English';
  };

  // Genres parsing
  let genresArray: string[] = ['Drama', 'Action'];
  if (Array.isArray(item.genres)) {
    genresArray = item.genres.map((g: any) => typeof g === 'string' ? g : g.name || 'Drama');
  } else if (typeof item.genres === 'string') {
    genresArray = item.genres.split(/[,•|]/).map(g => g.trim());
  } else if (item.genre_ids) {
    const genreMap: Record<number, string> = {
      28: 'Action', 12: 'Adventure', 16: 'Anime', 35: 'Comedy', 80: 'Crime',
      99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy',
      36: 'History', 27: 'Horror', 10402: 'Music', 9648: 'Mystery',
      10749: 'Romance', 878: 'Sci-Fi', 10770: 'TV Movie', 53: 'Thriller',
      10752: 'War', 37: 'Western'
    };
    genresArray = item.genre_ids.map((id: number) => genreMap[id] || 'Drama').slice(0, 3);
  }

  useEffect(() => {
    if (isHovered) {
      hoverStartRef.current = Date.now();
      hoverEventSentRef.current = false;
    } else {
      if (hoverStartRef.current) {
        const duration = Date.now() - hoverStartRef.current;
        if (duration > 300) {
          // Track the hover engagement
          const isAbandoned = !hoverEventSentRef.current && duration > 1000;
          trackInteraction(auth.currentUser?.uid, 'hover_card', {
            id: item.id,
            title,
            genres: genresArray,
            type: mediaType,
            durationSeconds: duration / 1000,
            abandoned: isAbandoned
          });
        }
        hoverStartRef.current = null;
      }
      setRatingTrayOpen(false); // Close tray when unhovered
    }
  }, [isHovered, title, mediaType, genresArray]);

  const handleAddToWatchlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    hoverEventSentRef.current = true;
    trackInteraction(auth.currentUser?.uid, 'add_watchlist', {
      id: item.id,
      title,
      genres: genresArray,
      type: mediaType
    });
    
    if (userId) {
      if (isInWatchlist(idStr)) {
        removeFromWatchlist(idStr, userId);
        toast.success("Removed from Watchlist");
      } else {
        addToWatchlist(item, userId);
        toast.success("Added to Watchlist");
      }
    } else {
       if (onAddToWatchlist) onAddToWatchlist(item);
    }
  };

  const handleToggleRatingTray = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userId) {
      if (onAddToWatchlist) onAddToWatchlist(item); // trigger auth
      return;
    }
    setRatingTrayOpen(!ratingTrayOpen);
  };

  const handleSelectRating = async (e: React.MouseEvent, score: number) => {
    e.stopPropagation();
    if (!userId) return;
    
    upsertRating(item, userId, auth.currentUser?.displayName || "User", score);
    toast.success(`Saved rating ${score}/10`);
    setRatingTrayOpen(false);
  };

  const handleRemoveRating = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userId) return;
    removeRating(idStr, userId);
    toast.success("Removed rating");
    setRatingTrayOpen(false);
  };

  const handleOpenDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (ratingTrayOpen) {
      setRatingTrayOpen(false);
      return;
    }
    hoverEventSentRef.current = true;
    trackInteraction(auth.currentUser?.uid, 'movie_click', {
      id: item.id,
      title,
      genres: genresArray,
      type: mediaType
    });
    trackInteraction(auth.currentUser?.uid, 'click_events', {
      type: 'details_open',
      id: item.id,
      title,
      genres: genresArray,
      media_type: mediaType
    });
    onOpenDetails(item);
  };

  const handlePlayTrailer = (e: React.MouseEvent) => {
    e.stopPropagation();
    hoverEventSentRef.current = true;
    trackInteraction(auth.currentUser?.uid, 'trailer_view', {
      id: item.id,
      title,
      genres: genresArray,
      type: mediaType
    });
    onOpenDetails({ ...item, autoplayTrailer: true });
  };

  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  const calculateAlignment = () => {
    if (!cardRef.current) return 'center';
    const rect = cardRef.current.getBoundingClientRect();
    const screenWidth = window.innerWidth;
    
    // Width of expanded card is around 420. Half of it is 210.
    const threshold = 210;
    
    if (rect.left < threshold) {
      return 'left';
    } else if (screenWidth - rect.right < threshold) {
      return 'right';
    }
    return 'center';
  };

  const handleMouseEnter = () => {
    if (isTouchDevice) return;
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Predictive behavior prefetching details via PerformanceEngine
    const prefetchType = item.media_type || (item.first_air_date || item.type === 'series' || item.type === 'tv' ? 'tv' : 'movie');
    performanceEngine.predictDetailsClick(item.id, prefetchType as 'movie' | 'tv');
    
    // Scheduled background image decode prewarming
    if (backdrop) {
      performanceEngine.scheduleImageDecode(backdrop, 2);
    }
    if (poster) {
      performanceEngine.scheduleImageDecode(poster, 2);
    }
    
    // Core behavior: Calculate adaptive delay timing based on cursor velocity (Hover Intent Pattern)
    const adaptiveDelay = performanceEngine.getHoverActivationDelay();
    
    const activeTimer = window.setTimeout(() => {
      const alignVal = calculateAlignment();
      setAlignment(alignVal);
      if (onHoverChangeControl) {
        onHoverChangeControl(true, alignVal);
      } else {
        setLocalHovered(true);
      }
    }, adaptiveDelay);

    timerRef.current = activeTimer;
  };

  const handleMouseLeave = () => {
    if (isTouchDevice) return;
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    // 150ms close delay / safe collapse grace period
    const closeTimer = window.setTimeout(() => {
      if (onHoverChangeControl) {
        onHoverChangeControl(false, 'center');
      } else {
        setLocalHovered(false);
      }
    }, 150);

    timerRef.current = closeTimer;
  };

  // Compute heights & widths relative to screens for absolute overlay cards
  const getExpandedDimensions = () => {
    if (typeof window === 'undefined') return { width: 420, height: 420 };
    if (window.innerWidth < 640) return { width: 240, height: 240 };
    if (window.innerWidth < 1024) return { width: 320, height: 320 };
    return { width: 420, height: 420 };
  };

  const dims = getExpandedDimensions();

  const getPositionStyle = () => {
    const cardEl = cardRef.current;
    const w = cardEl ? cardEl.clientWidth : 220;
    const h = cardEl ? cardEl.clientHeight : 330;
    
    const ew = dims.width;
    const eh = dims.height;
    
    // Perfectly centered vertically relative to its parent cell
    const topOffset = -((eh - h) / 2);
    
    if (alignment === 'left') {
      return {
        left: 0,
        top: `${topOffset}px`,
        transformOrigin: 'top left'
      };
    } else if (alignment === 'right') {
      return {
        right: 0,
        top: `${topOffset}px`,
        transformOrigin: 'top right'
      };
    } else {
      const leftOffset = -((ew - w) / 2);
      return {
        left: `${leftOffset}px`,
        top: `${topOffset}px`,
        transformOrigin: 'top center'
      };
    }
  };

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative w-full h-full cursor-pointer select-none"
      id={`movie-card-cell-${idStr}`}
    >
      {/* RESTING POSTER VIEW (IMAGE FIRST, BORDERLESS) */}
      <div
        onClick={handleOpenDetails}
        className={`w-full h-full rounded-[18px] overflow-hidden relative transition-all duration-300 ${
          isHovered ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
        }`}
        style={{
          boxShadow: 'none',
          border: 'none'
        }}
      >
        <img
          src={poster}
          alt={title}
          className="w-full h-full object-cover rounded-[18px]"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />

        {/* Low contrast cinematic back shadow for title readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505]/95 via-transparent to-transparent rounded-[18px]" />

        {/* Floating compact resting badge stats */}
        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 text-[8.5px] font-sans font-extrabold bg-[#050508]/90 backdrop-blur-md border border-white/10 text-white rounded-[6px] z-10 uppercase tracking-widest">
          {getLanguageLabel()}
        </div>

        <div className="absolute top-2.5 right-2.5 px-2 py-0.5 text-[8.5px] font-sans font-bold bg-[#050508]/90 backdrop-blur-md border border-white/10 text-white rounded-[6px] flex items-center gap-0.5 z-10">
          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
          <span>{rating}</span>
        </div>

        {/* Text Details resting */}
        <div className="absolute bottom-0 left-0 right-0 p-3 text-left space-y-0.5 z-10">
          <h4 className="font-sans font-semibold text-xs text-white leading-tight truncate drop-shadow-md">
            {title}
          </h4>
          <div className="flex items-center gap-1.5 text-[8.5px] font-sans text-zinc-400">
            <span className="font-bold text-zinc-300">{year}</span>
            <span>•</span>
            <span className="text-[8px] px-1 bg-white/5 border border-white/10 rounded uppercase text-zinc-300 truncate font-semibold">
              {maturityRating}
            </span>
          </div>
        </div>
      </div>

      {/* JIOHOTSTAR STYLE EXPANDED CARD VIEW */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 5 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={handleOpenDetails}
            className="absolute bg-[#0B0F19] rounded-[24px] flex flex-col overflow-hidden text-left cursor-pointer z-[100] whitespace-normal"
            style={{
              ...getPositionStyle(),
              width: `${dims.width}px`,
              minHeight: `${dims.height}px`,
              height: 'auto',
              maxHeight: 'none',
              boxShadow: '0 25px 80px rgba(0,0,0,0.65)',
              border: 'none',
              transition: 'min-height 0.28s cubic-bezier(0.22, 1, 0.36, 1)'
            }}
          >
            {/* Safe Hover Zone Buffer */}
            <div className="absolute -inset-1 bg-transparent z-0 pointer-events-auto rounded-[20px]" />

            {/* Top Area: 16:9 Landscape Cinematic Backdrop */}
            <div className="relative aspect-video w-full shrink-0 bg-black overflow-hidden pointer-events-none select-none z-10">
              <img
                src={backdrop}
                alt={title}
                className="w-full h-full object-cover transition-transform duration-700 ease-out transform scale-105"
                decoding="async"
                referrerPolicy="no-referrer"
              />
              {/* Smooth dark cinematic fade to black at bottom */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19] via-[#0B0F19]/40 to-black/20 z-10" />

              {/* Media Type pill */}
              <div className="absolute top-3 left-3 px-2 py-0.5 text-[8px] font-sans font-black bg-[#050508]/90 backdrop-blur-md text-zinc-100 rounded-[5px] border border-white/10 uppercase tracking-widest z-20">
                {mediaType === 'tv' ? 'SERIES' : 'MOVIE'}
              </div>

              {/* Language detail tag */}
              <div className="absolute top-3 right-3 px-2 py-0.5 text-[8.5px] font-sans font-bold bg-[#050508]/90 backdrop-blur-md border border-white/10 text-white rounded-[5px] flex items-center gap-0.5 z-20">
                <span>{getLanguageLabel()}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </div>

              {/* Immersive Title Overlay Text */}
              <h2 
                className="absolute bottom-3 left-4 right-4 font-display font-extrabold text-white text-base sm:text-lg md:text-[22px] leading-tight uppercase tracking-tight drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] z-20 truncate"
                style={{ letterSpacing: "-0.5px" }}
              >
                {title}
              </h2>
            </div>

            {/* Bottom Content Area */}
            <div className="p-4 flex flex-col justify-between flex-1 space-y-3 bg-[#0B0F19]">
              {/* Watch Now and Add Action Row */}
              <div className="flex items-center gap-2">
                {/* JioHotstar Pill shaped Play Button */}
                <button
                  onClick={handlePlayTrailer}
                  className="flex-1 bg-white hover:bg-zinc-200 text-black font-extrabold text-xs py-3 px-4 rounded-full flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] cursor-pointer shadow-lg tracking-wider uppercase group/play"
                  style={{ height: '48px' }}
                >
                  <Play className="w-4 h-4 fill-black text-black shrink-0 transition-transform duration-300 group-hover/play:scale-110" />
                  <span>Watch Now</span>
                </button>

                {/* Glassmorphic dark square Rate button */}
                <button
                  onClick={handleToggleRatingTray}
                  className={`w-12 h-12 rounded-full border text-white flex items-center justify-center cursor-pointer transition-all duration-300 shrink-0 overflow-hidden relative shadow-lg ${currentRating ? "bg-[#ff9d00]/20 border-[#ff9d00] hover:bg-[#ff9d00]/30 hover:shadow-[0_0_15px_rgba(255,157,0,0.5)]" : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"}`}
                  title={currentRating ? `Your Rating: ${currentRating}` : "Rate this"}
                >
                  <Star className={`w-5 h-5 transition-transform duration-300 ${currentRating ? "fill-[#ff9d00] text-[#ff9d00]" : "text-zinc-100 hover:scale-110"}`} />
                </button>

                {/* Glassmorphic dark square Add to Watchlist button with subtle orange glow */}
                {(onAddToWatchlist || userId) && (
                  <button
                    onClick={handleAddToWatchlist}
                    className="w-12 h-12 rounded-full bg-white/5 hover:bg-[#ff9d00]/20 border border-white/10 text-white flex items-center justify-center cursor-pointer transition-all duration-300 hover:border-[#ff9d00] hover:shadow-[0_0_15px_rgba(255,157,0,0.3)] shrink-0 overflow-hidden relative"
                    title={isSaved ? "Remove from Watchlist" : "Add to Watchlist"}
                  >
                    <AnimatePresence mode="wait">
                      {isSaved ? (
                        <motion.div
                          key="saved"
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.5, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Check className="w-5 h-5 text-green-500" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="unsaved"
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.5, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Plus className="w-5 h-5 text-zinc-100 transition-transform duration-300 hover:scale-110" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                )}
              </div>

              {/* Rating Tray Compact Expansion */}
              <AnimatePresence>
                {ratingTrayOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden bg-black/40 rounded-xl border border-white/10 backdrop-blur-md"
                  >
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">Your Rating</span>
                        {currentRating && (
                          <button onClick={handleRemoveRating} className="text-[10px] text-zinc-500 hover:text-red-400 font-semibold px-2 py-0.5 rounded transition">
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-1 group">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((starVal) => {
                          const isFilled = currentRating && currentRating >= starVal;
                          return (
                            <button
                              key={starVal}
                              onClick={(e) => handleSelectRating(e, starVal)}
                              className="peer relative flex-1 p-1 flex justify-center hover:scale-125 transition-transform"
                            >
                              <Star className={`w-4 h-4 ${isFilled ? "fill-[#ff9d00] text-[#ff9d00]" : "text-zinc-600"} hover:fill-[#ff9d00] hover:text-[#ff9d00]`} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Metadata row with dots separator */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-zinc-300 leading-none">
                <span className="text-amber-500 font-bold flex items-center gap-0.5 shrink-0" title="TMDB Rating">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  {rating}
                </span>
                {currentRating !== null && (
                  <>
                    <span>•</span>
                    <span className="text-[#ff9d00] font-bold flex items-center gap-0.5 shrink-0" title="Your Rating">
                      <Star className="w-3.5 h-3.5" />
                      <span className="tracking-tighter">{currentRating}</span>
                    </span>
                  </>
                )}
                <span>•</span>
                <span>{year}</span>
                <span>•</span>
                <span className="px-1.5 py-0.5 text-[9px] font-extrabold border border-white/20 rounded bg-white/5 uppercase tracking-normal">
                  {maturityRating}
                </span>
                <span>•</span>
                <span>{runtimeLabel}</span>
              </div>

              {/* Quality Badger + Classification Tags */}
              <div className="flex flex-wrap gap-1 leading-none">
                {qualityBadges.slice(0, 2).map((badge, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 text-[8px] font-extrabold tracking-widest bg-white/5 border border-white/10 rounded uppercase text-zinc-400"
                  >
                    {badge}
                  </span>
                ))}
                {genresArray.slice(0, 2).map((g, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 text-[8px] font-bold tracking-wide bg-white/[0.03] border border-transparent rounded text-zinc-400 uppercase"
                  >
                    {g}
                  </span>
                ))}
              </div>

              {/* Full summary text, clearly readable without cutoffs */}
              <div className="relative border-t border-white/5 pt-3 flex-1 pb-2">
                <p className="text-[11px] sm:text-xs text-zinc-400 leading-relaxed font-normal font-sans text-left whitespace-normal break-words">
                  {item.overview || "Match scoring critique with cinematic video stream. Stream in original high-definition audio."}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.isHoveredControl === nextProps.isHoveredControl &&
    prevProps.isAnyHoveredControl === nextProps.isAnyHoveredControl &&
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.title === nextProps.item.title &&
    prevProps.item.name === nextProps.item.name &&
    prevProps.item.overview === nextProps.item.overview &&
    prevProps.item.poster_path === nextProps.item.poster_path &&
    prevProps.item.backdrop_path === nextProps.item.backdrop_path &&
    prevProps.item.vote_average === nextProps.item.vote_average &&
    prevProps.watchlistIds?.length === nextProps.watchlistIds?.length &&
    (prevProps.watchlistIds === nextProps.watchlistIds || 
     prevProps.watchlistIds?.includes(String(prevProps.item.id)) === nextProps.watchlistIds?.includes(String(nextProps.item.id)))
  );
});

export default MovieCard;
