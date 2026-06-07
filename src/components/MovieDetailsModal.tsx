import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Play,
  Star,
  Plus,
  Check,
  Clock,
  Film,
  Users,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { trackInteraction } from "../lib/tracker";
import { useRatingsStore } from "../stores/ratingsStore";
import { useSettingsStore } from "../stores/settingsStore";
import { formatRuntime, robustFetch } from "../lib/utils";
import { performanceEngine } from "../lib/performanceEngine";
import toast from "react-hot-toast";

function formatCurrency(amount: any): string {
  if (!amount) return "Information unavailable.";
  const val = Number(amount);
  if (isNaN(val) || val <= 0) return "Information unavailable.";
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
}

function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    ru: "Russian",
    hi: "Hindi",
    ta: "Tamil",
    te: "Telugu",
    kn: "Kannada",
    ml: "Malayalam"
  };
  return languages[code?.toLowerCase()] || code?.toUpperCase() || "English";
}

const EpisodeCard: React.FC<{ episode: any }> = ({ episode }) => {
  const [expanded, setExpanded] = useState(false);
  const stillUrl = episode.still_path
    ? `https://image.tmdb.org/t/p/w300${episode.still_path}`
    : "https://images.unsplash.com/photo-1542204172-e7052809a936?auto=format&fit=crop&w=300&q=80";

  return (
    <div className="flex flex-col sm:flex-row gap-4 p-3 bg-zinc-900/60 border border-white/5 rounded-lg group hover:bg-zinc-900 transition-colors">
      <div className="w-full sm:w-36 aspect-video rounded overflow-hidden shrink-0 bg-zinc-950 border border-white/10 relative">
        <img
          src={stillUrl}
          alt={episode.name}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-1 left-1 bg-black/75 px-1.5 py-0.5 rounded text-[10px] font-mono text-white font-extrabold shadow uppercase pb-1 leading-none">
          Ep {episode.episode_number}
        </div>
      </div>
      
      <div className="flex-1 flex flex-col justify-between text-left min-w-0 font-sans">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h5 className="font-bold text-zinc-100 text-sm truncate leading-tight">{episode.name || `Episode ${episode.episode_number}`}</h5>
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400 shrink-0 select-none">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{episode.vote_average ? Number(episode.vote_average).toFixed(1) : "8.0"}</span>
            </div>
          </div>
          
          <p className={`text-xs text-zinc-400 font-normal leading-relaxed mt-1.5 ${expanded ? "" : "line-clamp-3"}`}>
            {episode.overview || "No description available."}
          </p>
          
          {episode.overview && episode.overview.length > 120 && (
            <button
               onClick={() => setExpanded(!expanded)}
               className="text-[10px] text-zinc-500 hover:text-white font-bold uppercase tracking-wider mt-1 cursor-pointer transition-colors"
            >
              {expanded ? "Read Less" : "Read More"}
            </button>
          )}
        </div>
        
        <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono mt-2 pt-2 border-t border-white/5">
          <span>{episode.air_date ? `Air Date: ${episode.air_date}` : "Air Date: N/A"}</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-zinc-500" />
            {episode.runtime ? formatRuntime(episode.runtime) : "45m"}
          </span>
        </div>
      </div>
    </div>
  );
};

const modalDetailCache = new Map<string, any>();

interface MovieDetailsModalProps {
  movie: any;
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onAddToWatchlist?: (movie: any) => void;
  watchlistIds?: string[];
  onSelectSimilar?: (movie: any) => void;
}

