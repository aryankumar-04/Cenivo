import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star } from 'lucide-react';
import MovieCard from './MovieCard';
import MediaGridLayout from './MediaGridLayout';
import { useRatingsStore } from '../stores/ratingsStore';

interface RatingsViewProps {
  onOpenDetails: (item: any) => void;
  onAddToWatchlist: (item: any) => void;
  watchlistIds: string[];
}

type SortOption = 
  | "highest" | "lowest" | "recently_rated" | "oldest_rated" 
  | "newest_release" | "oldest_release" | "az" | "za";

export default function RatingsView({
  onOpenDetails,
  onAddToWatchlist,
  watchlistIds
}: RatingsViewProps) {
  const { ratings, removeRating } = useRatingsStore();
  const [filter, setFilter] = useState<'all' | 'movie' | 'series'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recently_rated');

  const filteredAndSorted = useMemo(() => {
    let result = [...ratings];
    
    // Filter
    if (filter !== 'all') {
      result = result.filter(r => {
        if (filter === 'series') return r.type === 'tv' || r.type === 'series';
        return r.type === filter;
      });
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'highest':
          return b.rating - a.rating;
        case 'lowest':
          return a.rating - b.rating;
        case 'recently_rated':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest_rated':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'newest_release':
          return parseInt(b.year) - parseInt(a.year);
        case 'oldest_release':
          return parseInt(a.year) - parseInt(b.year);
        case 'az':
          return a.title.localeCompare(b.title);
        case 'za':
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });

    return result;
  }, [ratings, filter, sortBy]);

  const stats = useMemo(() => {
    return {
      all: ratings.length,
      movies: ratings.filter((item) => item.type === "movie").length,
      series: ratings.filter(
        (item) => item.type === "tv" || item.type === "series" || item.type === "anime",
      ).length,
    };
  }, [ratings]);

  return (
    <motion.div
      key="ratings-view"
      className="max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 text-left space-y-8 bg-transparent text-[#FFFFFF] font-sans relative antialiased"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
    >
      <div className="border-b border-white/5 pb-4">
        <h3 className="font-sans font-extrabold text-3xl sm:text-4xl text-white tracking-tight">
          My Ratings
        </h3>
        <p className="font-sans text-xs text-zinc-400 font-light mt-1">
          <span className="text-white font-bold">{stats.all}</span> Titles &bull; <span className="text-white font-bold">{stats.movies}</span> Movies &bull; <span className="text-white font-bold">{stats.series}</span> Series
        </p>
      </div>

      <div className="space-y-8 flex-1">
        {ratings.length === 0 ? (
          <div className="py-20 text-center space-y-4 bg-black/40 border border-white/5 rounded-3xl max-w-lg mx-auto">
            <Star className="w-10 h-10 text-zinc-600 mx-auto" strokeWidth={1.5} />
            <span className="block font-sans font-extrabold text-white text-xl">
              You haven't rated any titles yet.
            </span>
            <p className="font-sans text-sm text-zinc-400 max-w-xs mx-auto">
              Rate movies and series to improve your recommendations.
            </p>
            <button 
              onClick={() => {
                const el = document.getElementById('explore-nav');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="mt-6 px-6 py-2.5 bg-white text-black font-semibold rounded-full hover:bg-zinc-200 transition"
            >
              Discover Content
            </button>
          </div>
        ) : (
          <>
            {/* Filters and Sorting bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Type Filters */}
        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
          {(['all', 'movie', 'series'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${filter === f ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
            >
              {f === 'all' ? 'All Rated' : f === 'movie' ? 'Movies' : 'Series'}
            </button>
          ))}
        </div>

        {/* Sort Select */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="bg-zinc-900 border border-white/10 text-white text-xs px-4 py-2.5 rounded-xl appearance-none pr-8 cursor-pointer hover:border-white/20 transition-colors font-semibold"
          style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23999%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
        >
          <option value="recently_rated">Recently Rated</option>
          <option value="oldest_rated">Oldest Rated</option>
          <option value="highest">Highest Rated</option>
          <option value="lowest">Lowest Rated</option>
          <option value="newest_release">Newest Releases</option>
          <option value="oldest_release">Oldest Releases</option>
          <option value="az">A-Z</option>
          <option value="za">Z-A</option>
        </select>
      </div>

      {/* Grid of Ratings */}
      <MediaGridLayout
        items={filteredAndSorted}
        onOpenDetails={onOpenDetails}
        onAddToWatchlist={onAddToWatchlist}
        watchlistIds={watchlistIds}
        getItemId={(item) => item.titleId}
        getMovieCardItem={(item) => ({
          id: item.titleId,
          title: item.title,
          name: item.title,
          poster_path: item.posterUrl,
          posterUrl: item.posterUrl,
          vote_average: item.tmdbRating ? item.tmdbRating / 10 : 8.0,
          type: item.type,
          media_type: item.type,
          release_date: item.year,
          first_air_date: item.year,
        })}
      />

      {filteredAndSorted.length === 0 && (
        <div className="py-20 text-center space-y-2">
          <p className="font-sans font-bold text-zinc-400">No titles match the selected filter.</p>
        </div>
      )}
          </>
        )}
      </div>
    </motion.div>
  );
}
