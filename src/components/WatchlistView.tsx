import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  RefreshCw,
  List,
} from "lucide-react";
import MovieCard from "./MovieCard";
import MediaGridLayout from "./MediaGridLayout";
import { useWatchlistStore } from "../stores/watchlistStore";
import { auth } from "../lib/firebase";

interface WatchlistViewProps {
  onBackToHome: () => void;
  onOpenMovieDetails: (movie: any) => void;
  watchlistIds: string[];
}

type SortOption =
  | "newest"
  | "oldest"
  | "highest_rated"
  | "lowest_rated"
  | "az"
  | "za"
  | "recently_released";
type TabOption = "all" | "movies" | "series";

export default function WatchlistView({
  onBackToHome,
  onOpenMovieDetails,
  watchlistIds,
}: WatchlistViewProps) {
  const { watchlist, fetchWatchlist, loading } = useWatchlistStore();
  const userId = auth.currentUser?.uid;

  React.useEffect(() => {
    if (userId) {
      fetchWatchlist(userId);
    }
  }, [userId, fetchWatchlist]);

  const [activeTab, setActiveTab] = useState<TabOption>("all");
  const [sortOption, setSortOption] = useState<SortOption>("newest");

  const filteredWatchlist = useMemo(() => {
    let filtered = [...watchlist];

    // Filter by type
    if (activeTab === "movies") {
      filtered = filtered.filter((item) => item.type === "movie");
    } else if (activeTab === "series") {
      filtered = filtered.filter(
        (item) => item.type === "tv" || item.type === "series" || item.type === "anime"
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortOption) {
        case "newest":
          return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
        case "oldest":
          return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
        case "highest_rated":
          return (b.rating || 0) - (a.rating || 0);
        case "lowest_rated":
          return (a.rating || 0) - (b.rating || 0);
        case "az":
          return (a.title || "").localeCompare(b.title || "");
        case "za":
          return (b.title || "").localeCompare(a.title || "");
        case "recently_released":
          return parseInt(b.year || "0") - parseInt(a.year || "0");
        default:
          return 0;
      }
    });

    return filtered;
  }, [watchlist, activeTab, sortOption]);

  const stats = useMemo(() => {
    return {
      all: watchlist.length,
      movies: watchlist.filter((item) => item.type === "movie").length,
      series: watchlist.filter(
        (item) => item.type === "tv" || item.type === "series" || item.type === "anime",
      ).length,
    };
  }, [watchlist]);

  return (
    <motion.div
      key="watchlist-view"
      className="max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 text-left space-y-8 bg-transparent text-[#FFFFFF] font-sans relative antialiased"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
    >
      <div className="border-b border-white/5 pb-4">
        <h3 className="font-sans font-extrabold text-3xl sm:text-4xl text-white tracking-tight">
          Wishlist
        </h3>
        <p className="font-sans text-xs text-zinc-400 font-light mt-1">
          <span className="text-white font-bold">{stats.all}</span> Titles &bull; <span className="text-white font-bold">{stats.movies}</span> Movies &bull; <span className="text-white font-bold">{stats.series}</span> Series
        </p>
      </div>

      <div className="space-y-8 flex-1">
        {/* Filters and Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "all"
                  ? "bg-white text-black"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              All Saves
            </button>
            <button
              onClick={() => setActiveTab("movies")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "movies"
                  ? "bg-white text-black"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Movies
            </button>
            <button
              onClick={() => setActiveTab("series")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "series"
                  ? "bg-white text-black"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Series
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => userId && fetchWatchlist(userId)}
              disabled={loading}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all border border-white/5"
              title="Refresh Watchlist"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin text-white" : ""}`}
              />
            </button>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="bg-zinc-900 border border-white/10 text-white text-xs px-4 py-2.5 rounded-xl appearance-none pr-8 cursor-pointer hover:border-white/20 transition-colors font-semibold"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23999%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest_rated">Highest Rated</option>
              <option value="lowest_rated">Lowest Rated</option>
              <option value="recently_released">Recently Released</option>
              <option value="az">A-Z</option>
              <option value="za">Z-A</option>
            </select>
          </div>
        </div>

        {/* Content */}
        {watchlist.length === 0 && !loading ? (
          <div className="py-24 text-center space-y-5 bg-[#0B0B0B]/80 border border-white/5 rounded-3xl max-w-2xl mx-auto flex flex-col items-center">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border border-white/10 shadow-lg">
              <List className="w-8 h-8 text-white/40" />
            </div>
            <div className="space-y-1">
              <h3 className="font-sans font-bold text-white text-xl">
                Your Watchlist is empty
              </h3>
              <p className="font-sans text-sm text-zinc-400 max-w-xs mx-auto leading-relaxed">
                Start saving movies and series you want to watch. Add content
                from the home feed or search.
              </p>
            </div>
            <button
              onClick={onBackToHome}
              className="px-6 py-2.5 mt-4 bg-white hover:bg-zinc-200 text-black text-sm font-extrabold tracking-wide uppercase rounded-full transition-all cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-[1.03] active:scale-[0.98]"
            >
              Discover Content
            </button>
          </div>
        ) : filteredWatchlist.length === 0 && !loading ? (
          <div className="py-24 text-center space-y-3 max-w-lg mx-auto">
            <p className="text-zinc-500 font-medium font-sans">
              No items found matching the current filter.
            </p>
          </div>
        ) : (
          <MediaGridLayout
            items={filteredWatchlist}
            onOpenDetails={onOpenMovieDetails}
            watchlistIds={watchlistIds}
            getItemId={(item) => `watchlist-item-${item.id}`}
            getMovieCardItem={(item) => ({
              ...item,
              id: item.titleId,
              poster_path: item.posterUrl,
              release_date: item.year,
              media_type: item.type,
              vote_average: item.rating ? item.rating / 10 : 8.0,
            })}
          />
        )}
      </div>
    </motion.div>
  );
}