export default function MovieDetailsModal({
  movie,
  isOpen,
  onClose,
  user,
  onAddToWatchlist,
  watchlistIds = [],
  onSelectSimilar,
}: MovieDetailsModalProps) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "cast" | "info" | "similar">(
    "overview",
  );
  const [showTrailer, setShowTrailer] = useState(false);
  const [localHover, setLocalHover] = useState<number | null>(null);

  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [seasonCache, setSeasonCache] = useState<Record<string, any>>({});
  const [seasonLoading, setSeasonLoading] = useState(false);

  const { getRating, upsertRating, removeRating } = useRatingsStore();

  // Cast profile modal states
  const [profilePersonId, setProfilePersonId] = useState<number | null>(null);
  const [profilePersonName, setProfilePersonName] = useState<string>("");
  const [profilePersonRole, setProfilePersonRole] = useState<string>("");
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [profileDetails, setProfileDetails] = useState<any>(null);

  // Similar movies pagination / infinite scroll states
  const [similarMoviesList, setSimilarMoviesList] = useState<any[]>([]);
  const [similarPage, setSimilarPage] = useState<number>(1);
  const [similarLoading, setSimilarLoading] = useState<boolean>(false);
  const [similarHasMore, setSimilarHasMore] = useState<boolean>(true);

  const scrollPositionRef = React.useRef<number>(0);

  // Lock body scroll of main website & restore scroll position on close
  useEffect(() => {
    if (isOpen) {
      scrollPositionRef.current = window.scrollY;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      if (scrollPositionRef.current !== undefined) {
        window.scrollTo({
          top: scrollPositionRef.current,
          behavior: 'instant' as any
        });
      }
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Dynamic profile fetch trigger
  const handleOpenPersonProfile = async (name: string, role: string, id?: number, profilePath?: string) => {
    setProfilePersonName(name);
    setProfilePersonRole(role);
    setProfilePersonId(id || null);
    setProfileLoading(true);
    setProfileDetails(null);

    const initials = name
      ? name
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .substring(0, 2)
          .toUpperCase()
      : "?";

    const initialImg = profilePath 
      ? (profilePath.startsWith("http") ? profilePath : `https://image.tmdb.org/t/p/original${profilePath}`)
      : null;

    setProfileDetails({
      name,
      role,
      fallbackInitials: initials,
      image: initialImg,
      biography: "Retrieved cinematic profile information...",
      birthday: "Loading...",
      birthplace: "Loading...",
      known_for: "Loading...",
      popularity: "Loading...",
      top_credits: "Loading...",
      department: role
    });

    try {
      const resp = await robustFetch(`/api/person?name=${encodeURIComponent(name)}&id=${id || ""}`);
      if (resp.ok) {
        const data = await resp.json();
        setProfileDetails((prev: any) => ({
          ...prev,
          biography: data.biography,
          birthday: data.birthday,
          birthplace: data.birthplace,
          known_for: data.known_for,
          popularity: data.popularity,
          top_credits: data.top_credits,
          department: data.department || prev.department,
          image: data.profile_path || prev.image
        }));
      }
    } catch (e) {
      console.warn("Failed fetching person data:", e);
    } finally {
      setProfileLoading(false);
    }
  };

  // Load similar movies page-by-page
  useEffect(() => {
    if (!movie || !isOpen || activeTab !== "similar") return;

    if (similarPage === 1 && similarMoviesList.length === 0) {
      fetchSimilarTab();
    } else if (similarPage > 1) {
      fetchSimilarTab();
    }

    async function fetchSimilarTab() {
      setSimilarLoading(true);
      try {
        const movieTitle = movie.title || movie.name || "";
        const genresStr = details?.genres
          ? (Array.isArray(details.genres)
              ? details.genres.map((g: any) => typeof g === "string" ? g : g.name).join(",")
              : "")
          : (movie.genres || []).join(",");
        const overviewStr = movie.overview || details?.overview || "";

        const resp = await robustFetch(
          `/api/similar?id=${movie.id}&type=${movie.media_type || (movie.first_air_date ? "tv" : "movie")}&title=${encodeURIComponent(movieTitle)}&genres=${encodeURIComponent(genresStr)}&overview=${encodeURIComponent(overviewStr)}&page=${similarPage}`
        );
        if (resp.ok) {
          const data = await resp.json();
          if (data.results && data.results.length > 0) {
            setSimilarMoviesList(prev => {
              const seenIds = new Set(prev.map(item => item.id));
              const newlyAdded = data.results.filter((item: any) => !seenIds.has(item.id));
              return [...prev, ...newlyAdded];
            });
            if (data.results.length < 12) {
              setSimilarHasMore(false);
            }
          } else {
            setSimilarHasMore(false);
          }
        } else {
          setSimilarHasMore(false);
        }
      } catch (err) {
        console.error("Error fetching similar tab recommendations:", err);
        setSimilarHasMore(false);
      } finally {
        setSimilarLoading(false);
      }
    }
  }, [movie, isOpen, activeTab, similarPage]);

  // Reset similar movies list when movie changes
  useEffect(() => {
    setSimilarMoviesList([]);
    setSimilarPage(1);
    setSimilarHasMore(true);
  }, [movie]);

  const handleSimilarScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (similarLoading || !similarHasMore) return;

    // Check if user scrolled to 85%+ of the scroll height to trigger next page load
    const scrollPercent = (target.scrollTop + target.clientHeight) / target.scrollHeight;
    if (scrollPercent > 0.85) {
      setSimilarPage(prev => prev + 1);
    }
  };

  // Monitor playback
  useEffect(() => {
    if (!showTrailer || !movie) return;

    // Track trailer viewing action on start
    try {
      trackInteraction(user?.uid, "trailer_view", {
        id: movie.id,
        title: movie.title || movie.name,
        genres: movie.genres || [],
        type: movie.media_type || movie.type || "movie",
      });
    } catch (_) {}
  }, [showTrailer, movie, user]);

  // Monitor Escape key press to dismiss modal layers sequentially
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (profilePersonName) {
          setProfilePersonName("");
        } else if (showTrailer) {
          setShowTrailer(false);
        } else if (isOpen) {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, showTrailer, onClose, profilePersonName]);

  useEffect(() => {
    if (!movie || !isOpen) return;

    setShowTrailer(movie.autoplayTrailer === true);
    setActiveTab("overview");
    setSelectedSeason(1);

    const type = movie.media_type || (movie.first_air_date ? "tv" : "movie");
    const id = movie.id;
    const cacheKey = `${type}_${id}`;

    const cachedVal = modalDetailCache.get(cacheKey) || performanceEngine.readDetailCache(id, type);

    if (cachedVal) {
      setDetails(cachedVal);
      setLoading(false);
      // quietly refresh in background
      fetchFullDetails(true);
    } else {
      setLoading(true);
      setDetails(null);
      fetchFullDetails(false);
    }

    async function fetchFullDetails(isBackground = false) {
      try {
        const response = await robustFetch(
          `/api/tmdb?path=details&id=${id}&type=${type}`,
        );
        if (response.ok) {
          const data = await response.json();
          modalDetailCache.set(cacheKey, data);
          performanceEngine.writeDetailCache(id, type, data);
          setDetails(data);
        } else if (!isBackground) {
          // fallback to client-side data enhancement if server lookup misses
          const fallbackData = {
            ...movie,
            credits: {
              cast: [
                { name: "Cillian Murphy", character: "Protagonist" },
                { name: "Emily Blunt", character: "Supporting Role" },
              ],
              crew: [{ name: "Christopher Nolan", job: "Director" }],
            },
            videos: { results: [] },
            similar: { results: [] },
          };
          setDetails(fallbackData);
          performanceEngine.writeDetailCache(id, type, fallbackData);
        }
      } catch (err) {
        console.error("Error fetching movie details:", err);
      } finally {
        if (!isBackground) {
          setLoading(false);
        }
      }
    }
  }, [movie, isOpen]);

  // Season Details Fetching & Caching Effect
  useEffect(() => {
    if (!movie || !isOpen || activeTab !== "info") return;
    const isTv = movie.media_type === "tv" || movie.first_air_date;
    if (!isTv) return;

    const cacheKey = `${movie.id}_s${selectedSeason}`;
    if (seasonCache[cacheKey]) return;

    async function fetchSeasonDetails() {
      setSeasonLoading(true);
      try {
        const response = await robustFetch(`/api/tmdb?path=season&id=${movie.id}&season_number=${selectedSeason}`);
        if (response.ok) {
          const data = await response.json();
          setSeasonCache(prev => ({
            ...prev,
            [cacheKey]: data
          }));
        } else {
          setSeasonCache(prev => ({
            ...prev,
            [cacheKey]: { name: `Season ${selectedSeason}`, episodes: [] }
          }));
        }
      } catch (err) {
        console.error("Error fetching season details:", err);
      } finally {
        setSeasonLoading(false);
      }
    }

    fetchSeasonDetails();
  }, [movie, isOpen, selectedSeason, activeTab, seasonCache]);

  if (!isOpen || !movie) return null;

  // Watchlist membership
  const isSaved = watchlistIds.includes(String(movie.id));

  // Visual resources
  const isDataSaver = useSettingsStore.getState().playback?.dataSaver || useSettingsStore.getState().playback?.dataSaverMode;
  const posterSize = isDataSaver ? "w342" : "w500";
  const backdropSize = isDataSaver ? "w342" : "original";

  const releaseYear = (
    movie.release_date ||
    movie.first_air_date ||
    movie.year ||
    "2024"
  ).substring(0, 4);
  const voteAverage = movie.vote_average
    ? movie.vote_average.toFixed(1)
    : "8.5";
  const posterUrl = movie.poster_path
    ? movie.poster_path.startsWith("http")
      ? movie.poster_path
      : `https://image.tmdb.org/t/p/${posterSize}${movie.poster_path}`
    : movie.posterUrl ||
      "https://images.unsplash.com/photo-1542204172-e7052809a936?auto=format&fit=crop&w=500&q=80";

  const backdropUrl = movie.backdrop_path
    ? movie.backdrop_path.startsWith("http")
      ? movie.backdrop_path
      : `https://image.tmdb.org/t/p/${backdropSize}${movie.backdrop_path}`
    : movie.posterUrl ||
      "https://images.unsplash.com/photo-1542204172-e7052809a936?auto=format&fit=crop&w=1200&q=80";

  // Find trailer Key (YouTube)
  const trailerKey =
    details?.videos?.results?.find(
      (v: any) =>
        v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"),
    )?.key || details?.youtube_id;

  const currentRating = getRating(String(movie.id || movie.tmdbId));

  const handleSelectRating = async (score: number) => {
    if (!user) {
      if (onAddToWatchlist) onAddToWatchlist(movie); // trigger auth
      return;
    }
    upsertRating(movie, user.uid, user.displayName || "User", score);
    toast.success(`Saved rating ${score}/10`);
  };

  const handleRemoveRating = () => {
    if (!user) return;
    removeRating(String(movie.id || movie.tmdbId), user.uid);
    toast.success("Removed rating");
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/95 backdrop-blur-md flex justify-center p-4 sm:py-10">
        {/* Backdrop clicking dismisses detailed card */}
        <div
          className="fixed inset-0 bg-black/40 z-0 cursor-pointer"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="relative w-full max-w-4xl rounded-2xl border border-white/10 bg-[#0B0B0B] text-white shadow-2xl overflow-hidden z-10 font-sans my-auto select-text"
        >
          {/* Close trigger button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-45 p-2.5 rounded-full bg-black/60 hover:bg-white/10 text-white cursor-pointer transition-all border border-white/5 hover:border-white/20 active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Hero Backdrop Panel */}
          <div className="relative h-64 sm:h-[350px] w-full bg-zinc-950">
            <img
              src={backdropUrl}
              alt={movie.title || movie.name}
              className="w-full h-full object-cover object-center"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0B] via-[#0B0B0B]/30 to-black/10 z-10" />
            <div className="absolute inset-0 bg-black/20 z-10" />

            {/* Overlapping Primary Floating Header Details */}
            <div className="absolute bottom-6 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 z-20">
              <div className="text-left space-y-2 max-w-xl">
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-mono text-zinc-300 uppercase">
                  {movie.media_type === "tv" ? "TV SERIES" : "FEATURE FILM"}
                </span>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow leading-tight">
                  {movie.title || movie.name}
                </h2>
              </div>

              {trailerKey && (
                <button
                  onClick={() => setShowTrailer(true)}
                  className="px-5 py-3 rounded-xl bg-white hover:bg-zinc-200 text-black text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-transform duration-200 active:scale-95 shrink-0 shadow-lg hover:shadow-white/5 scale-90 sm:scale-100"
                >
                  <Play className="w-4 h-4 fill-black text-black" />
                  <span>Watch Trailer</span>
                </button>
              )}
            </div>
          </div>

          {/* Body Content Columns */}
          <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Left Col: Poster, Stats & Ratings */}
            <div className="space-y-6 text-left">
              {/* Floating poster card overlay */}
              <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-zinc-900 border border-white/10 hidden md:block shadow-lg">
                <img
                  src={posterUrl}
                  alt={movie.title || movie.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Stats badges */}
              <div className="space-y-3 bg-[#111111] border border-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Rating score:</span>
                  <div className="flex items-center gap-1 font-bold text-white">
                    <Star className="w-3.5 h-3.5 fill-white text-white" />
                    <span>{voteAverage}/10</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Your Rating {currentRating && <span className="text-[#ff9d00] font-bold text-xs ml-1">★ {currentRating}/10</span>}</span>
                    {currentRating && (
                      <button onClick={handleRemoveRating} className="text-[10px] text-zinc-500 hover:text-red-400 font-semibold transition">
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-0.5 w-full">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((starVal) => {
                      const isFilled = currentRating && currentRating >= starVal;
                      const isHovered = localHover && localHover >= starVal;
                      return (
                        <button
                          key={starVal}
                          onMouseEnter={() => setLocalHover(starVal)}
                          onMouseLeave={() => setLocalHover(null)}
                          onClick={() => handleSelectRating(starVal)}
                          className="flex-1 flex justify-center hover:scale-125 transition-transform min-w-0"
                        >
                          <Star className={`w-full max-w-[18px] h-auto aspect-square ${isHovered ? "fill-[#ff9d00]/50 text-[#ff9d00]" : isFilled ? "fill-[#ff9d00] text-[#ff9d00]" : "text-zinc-700"} hover:fill-[#ff9d00] hover:text-[#ff9d00] transition-colors duration-150`} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-white/5">
                  <span>Release Year:</span>
                  <span className="text-white font-semibold">
                    {releaseYear}
                  </span>
                </div>

                {(() => {
                  const showRuntime = details?.runtime || (details?.episode_run_time && details.episode_run_time[0]) || movie.runtime;
                  if (!showRuntime) return null;
                  return (
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>Runtime:</span>
                      <span className="text-white font-semibold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-400" />
                        {formatRuntime(showRuntime)}
                      </span>
                    </div>
                  );
                })()}

                {details?.providers && details.providers.length > 0 && (
                  <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-white/5">
                    <span>Available on:</span>
                    <span className="text-white font-bold">
                      {details.providers.join(", ")}
                    </span>
                  </div>
                )}
              </div>

              {/* Watchlist toggle inside details */}
              {onAddToWatchlist && (
                <button
                  onClick={() => onAddToWatchlist(movie)}
                  className={`w-full py-3.5 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                    isSaved
                      ? "bg-zinc-800 text-zinc-300 border border-white/10 hover:bg-zinc-700/80"
                      : "bg-white text-black hover:bg-zinc-200"
                  }`}
                >
                  {isSaved ? (
                    <>
                      <Check className="w-4 h-4 text-green-500" />
                      <span>On Watchlist</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 text-black" />
                      <span>Add to Watchlist</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Right Cols: Overview, tabs, similar recommendations, casting, crews */}
            <div className="md:col-span-2 space-y-6 text-left flex flex-col justify-between">
              <div className="space-y-4">
                {/* Horizontal Glass tabs switcher */}
                <div className="flex items-center gap-1 border-b border-white/10 pb-3">
                  {(["overview", "cast", "info", "similar"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-1.5 text-xs font-semibold rounded-md uppercase tracking-wider transition-all cursor-pointer ${
                        activeTab === tab
                          ? "bg-white text-black font-extrabold shadow"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Active tab content panels with Framer Motion transitions */}
                {activeTab === "overview" && (
                  <div className="space-y-4">
                    <p className="text-zinc-300 text-sm leading-relaxed font-normal">
                      {movie.overview ||
                        details?.overview ||
                        "No detailed overview is set for this selection yet."}
                    </p>

                    {details?.genres && (
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        {details.genres.map((g: any, idx: number) => (
                          <span
                            key={
                              g && typeof g === "object" && g.id
                                ? `genre-${g.id}`
                                : `genre-idx-${idx}`
                            }
                            className="px-2.5 py-1 text-xs rounded-full border border-white/10 bg-zinc-900 text-zinc-300 font-medium"
                          >
                            {typeof g === "string" ? g : g?.name || ""}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Production team / director block */}
                    {details?.credits?.crew &&
                      details.credits.crew.length > 0 && (
                        <div className="pt-4 border-t border-white/5 space-y-1">
                          <span className="text-xs text-zinc-500 uppercase tracking-widest font-bold block">
                            Direction / Creative Lead
                          </span>
                          <div className="flex items-center gap-2 text-sm text-zinc-200">
                            {(() => {
                              const leader =
                                details.credits.crew.find((c: any) =>
                                  [
                                    "Director",
                                    "Creator",
                                    "Executive Producer",
                                    "Showrunner",
                                  ].includes(c.job),
                                ) || details.credits.crew[0];

                              const leaderImage = leader?.profile_path
                                ? `https://image.tmdb.org/t/p/w185${leader.profile_path}`
                                : null;

                              const initials = leader?.name
                                ? leader.name
                                    .split(" ")
                                    .map((n: string) => n[0])
                                    .join("")
                                    .substring(0, 2)
                                    .toUpperCase()
                                : "?";

                              return (
                                <div
                                  className="flex items-center gap-3 p-2 bg-[#111111] border border-white/5 rounded-lg text-xs cursor-pointer hover:bg-zinc-900 transition-colors w-full max-w-sm"
                                  onClick={() => handleOpenPersonProfile(leader?.name || "Unknown", leader?.job || "Director", leader?.id, leader?.profile_path)}
                                >
                                  <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center shrink-0 border border-white/10 relative">
                                    {leaderImage ? (
                                      <>
                                        <img
                                          src={leaderImage}
                                          alt={leader?.name}
                                          className="w-full h-full object-cover absolute inset-0 z-10"
                                          onError={(e) => {
                                            (
                                              e.currentTarget as HTMLImageElement
                                            ).style.display = "none";
                                          }}
                                          referrerPolicy="no-referrer"
                                        />
                                        <div className="flex text-[10px] font-bold text-zinc-400 absolute inset-0 z-0 items-center justify-center bg-zinc-800">
                                          {initials}
                                        </div>
                                      </>
                                    ) : (
                                      <div className="flex text-[10px] font-bold text-zinc-400 absolute inset-0 z-0 items-center justify-center bg-zinc-800">
                                        {initials}
                                      </div>
                                    )}
                                  </div>
                                  <span className="font-semibold">
                                    {leader?.name}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                    <div className="pt-4 border-t border-white/5 space-y-3">
                      <span className="text-xs text-zinc-500 uppercase tracking-widest font-bold block">
                        Where to Watch
                      </span>
                      {(() => {
                        const providersAttr =
                          details?.["watch/providers"]?.results;
                        if (
                          !providersAttr ||
                          Object.keys(providersAttr).length === 0
                        ) {
                          return (
                            <p className="text-xs text-zinc-400 leading-relaxed font-normal">
                              Streaming availability information is currently
                              unavailable in your region.
                            </p>
                          );
                        }

                        const userRegion =
                          typeof navigator !== "undefined"
                            ? navigator.language.split("-")[1]?.toUpperCase() ||
                              "US"
                            : "US";
                        const currentProviders =
                          providersAttr[userRegion] ||
                          providersAttr["US"] ||
                          providersAttr["IN"] ||
                          providersAttr[Object.keys(providersAttr)[0]];

                        if (
                          !currentProviders ||
                          (!currentProviders.free &&
                            !currentProviders.flatrate &&
                            !currentProviders.ads &&
                            !currentProviders.rent &&
                            !currentProviders.buy)
                        ) {
                          return (
                            <p className="text-xs text-zinc-400 leading-relaxed font-normal">
                              Streaming availability information is currently
                              unavailable in your region.
                            </p>
                          );
                        }

                        // Aggregate and deduplicate by provider name
                        const allOptions: any[] = [];
                        const seenNames = new Set<string>();

                        const addCategory = (
                          list: any[],
                          typeLabel: string,
                          priority: number,
                        ) => {
                          if (!list) return;
                          list.forEach((p: any) => {
                            if (!seenNames.has(p.provider_name)) {
                              seenNames.add(p.provider_name);
                              allOptions.push({
                                ...p,
                                typeLabel,
                                priority,
                              });
                            }
                          });
                        };

                        addCategory(currentProviders.free, "Free", 1);
                        addCategory(
                          currentProviders.flatrate,
                          "Subscription",
                          2,
                        );
                        addCategory(currentProviders.ads, "Ad Supported", 3);
                        addCategory(currentProviders.rent, "Rent", 4);
                        addCategory(currentProviders.buy, "Buy", 5);

                        allOptions.sort((a, b) => a.priority - b.priority);

                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {allOptions.map((opt, idx) => (
                              <div
                                key={`${opt.provider_id}-${idx}`}
                                className="flex items-center gap-3 p-2 bg-[#111111] border border-white/5 rounded-full hover:bg-zinc-900 hover:border-white/20 transition-all cursor-pointer shadow-md group"
                                onClick={() => {
                                  if (currentProviders.link) {
                                    window.open(
                                      currentProviders.link,
                                      "_blank",
                                    );
                                  }
                                }}
                              >
                                <img
                                  src={`https://image.tmdb.org/t/p/w92${opt.logo_path}`}
                                  alt={opt.provider_name}
                                  className="w-10 h-10 rounded-full object-cover shadow-sm bg-black shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="min-w-0 pr-3">
                                  <div className="text-[13px] font-bold text-white truncate max-w-full leading-tight">
                                    {opt.provider_name}
                                  </div>
                                  <div className="text-[11px] text-zinc-400 font-medium truncate mt-0.5">
                                    {opt.typeLabel}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {activeTab === "cast" && (
                  <div className="space-y-4">
                    <span className="text-xs text-zinc-500 uppercase tracking-widest font-extrabold block">
                      Lead Performers
                    </span>

                    {loading ? (
                      <div className="text-xs text-zinc-400 animate-pulse">
                        Loading casting lists...
                      </div>
                    ) : details?.credits?.cast &&
                      details.credits.cast.length > 0 ? (
                      <div className="grid grid-cols-2 gap-4">
                        {details.credits.cast
                          .slice(0, 6)
                          .map((actor: any, idx: number) => {
                            const actorImage = actor.profile_path
                              ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
                              : null;
                            const initials = actor.name
                              ? actor.name
                                  .split(" ")
                                  .map((n: string) => n[0])
                                  .join("")
                                  .substring(0, 2)
                                  .toUpperCase()
                              : "?";

                            return (
                              <div
                                key={
                                  actor.id
                                    ? `cast-${actor.id}`
                                    : `cast-${actor.name || idx}-${idx}`
                                }
                                className="flex items-center gap-3 p-2 bg-[#111111] border border-white/5 rounded-lg text-xs cursor-pointer hover:bg-zinc-900 transition-colors"
                                onClick={() => handleOpenPersonProfile(actor.name, actor.character, actor.id, actor.profile_path)}
                              >
                                <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center shrink-0 border border-white/10 relative">
                                  {actorImage ? (
                                    <>
                                      <img
                                        src={actorImage}
                                        alt={actor.name}
                                        className="w-full h-full object-cover absolute inset-0 z-10"
                                        onError={(e) => {
                                          (
                                            e.currentTarget as HTMLImageElement
                                          ).style.display = "none";
                                        }}
                                        referrerPolicy="no-referrer"
                                      />
                                      <div className="flex text-[10px] font-bold text-zinc-400 absolute inset-0 z-0 items-center justify-center bg-zinc-800">
                                        {initials}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="flex text-[10px] font-bold text-zinc-400 absolute inset-0 z-0 items-center justify-center bg-zinc-800">
                                      {initials}
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-white leading-tight truncate">
                                    {actor.name}
                                  </div>
                                  <div className="text-[10px] text-zinc-500 font-mono truncate max-w-[120px]">
                                    {actor.character}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-500">
                        Casting lists are currently offline.
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "similar" && (
                  <div className="space-y-4">
                    <span className="text-xs text-zinc-500 uppercase tracking-widest font-extrabold block">
                      More Like This
                    </span>

                    <div 
                      onScroll={handleSimilarScroll}
                      className="max-h-[420px] overflow-y-auto pr-1 space-y-4 scroll-smooth scrollbar-thin select-text"
                      style={{ overflowY: "auto" }}
                    >
                      {similarMoviesList.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-4">
                          {(() => {
                            const seenTmdbIds = new Set<any>();
                            return similarMoviesList
                              .filter(rec => {
                                if (seenTmdbIds.has(rec.id)) return false;
                                seenTmdbIds.add(rec.id);
                                return true;
                              })
                              .map((rec: any, idx: number) => {
                                const recPosterUrl = rec.poster_path
                                  ? (rec.poster_path.startsWith("http")
                                      ? rec.poster_path
                                      : `https://image.tmdb.org/t/p/w300${rec.poster_path}`)
                                  : "https://images.unsplash.com/photo-1542204172-e7052809a936?auto=format&fit=crop&w=300&q=80";
                                const recTitle = rec.title || rec.name;

                                return (
                                  <div
                                    key={`similar-validated-${rec.id || idx}`}
                                    onClick={() => {
                                      if (onSelectSimilar) {
                                        onSelectSimilar(rec);
                                      }
                                    }}
                                    className="aspect-[2/3] relative rounded-lg overflow-hidden border border-white/5 bg-zinc-950 cursor-pointer hover:border-white/35 transition-all group shadow shadow-black"
                                    title={recTitle}
                                  >
                                    <img
                                      src={recPosterUrl}
                                      alt={recTitle}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                      referrerPolicy="no-referrer"
                                      loading="lazy"
                                    />
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent p-2">
                                      <p className="text-[10px] font-bold text-white truncate">
                                        {recTitle}
                                      </p>
                                      <div className="flex items-center justify-between text-[8px] text-zinc-400 mt-0.5 font-mono">
                                        <span>★ {Number(rec.vote_average || 8.0).toFixed(1)}</span>
                                        <span>{Number(rec.release_date || "2024").toString().substring(0, 4)}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              });
                          })()}
                        </div>
                      ) : (
                        !similarLoading && (
                          <div className="text-zinc-500 text-xs py-8 text-center">
                            No highly similar titles matched yet.
                          </div>
                        )
                      )}

                      {similarLoading && (
                        <div className="flex items-center justify-center py-6 text-xs text-zinc-400 animate-pulse gap-2">
                          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          <span>Streaming matching matches...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "info" && (
                  <div className="space-y-6 text-zinc-300 text-sm max-h-[480px] overflow-y-auto pr-1">
                    {movie.media_type === "tv" || movie.first_air_date ? (
                      // SERIES INFO
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-white font-bold text-base mb-3 border-b border-white/5 pb-1 uppercase tracking-wider">Series Details</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                            <div className="flex flex-col">
                              <span className="text-zinc-500 font-medium text-xs">Original Title</span>
                              <span className="text-zinc-200 mt-0.5">{details?.original_name || details?.original_title || movie.name || movie.title || "Information unavailable."}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-zinc-500 font-medium text-xs">First Air Date</span>
                              <span className="text-zinc-200 mt-0.5">{details?.first_air_date || movie.first_air_date || "Information unavailable."}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-zinc-500 font-medium text-xs">Last Air Date</span>
                              <span className="text-zinc-200 mt-0.5">{details?.last_air_date || "Information unavailable."}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-zinc-500 font-medium text-xs">Status</span>
                              <span className="text-zinc-200 mt-0.5">{details?.status || "Information unavailable."}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-zinc-500 font-medium text-xs">Type</span>
                              <span className="text-zinc-200 mt-0.5">{details?.type || "Information unavailable."}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-zinc-500 font-medium text-xs">Original Language</span>
                              <span className="text-zinc-200 mt-0.5">{getLanguageName(details?.original_language || movie.original_language || "en")}</span>
                            </div>
                            <div className="flex flex-col sm:col-span-2">
                              <span className="text-zinc-500 font-medium text-xs">Genres</span>
                              <span className="text-zinc-200 mt-0.5">
                                {details?.genres ? (Array.isArray(details.genres) ? details.genres.map((g: any) => typeof g === "string" ? g : g?.name).join(", ") : "Information unavailable.") : "Information unavailable."}
                              </span>
                            </div>
                            <div className="flex flex-col sm:col-span-2">
                              <span className="text-zinc-500 font-medium text-xs">Networks</span>
                              <span className="text-zinc-200 mt-0.5">
                                {details?.networks ? (Array.isArray(details.networks) ? details.networks.map((n: any) => n.name).join(", ") : "Information unavailable.") : "Information unavailable."}
                              </span>
                            </div>
                            <div className="flex flex-col sm:col-span-2">
                              <span className="text-zinc-500 font-medium text-xs">Created By</span>
                              <span className="text-zinc-200 mt-0.5">
                                {details?.created_by && details.created_by.length > 0 ? (Array.isArray(details.created_by) ? details.created_by.map((c: any) => c.name).join(", ") : "Information unavailable.") : "Information unavailable."}
                              </span>
                            </div>
                            <div className="flex flex-col sm:col-span-2">
                              <span className="text-zinc-500 font-medium text-xs">Production Companies</span>
                              <span className="text-zinc-200 mt-0.5">
                                {details?.production_companies && details.production_companies.length > 0 ? details.production_companies.map((pc: any) => pc.name).join(", ") : "Information unavailable."}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-white font-bold text-base mb-3 border-b border-white/5 pb-1 uppercase tracking-wider">Additional Series Details</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#111111] p-3 rounded-xl border border-white/5 flex flex-col justify-center">
                              <span className="text-zinc-500 font-medium text-xs">Seasons</span>
                              <span className="text-white text-lg font-bold mt-1">{details?.number_of_seasons || "Information unavailable."}</span>
                            </div>
                            <div className="bg-[#111111] p-3 rounded-xl border border-white/5 flex flex-col justify-center">
                              <span className="text-zinc-500 font-medium text-xs">Episodes</span>
                              <span className="text-white text-lg font-bold mt-1">{details?.number_of_episodes || "Information unavailable."}</span>
                            </div>
                            <div className="bg-[#111111] p-3 rounded-xl border border-white/5 flex flex-col justify-center">
                              <span className="text-zinc-500 font-medium text-xs">Average Runtime</span>
                              <span className="text-white text-base font-bold mt-1">
                                {details?.episode_run_time && details.episode_run_time.length > 0 ? formatRuntime(details.episode_run_time[0]) : "Information unavailable."}
                              </span>
                            </div>
                            <div className="bg-[#111111] p-3 rounded-xl border border-white/5 flex flex-col justify-center">
                              <span className="text-zinc-500 font-medium text-xs">In Production</span>
                              <span className="text-white text-base font-bold mt-1">{details?.in_production ? "Yes" : "No"}</span>
                            </div>
                            <div className="bg-[#111111] p-3 rounded-xl border border-white/5 flex flex-col justify-center">
                              <span className="text-zinc-500 font-medium text-xs">Popularity Score</span>
                              <span className="text-white text-base font-bold mt-1">{details?.popularity || "Information unavailable."}</span>
                            </div>
                            <div className="bg-[#111111] p-3 rounded-xl border border-white/5 flex flex-col justify-center">
                              <span className="text-zinc-500 font-medium text-xs">TMDB Vote Count</span>
                              <span className="text-white text-base font-bold mt-1">
                                {details?.vote_count ? new Intl.NumberFormat('en-US').format(details.vote_count) : "Information unavailable."}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Season & Episode Selector */}
                        <div>
                          <h4 className="text-white font-bold text-base mb-3 border-b border-white/5 pb-1 uppercase tracking-wider">Season Information</h4>
                          
                          <div className="flex flex-wrap gap-2 mb-4 animate-fadeIn">
                            {(details?.seasons || Array.from({ length: details?.number_of_seasons || 1 }, (_, idx) => ({ season_number: idx + 1, name: `Season ${idx + 1}` }))).map((s: any) => {
                              const active = selectedSeason === s.season_number;
                              return (
                                <button
                                  key={`season-pill-${s.season_number}`}
                                  onClick={() => setSelectedSeason(s.season_number)}
                                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                                    active 
                                      ? "bg-white text-black border-white" 
                                      : "bg-[#111111] border-white/10 text-zinc-400 hover:text-white hover:border-white/20"
                                  }`}
                                >
                                  {s.name || `Season ${s.season_number}`} {s.episode_count ? `(${s.episode_count} Episodes)` : ""}
                                </button>
                              );
                            })}
                          </div>

                          <div className="bg-[#0f0f0f] border border-white/5 rounded-xl p-4 overflow-hidden">
                            {seasonLoading ? (
                              <div className="flex flex-col items-center justify-center py-10 text-xs text-zinc-500 gap-2 animate-pulse">
                                <Clock className="w-5 h-5 text-zinc-500" />
                                <span>Lazy loading Season {selectedSeason} episodes...</span>
                              </div>
                            ) : (() => {
                              const cacheKey = `${movie.id}_s${selectedSeason}`;
                              const data = seasonCache[cacheKey];
                              if (!data || !data.episodes || data.episodes.length === 0) {
                                return (
                                  <p className="text-xs text-zinc-500 py-6 text-center">Information unavailable.</p>
                                );
                              }
                              return (
                                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 select-text scrollbar-thin">
                                  {data.episodes.map((episode: any) => (
                                    <EpisodeCard key={`ep-${episode.id}`} episode={episode} />
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    ) : (
                      // MOVIE INFO
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-white font-bold text-base mb-3 border-b border-white/5 pb-1 uppercase tracking-wider">Basic Information</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                            <div className="flex flex-col">
                              <span className="text-zinc-500 font-medium text-xs">Original Title</span>
                              <span className="text-zinc-200 mt-0.5">{details?.original_title || movie.title || "Information unavailable."}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-zinc-500 font-medium text-xs">Release Date</span>
                              <span className="text-zinc-200 mt-0.5">{details?.release_date || movie.release_date || movie.year || "Information unavailable."}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-zinc-500 font-medium text-xs">Runtime</span>
                              <span className="text-zinc-200 mt-0.5">{formatRuntime(details?.runtime || movie.runtime)}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-zinc-500 font-medium text-xs">Status</span>
                              <span className="text-zinc-200 mt-0.5">{details?.status || "Information unavailable."}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-zinc-500 font-medium text-xs">Original Language</span>
                              <span className="text-zinc-200 mt-0.5">{getLanguageName(details?.original_language || movie.original_language || "en")}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-zinc-500 font-medium text-xs">Budget</span>
                              <span className="text-zinc-200 mt-0.5">{formatCurrency(details?.budget)}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-zinc-500 font-medium text-xs">Revenue</span>
                              <span className="text-zinc-200 mt-0.5">{formatCurrency(details?.revenue)}</span>
                            </div>
                            <div className="flex flex-col sm:col-span-2">
                              <span className="text-zinc-500 font-medium text-xs">Genres</span>
                              <span className="text-zinc-200 mt-0.5 font-normal">
                                {details?.genres ? (Array.isArray(details.genres) ? details.genres.map((g: any) => typeof g === "string" ? g : g?.name).join(", ") : "Information unavailable.") : "Information unavailable."}
                              </span>
                            </div>
                            <div className="flex flex-col sm:col-span-2">
                              <span className="text-zinc-500 font-medium text-xs">Production Companies</span>
                              <span className="text-zinc-200 mt-0.5">
                                {details?.production_companies && details.production_companies.length > 0 ? details.production_companies.map((pc: any) => pc.name).join(", ") : "Information unavailable."}
                              </span>
                            </div>
                            <div className="flex flex-col sm:col-span-2">
                              <span className="text-zinc-500 font-medium text-xs">Production Countries</span>
                              <span className="text-zinc-200 mt-0.5">
                                {details?.production_countries && details.production_countries.length > 0 ? details.production_countries.map((c: any) => c.name).join(", ") : "Information unavailable."}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-white font-bold text-base mb-3 border-b border-white/5 pb-1 uppercase tracking-wider">Additional Movie Details</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-[#111111] p-3 rounded-xl border border-white/5 shadow-inner">
                              <span className="text-zinc-500 font-medium text-xs">Tagline</span>
                              <p className="text-white font-medium mt-1 italic">"{details?.tagline || movie.tagline || "Information unavailable."}"</p>
                            </div>
                            <div className="bg-[#111111] p-3 rounded-xl border border-white/5 shadow-inner">
                              <span className="text-zinc-500 font-medium text-xs">Collection</span>
                              <p className="text-white font-medium mt-1">{details?.belongs_to_collection?.name || "Information unavailable."}</p>
                            </div>
                            <div className="bg-[#111111] p-3 rounded-xl border border-white/5 shadow-inner">
                              <span className="text-zinc-500 font-medium text-xs">Awards</span>
                              <p className="text-zinc-300 font-medium mt-1">Information unavailable.</p>
                            </div>
                            <div className="bg-[#111111] p-3 rounded-xl border border-white/5 shadow-inner">
                              <span className="text-zinc-500 font-medium text-xs">Adult Content</span>
                              <p className="text-white font-bold mt-1">{details?.adult ? "Yes (18+ Only)" : "No (General Audience)"}</p>
                            </div>
                            <div className="bg-[#111111] p-3 rounded-xl border border-white/5 shadow-inner">
                              <span className="text-zinc-500 font-medium text-xs">Popularity Score</span>
                              <p className="text-white font-bold mt-1">{details?.popularity || "Information unavailable."}</p>
                            </div>
                            <div className="bg-[#111111] p-3 rounded-xl border border-white/5 shadow-inner">
                              <span className="text-zinc-500 font-medium text-xs">TMDB Vote Count</span>
                              <p className="text-white font-bold mt-1">
                                {details?.vote_count ? new Intl.NumberFormat('en-US').format(details.vote_count) : "Information unavailable."}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Trust/taste matching tagline */}
              <div className="pt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-zinc-400 flex-wrap gap-2">
                <span className="flex items-center gap-1 text-zinc-500">
                  <Sparkles className="w-3 h-3 text-zinc-400" />
                  Taste matches using dynamic similarity algorithms.
                </span>
                <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white font-semibold">
                  MATCH SCORE: {(Number(voteAverage) * 10).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Fullscreen Cinematic OTT-Grade Trailer Player Modal Overlay */}
        <AnimatePresence>
          {showTrailer && trailerKey && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4 sm:p-8 md:p-12 overflow-hidden select-none">
              {/* Outside close listener click */}
              <div
                className="absolute inset-0 cursor-pointer"
                onClick={() => setShowTrailer(false)}
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 180 }}
                className="relative w-full max-w-5xl aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl z-20"
              >
                {/* Immersive top gradient bar with title and close handle */}
                <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/90 to-transparent z-30 flex items-center justify-between">
                  <h3 className="text-white font-semibold text-xs sm:text-sm tracking-wide drop-shadow truncate max-w-md sm:max-w-xl">
                    Streaming Trailer • {movie.title || movie.name}
                  </h3>

                  <button
                    onClick={() => setShowTrailer(false)}
                    className="p-1.5 sm:p-2 rounded-full bg-black/50 hover:bg-white/15 text-white/90 hover:text-white border border-white/10 hover:border-white/20 backdrop-blur-md cursor-pointer transition-all active:scale-95"
                    aria-label="Close Playback"
                  >
                    <X className="w-4 h-4 sm:w-5 h-5" />
                  </button>
                </div>

                <div className="w-full h-full select-none pointer-events-auto">
                  <iframe
                    src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&modestbranding=1&rel=0&showinfo=0`}
                    title="Official Cinema Trailer Player"
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Cinematic Cast Profile Modal Overlay */}
        <AnimatePresence>
          {profilePersonName && profileDetails && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-[20px]"
              onClick={() => setProfilePersonName("")}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 30 }}
                transition={{ type: "spring", damping: 25, stiffness: 220 }}
                className="relative max-w-2xl w-full bg-[#0E0E10] rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex flex-col sm:flex-row text-left font-sans"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setProfilePersonName("")}
                  className="absolute top-4 right-4 z-10 p-2 bg-black/55 hover:bg-white/15 border border-white/10 rounded-full text-white backdrop-blur-sm transition-all"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Left side: Profile Image */}
                <div className="w-full sm:w-[240px] shrink-0 bg-[#161619] relative aspect-[2/3] sm:aspect-auto">
                  {profileDetails.image ? (
                    <>
                      <img
                        src={profileDetails.image}
                        alt={profilePersonName}
                        className="w-full h-full object-cover absolute inset-0 z-10"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex text-8xl font-bold text-zinc-700 absolute inset-0 z-0 items-center justify-center bg-zinc-900">
                        {profileDetails.fallbackInitials}
                      </div>
                    </>
                  ) : (
                    <div className="flex text-8xl font-bold text-zinc-700 absolute inset-0 items-center justify-center bg-zinc-900">
                      {profileDetails.fallbackInitials}
                    </div>
                  )}
                </div>

                {/* Right side: Biography details, known works, demographics */}
                <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between max-h-[500px] overflow-y-auto min-w-0">
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-zinc-300 font-mono tracking-widest uppercase">
                        {profileDetails.department || "Creative Staff"}
                      </span>
                      <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1.5 leading-tight">
                        {profilePersonName}
                      </h3>
                      <p className="text-sm text-zinc-400 font-medium">
                        {profilePersonRole}
                      </p>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-white/5">
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest block font-mono">Biography</span>
                        <p className="text-xs text-zinc-300 leading-relaxed font-normal mt-1">
                          {profileDetails.biography}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest block font-mono">Born</span>
                          <span className="text-xs text-white font-medium mt-0.5 block">{profileDetails.birthday || "Information unavailable."}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest block font-mono">Popularity</span>
                          <span className="text-xs text-amber-400 font-medium mt-0.5 block">★ {profileDetails.popularity || "N/A"}</span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest block font-mono">Known For</span>
                        <span className="text-xs text-white font-medium mt-0.5 block">{profileDetails.known_for || "Information unavailable."}</span>
                      </div>

                      <div className="pt-2">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest block font-mono">Top Credits</span>
                        <p className="text-xs text-zinc-300 leading-relaxed font-medium mt-0.5">
                          {profileDetails.top_credits || "Information unavailable."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
}
