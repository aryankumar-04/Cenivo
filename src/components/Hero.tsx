import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Info, Plus, Check, Star, ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react';
import { robustFetch } from '../lib/utils';

interface HeroProps {
  onExploreTrending: () => void;
  onOpenDetails: (movie: any) => void;
  user: any;
  onAddToWatchlist?: (movie: any) => void;
  watchlistIds?: string[];
  slides?: any[];
}

export default function Hero({
  onExploreTrending,
  onOpenDetails,
  user,
  onAddToWatchlist,
  watchlistIds = [],
  slides
}: HeroProps) {
  const [featured, setFeatured] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [showTrailer, setShowTrailer] = useState(false);
  const [trailerKeys, setTrailerKeys] = useState<Record<string, string | null>>({});
  const [isMobile, setIsMobile] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [previewCompleted, setPreviewCompleted] = useState(false);
  const [slideProgress, setSlideProgress] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Post message to YouTube player when isMuted changes, avoiding iframe source reload/flash
  useEffect(() => {
    if (showTrailer && iframeRef.current) {
      const message = JSON.stringify({
        event: 'command',
        func: isMuted ? 'mute' : 'unMute',
        args: []
      });
      iframeRef.current.contentWindow?.postMessage(message, '*');
    }
  }, [isMuted, showTrailer]);

  // Synchronized active indicator auto-progress bar logic (pauses on hover)
  useEffect(() => {
    if (loading || featured.length <= 1) return;
    
    setSlideProgress(0);

    const currentMovie = featured[activeIndex];
    const hasTrailer = currentMovie ? !!trailerKeys[String(currentMovie.id)] : false;
    const duration = !isMobile && hasTrailer ? 35000 : 8000;
    const intervalTime = 50; 
    const step = 100 / (duration / intervalTime);

    const timer = setInterval(() => {
      if (!isHovered) {
        setSlideProgress((prev) => {
          const next = prev + step;
          return next >= 100 ? 100 : next;
        });
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [activeIndex, isHovered, trailerKeys, loading, featured, isMobile]);

  // Monitor responsive width to disable trailer autoplay on mobile
  useEffect(() => {
    const checkMobileWidth = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobileWidth();
    window.addEventListener('resize', checkMobileWidth);
    return () => window.removeEventListener('resize', checkMobileWidth);
  }, []);

  // Fetch Featured/Trending Movies for Hero Banner or set slides if passed
  useEffect(() => {
    if (slides && slides.length > 0) {
      setFeatured(slides);
      setLoading(false);
      return;
    }

    async function loadHeroContent() {
      try {
        const response = await robustFetch('/api/tmdb?path=trending');
        if (response.ok) {
          const data = await response.json();
          // Filter to items that have a backdrop path
          const items = (data.results || []).filter((item: any) => item.backdrop_path || item.poster_path);
          setFeatured(items.slice(0, 5));
        }
      } catch (err) {
        console.error('Error loading hero slides:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHeroContent();
  }, [slides]);

  // Fetch and cache actual video trailer lists from TMDB dynamically for ALL slides
  useEffect(() => {
    if (loading || featured.length === 0 || isMobile) return;

    featured.forEach((movie) => {
      if (!movie || !movie.id) return;
      const movieIdStr = String(movie.id);

      // Skip if already checked or cached
      if (trailerKeys[movieIdStr] !== undefined) return;

      // Handle custom/catalog-defined youtube_id values
      if (movie.youtube_id && movie.youtube_id !== "dQw4w9WgXcQ") {
        setTrailerKeys((prev) => ({ ...prev, [movieIdStr]: movie.youtube_id }));
        return;
      }

      async function fetchTrailer() {
        try {
          const type = movie.media_type || (movie.first_air_date ? "tv" : "movie");
          const response = await robustFetch(`/api/tmdb?path=details&id=${movie.id}&type=${type}`);
          if (response.ok) {
            const data = await response.json();
            const videos = data?.videos?.results || [];

            // Strict Filter for official and YouTube trailers
            const ytVideos = videos.filter((v: any) => v.site === "YouTube" && v.key);

            // 1. Official Trailer key
            const official = ytVideos.find((v: any) => v.type === "Trailer" && (v.official === true || String(v.official).toLowerCase() === "true"));

            if (official) {
              setTrailerKeys((prev) => ({ ...prev, [movieIdStr]: official.key }));
            } else {
              // 2. Unofficial / Any YouTube Trailer key
              const anyTrailer = ytVideos.find((v: any) => v.type === "Trailer");
              if (anyTrailer) {
                setTrailerKeys((prev) => ({ ...prev, [movieIdStr]: anyTrailer.key }));
              } else {
                // 3. Teaser key
                const teaser = ytVideos.find((v: any) => v.type === "Teaser");
                if (teaser) {
                  setTrailerKeys((prev) => ({ ...prev, [movieIdStr]: teaser.key }));
                } else {
                  setTrailerKeys((prev) => ({ ...prev, [movieIdStr]: null }));
                }
              }
            }
          } else {
            setTrailerKeys((prev) => ({ ...prev, [movieIdStr]: null }));
          }
        } catch (err) {
          console.error("Error prefetching active movie trailer:", err);
          setTrailerKeys((prev) => ({ ...prev, [movieIdStr]: null }));
        }
      }

      fetchTrailer();
    });
  }, [featured, loading, trailerKeys, isMobile]);

  // Reset playback and preview tracking states on active index change
  useEffect(() => {
    setShowTrailer(false);
    setPreviewCompleted(false);
  }, [activeIndex]);

  // Main controller for automated carousel advance & preview start
  useEffect(() => {
    if (featured.length <= 1) return;

    let advanceTimeout: NodeJS.Timeout | null = null;
    let previewStartTimeout: NodeJS.Timeout | null = null;
    let previewDurationTimeout: NodeJS.Timeout | null = null;

    const advanceSlide = () => {
      setActiveIndex((prev) => (prev + 1) % featured.length);
    };

    if (isMobile) {
      // Mobile behaves simply: static backdrop image, 8 second transition, respects hover
      if (!isHovered) {
        advanceTimeout = setTimeout(advanceSlide, 8000);
      }
    } else {
      // Desktop OTT-inspired smart playback timers
      const currentMovie = featured[activeIndex];
      const movieIdStr = currentMovie ? String(currentMovie.id) : '';
      const hasKey = movieIdStr ? trailerKeys[movieIdStr] : null;

      // Pause all transitional timers if hovered
      if (isHovered) {
        return;
      }

      if (showTrailer) {
        // If background video preview is playing, pause advance.
        // Play muted background preview for 30 seconds, then fade back to image and wait 3 seconds to advance
        previewDurationTimeout = setTimeout(() => {
          setShowTrailer(false);
          setPreviewCompleted(true);
          advanceTimeout = setTimeout(advanceSlide, 3000);
        }, 30000);
      } else if (previewCompleted) {
        // If preview has finished, transition to next slide
        advanceTimeout = setTimeout(advanceSlide, 3000);
      } else {
        // Show cinematic backdrop image first, wait 2 seconds before optionally starting preview
        previewStartTimeout = setTimeout(() => {
          if (hasKey) {
            setShowTrailer(true);
          } else {
            // Fallback to static backdrop with slow zoom: 8 seconds total screen time
            advanceTimeout = setTimeout(advanceSlide, 3000);
          }
        }, 2000);
      }
    }

    return () => {
      if (advanceTimeout) clearTimeout(advanceTimeout);
      if (previewStartTimeout) clearTimeout(previewStartTimeout);
      if (previewDurationTimeout) clearTimeout(previewDurationTimeout);
    };
  }, [activeIndex, featured, isHovered, isMobile, showTrailer, previewCompleted, trailerKeys]);

  if (loading || featured.length === 0) {
    return (
      <div className="relative h-[85vh] w-full bg-[#050505] flex items-center justify-center">
        <div className="animate-pulse space-y-6 w-full max-w-4xl px-8">
          <div className="h-6 bg-zinc-800 rounded w-1/4" />
          <div className="h-20 bg-zinc-800 rounded w-2/3" />
          <div className="h-10 bg-zinc-800 rounded w-1/2" />
          <div className="flex gap-4">
            <div className="h-12 bg-zinc-800 rounded w-32" />
            <div className="h-12 bg-zinc-800 rounded w-32" />
          </div>
        </div>
      </div>
    );
  }

  const activeMovie = featured[activeIndex];
  const title = activeMovie.title || activeMovie.name || "Cenivo Highlight";
  const overview = activeMovie.overview || "Cenivo's top recommended discovery watch choice this week.";
  const releaseYear = (activeMovie.release_date || activeMovie.first_air_date || "2024").substring(0, 4);
  const rating = activeMovie.vote_average ? activeMovie.vote_average.toFixed(1) : "8.5";
  
  // Genres parsing
  let genres = "Cinematic Discovery";
  if (Array.isArray(activeMovie.genres)) {
    genres = activeMovie.genres.map((g: any) => typeof g === 'string' ? g : g.name).slice(0, 3).join(' • ');
  } else if (activeMovie.genres && typeof activeMovie.genres === 'string') {
    genres = activeMovie.genres;
  }

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % featured.length);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + featured.length) % featured.length);
  };

  // Check if saved to watchlist
  const isSaved = watchlistIds.includes(String(activeMovie.id));

  // Build high-res backdrop URL
  const backdropUrl = activeMovie.backdrop_path?.startsWith('http') 
    ? activeMovie.backdrop_path 
    : `https://image.tmdb.org/t/p/original${activeMovie.backdrop_path}`;

  // Find trailer Key (YouTube) support (only when not on mobile)
  const activeTrailerKey = !isMobile ? (trailerKeys[String(activeMovie?.id)] || null) : null;

  return (
    <section 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative h-[85vh] sm:h-[90vh] w-full overflow-hidden bg-[#050508]"
    >
      {/* Decorative ambient glowing orbs in bottom-left and center to elevate visual richness */}
      <div className="absolute top-[20%] left-[-5%] w-[450px] height-[450px] rounded-full bg-gradient-to-tr from-[#ff9d00]/10 to-[#ff4d6d]/5 blur-[120px] pointer-events-none z-15" />
      <div className="absolute bottom-[10%] right-[10%] w-[350px] height-[350px] rounded-full bg-gradient-to-tr from-[#6c63ff]/8 to-transparent blur-[100px] pointer-events-none z-15" />

      {/* Background slide elements with smooth sliding & scaling zoom */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeMovie.id + "_" + (showTrailer && activeTrailerKey ? "trailer" : "backdrop")}
          className="absolute inset-0 w-full h-full"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1.01 }}
          exit={{ opacity: 0, scale: 1.0 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        >
          {/* Exact modern premium-grade dual-intensity visual mask overlays */}
          <div 
            className="absolute inset-0 z-20 pointer-events-none" 
            style={{
              background: "linear-gradient(90deg, rgba(0,0,0,0.40) 0%, rgba(0,0,0,0.18) 40%, rgba(0,0,0,0.05) 100%)"
            }}
          />
          <div 
            className="absolute inset-0 z-20 pointer-events-none" 
            style={{
              background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)"
            }}
          />
          
          {showTrailer && activeTrailerKey ? (
            <div className="absolute inset-0 w-full h-full z-10 bg-black overflow-hidden pointer-events-none">
              <iframe
                ref={iframeRef}
                src={`https://www.youtube.com/embed/${activeTrailerKey}?autoplay=1&mute=1&controls=0&loop=1&playlist=${activeTrailerKey}&modestbranding=1&rel=0&playsinline=1&disablekb=1&fs=0&iv_load_policy=3&enablejsapi=1`}
                title="Official Trailer Backdrop"
                className="w-full h-full border-0 scale-150 pointer-events-none"
                loading="lazy"
                style={{ 
                  pointerEvents: 'none',
                  filter: 'brightness(1.15) contrast(1.08) saturate(1.05)'
                }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          ) : (
            <motion.img
              src={backdropUrl}
              alt={title}
              className="w-full h-full object-cover object-center select-none"
              referrerPolicy="no-referrer"
              animate={{ scale: 1.06 }}
              transition={{ duration: 16, ease: "easeOut" }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Floating navigation controllers */}
      <button 
        onClick={handlePrev}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full border border-white/10 bg-black/40 backdrop-blur-md flex items-center justify-center hover:bg-white/10 hover:border-white/30 text-white transition-all cursor-pointer opacity-0 group-hover:opacity-100 hover:scale-105"
        style={{ opacity: 0.5 }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button 
        onClick={handleNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full border border-white/10 bg-black/40 backdrop-blur-md flex items-center justify-center hover:bg-white/10 hover:border-white/30 text-white transition-all cursor-pointer opacity-0 hover:scale-105"
        style={{ opacity: 0.5 }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Interactive Volume controller for trailer */}
      {showTrailer && activeTrailerKey && (
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="absolute right-6 bottom-24 sm:bottom-28 z-40 p-3 rounded-full bg-black/60 border border-white/10 hover:border-white/20 hover:bg-black text-white hover:scale-105 active:scale-95 cursor-pointer transition-all flex items-center justify-center"
          title={isMuted ? "Unmute Previews" : "Mute Previews"}
        >
          {isMuted ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5 animate-pulse" />}
        </button>
      )}

      {/* Hero content details aligned to bottom left */}
      <div className="absolute bottom-0 left-0 right-0 z-30 px-4 sm:px-8 lg:px-16 pb-12 sm:pb-16 lg:pb-24 flex flex-col md:flex-row items-end justify-between gap-8 max-w-7xl mx-auto w-full">
        
        {/* Text descriptions */}
        <div className="space-y-4 sm:space-y-6 text-left max-w-2xl">
          {/* Metadata tag badge row */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-[#ff9d00] bg-[#ff9d00]/10 border border-[#ff9d00]/30 rounded uppercase shadow-sm">
              CENIVO FEATURED
            </span>
            <span className="text-zinc-300 font-mono text-xs font-semibold">
              {releaseYear}
            </span>
            <div className="h-3.5 w-[1px] bg-white/20" />
            <div className="flex items-center gap-1 font-sans text-xs font-bold text-[#FFB347]">
              <Star className="w-3.5 h-3.5 fill-[#FFB347] text-[#FFB347] shrink-0" />
              <span>{rating}/10</span>
            </div>
            {genres && (
              <>
                <div className="h-3.5 w-[1px] bg-white/20" />
                <span className="text-xs text-zinc-300 font-sans tracking-wide">
                  {genres}
                </span>
              </>
            )}
          </div>

          {/* Large Title using responsive clamping, custom spacing, line-height */}
          <h1 className="font-display font-black text-white tracking-tighter drop-shadow-[0_12px_24px_rgba(0,0,0,0.85)] md:max-w-[55%] line-clamp-3 overflow-hidden" style={{ fontSize: "clamp(3rem, 5vw, 6rem)", lineHeight: 0.95, letterSpacing: "-2.8px", maxHeight: "280px" }}>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-100 to-zinc-400">{title}</span>
          </h1>

          {/* Overview text description */}
          <p className="font-sans text-sm sm:text-[15px] text-zinc-300 leading-relaxed font-normal line-clamp-3 md:line-clamp-4 max-w-lg drop-shadow-md">
            {overview}
          </p>

          {/* Call To Action Buttons */}
          <div className="flex flex-wrap items-center gap-3.5 pt-4 font-sans">
            {/* Play Trailer with the premium gradients, roundness, drop offsets */}
            <button
              onClick={() => onOpenDetails({ ...activeMovie, autoplayTrailer: true })}
              className="px-7 py-4 bg-gradient-to-r from-[#ff9d00] to-[#ff4d6d] text-white font-bold text-sm rounded-[18px] hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-[0_10px_30px_rgba(255,120,0,0.35)]"
            >
              <Play className="w-4.5 h-4.5 fill-white text-white" />
              <span>Watch Trailer</span>
            </button>

            {/* View Details modal overlay */}
            <button
              onClick={() => onOpenDetails(activeMovie)}
              className="px-6 py-4 bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold text-sm rounded-[18px] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer backdrop-blur-xl hover:-translate-y-0.5 active:translate-y-0"
            >
              <Info className="w-4.5 h-4.5" />
              <span>View Details</span>
            </button>

            {/* Watchlist toggle additions */}
            {onAddToWatchlist && (
              <button
                onClick={() => onAddToWatchlist(activeMovie)}
                className="p-4 bg-white/10 hover:bg-white/15 border border-white/10 rounded-[18px] transition-all duration-300 text-white cursor-pointer flex items-center justify-center shrink-0 hover:-translate-y-0.5 active:translate-y-0 backdrop-blur-xl overflow-hidden relative"
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
                       <Check className="w-4.5 h-4.5 text-green-500" />
                     </motion.div>
                   ) : (
                     <motion.div
                       key="unsaved"
                       initial={{ scale: 0.5, opacity: 0 }}
                       animate={{ scale: 1, opacity: 1 }}
                       exit={{ scale: 0.5, opacity: 0 }}
                       transition={{ duration: 0.2 }}
                     >
                       <Plus className="w-4.5 h-4.5 text-zinc-100 transition-transform duration-300 hover:scale-110" />
                     </motion.div>
                   )}
                </AnimatePresence>
              </button>
            )}
          </div>
        </div>

        {/* Indicators on the right */}
        <div id="hero-indicators" className="flex md:flex-col items-center justify-center gap-3.5 shrink-0 self-center md:self-end pb-2 md:pb-6 relative z-30">
          {featured.map((_, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className="group relative flex items-center justify-center focus:outline-none cursor-pointer"
                aria-label={`Go to slide ${idx + 1}`}
              >
                {/* Soft hover expand tooltip */}
                <div className="absolute right-8 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none hidden md:block z-50">
                  <span className="bg-black/90 text-[10px] font-mono text-zinc-300 px-3 py-1.5 rounded-lg border border-white/5 uppercase tracking-widest whitespace-nowrap shadow-xl">
                    {featured[idx]?.title || featured[idx]?.name || `Slide ${idx + 1}`}
                  </span>
                </div>

                {/* Main morphing base indicator wireframe */}
                <div
                  className={`relative transition-all duration-500 ease-out rounded-full overflow-hidden ${
                    isActive
                      ? 'w-12 h-2.5 md:w-2.5 md:h-14 bg-zinc-800 border border-white/10 shadow-[0_0_12px_rgba(255,255,255,0.05)]'
                      : 'w-2.5 h-2.5 bg-zinc-700/60 hover:bg-zinc-400 hover:scale-110'
                  }`}
                >
                  {/* Animated fill progress bar */}
                  {isActive && (
                    <div
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-white via-zinc-100 to-white md:bg-gradient-to-b md:from-white md:via-zinc-100 md:to-white shadow-[0_0_12px_rgba(255,255,255,0.9)] transition-all ease-linear"
                      style={{
                        width: isMobile ? `${slideProgress}%` : '100%',
                        height: !isMobile ? `${slideProgress}%` : '100%'
                      }}
                    />
                  )}
                </div>
                
                {/* Premium breathing indicator */}
                {isActive && (
                  <span className="absolute w-2 h-2 rounded-full bg-white opacity-40 animate-ping pointer-events-none" />
                )}
              </button>
            );
          })}
        </div>

      </div>
    </section>
  );
}
