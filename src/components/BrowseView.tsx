import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Star, Play, Info } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import MovieCard from './MovieCard';
import CenivoLogo from './CenivoLogo';
import { ALL_SHELVES } from '../lib/shelves';
import { robustFetch } from '../lib/utils';
import { getSharedObserver } from '../lib/intersectionObserverPool';

interface BrowseViewProps {
  user: any;
  watchlistIds: string[];
  onToggleWatchlist: (movie: any) => void;
  onOpenDetails: (movie: any) => void;
  shelfIdOverride?: string;
}

function VirtualizedGridCell({ children }: { children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cellRef.current;
    if (!el) return;

    const pool = getSharedObserver('1000px');
    pool.observe(el, (isIntersecting) => {
      setIsVisible(isIntersecting);
    });

    return () => {
      pool.unobserve(el);
    };
  }, []);

  return (
    <div ref={cellRef} className="w-full h-full aspect-[2/3] relative">
      {isVisible ? children : (
        <div className="w-full h-full rounded-[18px] bg-zinc-950/40 border border-white/5 animate-pulse" />
      )}
    </div>
  );
}

export default function BrowseView({
  user,
  watchlistIds,
  onToggleWatchlist,
  onOpenDetails,
  shelfIdOverride
}: BrowseViewProps) {
  const paramsFromRouter = useParams<{ shelfId: string }>();
  const shelfId = shelfIdOverride || paramsFromRouter.shelfId;
  const navigate = useNavigate();
  const location = useLocation();
  const initialData = location.state as { initialItems?: any[], title?: string, subtitle?: string } | null;

  const [items, setItems] = useState<any[]>(initialData?.initialItems || []);
  const [page, setPage] = useState(initialData?.initialItems && initialData.initialItems.length > 0 ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [heroMovie, setHeroMovie] = useState<any | null>(initialData?.initialItems?.[0] || null);
  const [profileScores, setProfileScores] = useState<any>(null);

  const loaderRef = useRef<HTMLDivElement>(null);

  // Map shelf ID to dynamic title & path
  let path = 'trending';
  let title = initialData?.title || 'Explore Collection';
  let subtitle = initialData?.subtitle || 'Discover premium curated entertainment.';
  let params = '';

  const matchedShelf = ALL_SHELVES.find((s) => s.id === shelfId);
  if (matchedShelf) {
    path = matchedShelf.route;
    title = matchedShelf.title;
    subtitle = matchedShelf.subtitle;
    if (matchedShelf.params) params = matchedShelf.params;
  } else if (shelfId === 'series') {
    path = 'tv_popular';
    title = 'Popular in Your Region';
    subtitle = 'Top loved series and television stories.';
  } else if (shelfId === 'anime') {
    path = 'anime';
    title = 'Elite Anime';
    subtitle = 'Handpicked animated masterworks.';
  }

  // Load user profile scores if authenticated
  useEffect(() => {
    const loadScores = async () => {
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          if (snap.exists()) {
            setProfileScores(snap.data().personalizationScores || null);
          }
        } catch (_) {}
      }
    };
    loadScores();
  }, [user]);

  // Scroll to top on mount and route change
  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    
    const resetScroll = () => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant' as ScrollBehavior
      });
    };

    resetScroll();
    // Safety fallback for layout hydration timing
    requestAnimationFrame(() => {
      resetScroll();
      setTimeout(resetScroll, 50);
    });
  }, [location.pathname]);

  // Initial load
  useEffect(() => {
    // Only reset state and fetch if we don't have initial data for this exact shelf
    if (initialData?.initialItems && initialData.initialItems.length > 0) {
       // We already have localized items, just ensure observer will kick in for page 2
       setItems(initialData.initialItems);
       setHeroMovie(initialData.initialItems[0]);
       setPage(2);
       setHasMore(true);
    } else {
       setItems([]);
       setPage(1);
       setHasMore(true);
       setHeroMovie(null);
       fetchNextBatch(1, true);
    }
  }, [shelfId, profileScores]);

  // Infinite Scroll Trigger via Intersection Observer
  useEffect(() => {
    if (loading || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((prevPage) => {
            const nextPage = prevPage + 1;
            fetchNextBatch(prevPage); // fetch the *current* target page, then increment
            return nextPage;
          });
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [loading, hasMore, items]);

  const fetchNextBatch = async (pageNum: number, isInitial = false) => {
    if (loading) return;
    setLoading(true);

    try {
      const scoresQuery = profileScores ? `&personalizationScores=${encodeURIComponent(JSON.stringify(profileScores))}` : '';
      const guestLogs = localStorage.getItem('cenivo_guest_interactions') || '[]';
      let url = `/api/tmdb?path=${path}&page=${pageNum}&userId=${user?.uid || ''}${scoresQuery}&guestInteractions=${encodeURIComponent(guestLogs)}`;
      if (params) {
        url += `&${params}`;
      }
      const response = await robustFetch(url);
      if (response.ok) {
        const data = await response.json();
        const results = data.results || [];
        if (results.length === 0) {
          setHasMore(false);
        } else {
          const mapped = results.map((x: any) => ({
            ...x,
            title: x.title || x.name,
            name: x.title || x.name,
            poster_path: x.poster_path || x.posterUrl,
            backdrop_path: x.backdrop_path,
            vote_average: x.vote_average || 8.0,
            release_date: x.release_date || x.first_air_date || '2024'
          }));

          setItems((prev) => {
            const combined = isInitial ? mapped : [...prev, ...mapped];
            // Set first item as dynamic hero backdrop
            if (isInitial && combined.length > 0) {
              setHeroMovie(combined[0]);
            }
            return combined;
          });
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error fetching dynamic streaming collection:', err);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  const dynamicRating = heroMovie
    ? Number(heroMovie.vote_average || 8.2).toFixed(1)
    : '8.4';

  const dynamicYear = heroMovie
    ? String(heroMovie.release_date || heroMovie.first_air_date || '2024').substring(0, 4)
    : '2025';

  const heroBackdrop = heroMovie?.backdrop_path
    ? (heroMovie.backdrop_path.startsWith('http') ? heroMovie.backdrop_path : `https://image.tmdb.org/t/p/w1280${heroMovie.backdrop_path}`)
    : heroMovie?.poster_path
    ? (heroMovie.poster_path.startsWith('http') ? heroMovie.poster_path : `https://image.tmdb.org/t/p/w1280${heroMovie.poster_path}`)
    : "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80";

  return (
    <div className="bg-[#050505] text-[#FFFFFF] min-h-screen selection:bg-white/20 flex flex-col justify-between font-sans relative antialiased" id={`browse-collection-${shelfId}`}>
      {/* Cinematic Frosted Top Header Section */}
      <div className="relative w-full h-[38vh] sm:h-[45vh] lg:h-[50vh] flex flex-col justify-end overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 z-0">
          <img
            src={heroBackdrop}
            alt={title}
            className="w-full h-full object-cover blur-sm opacity-35 scale-105 transition-all duration-1000 object-top"
            referrerPolicy="no-referrer"
          />
          {/* Subtle slow dark-ambient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-[#050505]/80" />
          <div className="absolute inset-0 bg-black/40" />
        </div>

        {/* Navigation back and brand overlay */}
        <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between px-4 sm:px-6 lg:px-8 z-30">
          <button
            onClick={handleBackToHome}
            className="group flex items-center gap-2 text-zinc-400 hover:text-white font-sans font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to explore</span>
          </button>
          <div className="scale-90 opacity-90">
            <CenivoLogo size="sm" />
          </div>
        </div>

        {/* Cinematic category details content block */}
        <div className="relative max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-8 sm:pb-12 z-10 text-left space-y-4">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 font-mono text-[9px] font-black uppercase text-zinc-300 bg-white/5 border border-white/10 rounded-full tracking-widest">
              Live Stream Collection
            </span>
            <h1 className="font-sans font-black text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight uppercase leading-none drop-shadow-md">
              {title}
            </h1>
            <p className="font-sans text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          </div>

          {/* Frosted Metadata Accent Block */}
          {heroMovie && (
            <div className="inline-flex flex-wrap items-center gap-4 py-2 px-4 rounded-xl bg-white/5 border border-white/5 text-xs text-zinc-300 font-sans backdrop-blur-md">
              <span className="font-extrabold text-white">Highlighted:</span>
              <span className="truncate max-w-[150px] font-bold text-zinc-100">{heroMovie.title}</span>
              <span className="text-zinc-600">•</span>
              <span className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                <span className="font-bold">{dynamicRating}</span>
              </span>
              <span className="text-zinc-600">•</span>
              <span className="font-bold">{dynamicYear}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-12">
        {items.length === 0 && loading ? (
          /* Initial loading shimmers matching OTT grids */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="w-full aspect-video rounded-2xl bg-zinc-900/50 border border-white/5 animate-pulse overflow-hidden flex flex-col justify-end p-4 relative"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="relative space-y-2">
                  <div className="h-4 bg-zinc-800 rounded w-2/3" />
                  <div className="h-3 bg-zinc-800 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-10">
            {/* Infinite-scrolling Content Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-12">
              {items.map((movie, idx) => (
                <div
                  key={movie.id ? `grid-${shelfId}-${movie.id}-${idx}` : `grid-${shelfId}-${idx}`}
                  className="w-full aspect-[2/3] relative"
                >
                  <VirtualizedGridCell>
                    <MovieCard
                      item={movie}
                      onOpenDetails={onOpenDetails}
                      onAddToWatchlist={onToggleWatchlist}
                      watchlistIds={watchlistIds}
                    />
                  </VirtualizedGridCell>
                </div>
              ))}
            </div>

            {/* Scrolling loader element sentinel */}
            <div
              ref={loaderRef}
              className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-400"
            >
              {loading && hasMore && (
                <>
                  <RefreshCw className="w-7 h-7 text-white animate-spin" />
                  <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 animate-pulse">
                    Streaming next cinematic nodes...
                  </p>
                </>
              )}
              {!hasMore && items.length > 0 && (
                <div className="py-6 text-center space-y-1">
                  <p className="font-sans text-xs font-bold text-zinc-500 uppercase tracking-widest">
                    You've reached the absolute end of this catalog
                  </p>
                  <p className="font-sans text-[10px] text-zinc-600">
                    Curated dynamically with live TMDB & AI taste mapping profiles.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* View All Page Footer */}
      <footer className="bg-[#050505] border-t border-white/5 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <CenivoLogo size="sm" />
          </div>
          <ul className="flex items-center gap-6 text-xs text-zinc-400">
            <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Contact Support</a></li>
          </ul>
          <div className="text-[10px] font-mono text-zinc-500">
            © {new Date().getFullYear()} Cenivo. Infinite scroll streaming active. Powered by Gemini.
          </div>
        </div>
      </footer>
    </div>
  );
}
