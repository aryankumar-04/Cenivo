import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RefreshCw, ArrowRight } from 'lucide-react';
import MovieCard from './MovieCard';
import { getSharedObserver } from '../lib/intersectionObserverPool';

interface ContentRailProps {
  key?: React.Key;
  title: string;
  subtitle?: string;
  items: any[];
  onOpenDetails: (item: any) => void;
  onAddToWatchlist?: (item: any) => void;
  watchlistIds?: string[];
  shelfId: string;
  onLoadMore?: (shelfId: string) => void;
  isLoadingMore?: boolean;
}

const ContentRail = React.memo(function ContentRail({
  title,
  subtitle,
  items,
  onOpenDetails,
  onAddToWatchlist,
  watchlistIds = [],
  shelfId,
  onLoadMore,
  isLoadingMore = false
}: ContentRailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [isShelfVisible, setIsShelfVisible] = useState(true);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;

    const pool = getSharedObserver('1200px');
    pool.observe(el, (isIntersecting) => {
      setIsShelfVisible(isIntersecting);
    });

    return () => {
      pool.unobserve(el);
    };
  }, []);

  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const [scrollProgress, setScrollProgress] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hoveredAlign, setHoveredAlign] = useState<'left' | 'right' | 'center'>('center');

  const handleCardHoverChange = React.useCallback((idx: number, hovering: boolean, headingPos?: 'left'|'right'|'center') => {
    if (hovering) {
      setHoveredIdx(idx);
      if (headingPos) setHoveredAlign(headingPos);
    } else {
      setHoveredIdx(prev => prev === idx ? null : prev);
    }
  }, []);

  const [scrollX, setScrollX] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(1200);

  const getItemWidth = () => {
    if (typeof window === 'undefined') return 236;
    if (window.innerWidth < 640) return 156;
    if (window.innerWidth < 1024) return 196;
    return 236;
  };

  const navigate = useNavigate();

  // Monitor scrolling to calculate arrow visibilities and auto preloading
  const checkScrollState = () => {
    const el = containerRef.current;
    if (!el) return;
    
    setScrollX(el.scrollLeft);
    setViewportWidth(el.clientWidth || window.innerWidth);
    
    // Left arrow visible if scrolled past 10px
    setShowLeftArrow(el.scrollLeft > 10);
    
    // Right arrow visible if there's remaining scroll space
    const maxScroll = el.scrollWidth - el.clientWidth;
    setShowRightArrow(el.scrollLeft < maxScroll - 10);

    // Calculate scroll progress percentage:
    if (maxScroll > 0) {
      setScrollProgress((el.scrollLeft / maxScroll) * 100);
    }

    // Trigger scrolling activity status for custom glass progress indicator fade-out
    setIsScrolling(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 1500);

    // AUTO-PRELOADING LOGIC for horizontal streaming continuation
    // Trigger more content loading automatically once scrolled within 400px of the edge
    if (onLoadMore && !isLoadingMore && el.scrollLeft >= maxScroll - 400 && maxScroll > 50) {
      onLoadMore(shelfId);
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    let rAFTimeout: number | null = null;
    const throttledScroll = () => {
      if (rAFTimeout === null) {
        rAFTimeout = window.requestAnimationFrame(() => {
          checkScrollState();
          rAFTimeout = null;
        });
      }
    };
    
    el.addEventListener('scroll', throttledScroll, { passive: true });
    
    // Initial check
    checkScrollState();
    
    // Resize observer to update on window resizing
    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(() => checkScrollState());
    });
    observer.observe(el);
    
    return () => {
      el.removeEventListener('scroll', throttledScroll);
      observer.disconnect();
      if (rAFTimeout !== null) window.cancelAnimationFrame(rAFTimeout);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [items]);

  // Click scroll logic
  const handleScroll = (direction: 'left' | 'right') => {
    const el = containerRef.current;
    if (!el) return;

    const scrollAmount = el.clientWidth * 0.75;
    const targetScroll = direction === 'left' 
      ? el.scrollLeft - scrollAmount 
      : el.scrollLeft + scrollAmount;

    el.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    
    if ((e.target as HTMLElement).closest('button')) return;

    setIsPointerDown(true);
    setIsDragging(false);
    setStartX(e.pageX - el.offsetLeft);
    setScrollLeftState(el.scrollLeft);
    el.style.scrollBehavior = 'auto';
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDown) return;
    const el = containerRef.current;
    if (!el) return;

    const x = e.pageX - el.offsetLeft;
    const walk = x - startX;
    
    if (Math.abs(walk) > 5) {
      setIsDragging(true);
    }
    
    el.scrollLeft = scrollLeftState - (walk * 1.5);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsPointerDown(false);
    const el = containerRef.current;
    if (!el) return;
    
    el.style.scrollBehavior = 'smooth';
    checkScrollState();
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPointerDown) {
      setIsPointerDown(false);
      const el = containerRef.current;
      if (el) el.style.scrollBehavior = 'smooth';
    }
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (isDragging) {
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(false);
    }
  };

  return (
    <div ref={railRef} className="relative group/rail space-y-5 mb-[80px] text-left" id={`content-rail-${shelfId}`}>
      {/* Title block with JioHotstar Typography Specs */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between px-4 sm:px-6 lg:px-[48px] gap-2">
        <div className="space-y-1">
          <h3 
            className="font-display font-black text-[22px] sm:text-[30px] md:text-[38px] lg:text-[48px] text-white tracking-tight leading-none"
            style={{ letterSpacing: "-1.8px" }}
          >
            {title}
          </h3>
          {subtitle && (
            <p className="font-sans text-xs sm:text-sm md:text-[18px] text-white/65 font-medium leading-none pt-1">
              {subtitle}
            </p>
          )}
        </div>
        
        {shelfId && (
          <button
            onClick={() => navigate(`/browse/${shelfId}`, { state: { initialItems: items, title, subtitle } })}
            className="text-[10px] sm:text-xs font-mono font-bold text-[#ff9d00] hover:text-[#ff4d6d] hover:scale-105 transition-all cursor-pointer flex items-center gap-1 uppercase tracking-wider md:pb-1 shrink-0"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5 animate-pulse" />
          </button>
        )}
      </div>

      {/* Horizontally scrolling track layout */}
      <div className="relative">
        
        {/* Navigation Arrow buttons (Floating glass circles with cinematic hover) */}
        {showLeftArrow && (
          <button
            onClick={() => handleScroll('left')}
            className="absolute left-[24px] md:left-[48px] top-1/2 -translate-y-1/2 z-40 w-12 h-12 rounded-full border border-white/10 bg-[#0E1017]/85 backdrop-blur-xl flex items-center justify-center hover:bg-white text-zinc-400 hover:text-black hover:border-white hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer opacity-0 group-hover/rail:opacity-100 shadow-[0_4px_16px_rgba(0,0,0,0.8)]"
            style={{ top: 'calc(50% - 10px)' }}
          >
            <ChevronLeft className="w-6 h-6 shrink-0" />
          </button>
        )}
        
        {showRightArrow && (
          <button
            onClick={() => handleScroll('right')}
            className="absolute right-[24px] md:right-[48px] top-1/2 -translate-y-1/2 z-40 w-12 h-12 rounded-full border border-white/10 bg-[#0E1017]/85 backdrop-blur-xl flex items-center justify-center hover:bg-white text-zinc-400 hover:text-black hover:border-white hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer opacity-0 group-hover/rail:opacity-100 shadow-[0_4px_16px_rgba(0,0,0,0.8)]"
            style={{ top: 'calc(50% - 10px)' }}
          >
            <ChevronRight className="w-6 h-6 shrink-0" />
          </button>
        )}

        {/* Rail container - generous vertical padding prevents cards from clipping during 420px absolute overlays */}
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onClickCapture={handleClickCapture}
          className="overflow-x-auto whitespace-nowrap scroll-smooth flex snap-x snap-mandatory gap-4 px-4 sm:px-6 lg:px-[48px] py-14 scrollbar-none cursor-grab active:cursor-grabbing relative select-none"
        >
          {(() => {
            const itemWidth = getItemWidth();
            const totalWidth = items.length * itemWidth;

            if (!isShelfVisible) {
              return (
                <div 
                  style={{ width: `${totalWidth}px` }} 
                  className="shrink-0 h-[100px] inline-block pointer-events-none"
                />
              );
            }

            const keepMargin = 3;
            const startIndex = Math.max(0, Math.floor(scrollX / itemWidth) - keepMargin);
            const endIndex = Math.min(items.length - 1, Math.ceil((scrollX + viewportWidth) / itemWidth) + keepMargin);

            return (
              <>
                {startIndex > 0 && (
                  <div 
                    style={{ width: `${startIndex * itemWidth}px` }} 
                    className="shrink-0 h-full inline-block pointer-events-none"
                  />
                )}

                {items.map((movie, idx) => {
                  if (idx < startIndex || idx > endIndex) return null;

                  const isThisHovered = hoveredIdx === idx;
                  const isAnyHovered = hoveredIdx !== null;

                  // Compute static width and aspect ratio for true OTT layout stability
                  let transformStyle = '';
                  if (isAnyHovered && !isThisHovered) {
                    const shiftAmount = typeof window !== 'undefined' && window.innerWidth < 640 ? 100 : typeof window !== 'undefined' && window.innerWidth < 1024 ? 140 : 180;
                    if (hoveredAlign === 'left') {
                      if (idx > hoveredIdx) {
                        transformStyle = `translate3d(${shiftAmount}px, 0, 0)`;
                      }
                    } else if (hoveredAlign === 'right') {
                      if (idx < hoveredIdx) {
                        transformStyle = `translate3d(-${shiftAmount}px, 0, 0)`;
                      }
                    } else {
                      if (idx < hoveredIdx) {
                        transformStyle = `translate3d(-${shiftAmount / 2}px, 0, 0)`;
                      } else if (idx > hoveredIdx) {
                        transformStyle = `translate3d(${shiftAmount / 2}px, 0, 0)`;
                      }
                    }
                  }

                  return (
                    <div
                      key={movie.id ? `${shelfId}-${movie.id}-${idx}` : `${shelfId}-${idx}`}
                      className="w-[140px] sm:w-[180px] md:w-[220px] aspect-[2/3] shrink-0 snap-start inline-block relative select-none animate-in fade-in duration-300"
                      style={{
                        transform: transformStyle,
                        transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
                        zIndex: isThisHovered ? 50 : 10,
                        willChange: transformStyle ? 'transform' : 'auto',
                      }}
                    >
                      <MovieCard
                        item={movie}
                        onOpenDetails={onOpenDetails}
                        onAddToWatchlist={onAddToWatchlist}
                        watchlistIds={watchlistIds}
                        isHoveredControl={isThisHovered}
                        onHoverChangeControl={(hovering, headingPos) => handleCardHoverChange(idx, hovering, headingPos)}
                      />
                    </div>
                  );
                })}

                {endIndex < items.length - 1 && (
                  <div 
                    style={{ width: `${(items.length - 1 - endIndex) * itemWidth}px` }} 
                    className="shrink-0 h-full inline-block pointer-events-none"
                  />
                )}
              </>
            );
          })()}

          {/* Inline Shimmer loading card for seamless infinite feeling scrolling */}
          {isLoadingMore && (
            <div className="w-[140px] sm:w-[180px] md:w-[220px] shrink-0 snap-start inline-flex items-center justify-center aspect-[2/3] rounded-xl bg-zinc-950/40 border border-white/5 animate-pulse relative">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <RefreshCw className="w-5 h-5 text-zinc-500 animate-spin z-10" />
            </div>
          )}
        </div>

        {/* Custom Cinematic Row Horizontal Scroll Indicator Track & Thumb */}
        <div 
          className="absolute bottom-2 left-1/2 -translate-x-1/2 w-44 h-[3px] bg-white/5 rounded-full overflow-hidden transition-all duration-500 pointer-events-none"
          style={{ opacity: isScrolling ? 0.8 : 0 }}
        >
          <div 
            className="h-full bg-gradient-to-r from-[#ff9d00] via-[#ff4d6d] to-[#6c63ff] shadow-[0_0_10px_rgba(255,140,0,0.6)] rounded-full transition-all duration-100 ease-out"
            style={{
              width: '35%',
              transform: `translateX(${scrollProgress * 1.85}%)`
            }}
          />
        </div>
      </div>
    </div>
  );
});

export default ContentRail;
