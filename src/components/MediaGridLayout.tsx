import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import MovieCard from './MovieCard';

interface MediaGridLayoutProps {
  items: any[];
  onOpenDetails: (item: any) => void;
  onAddToWatchlist?: (item: any) => void;
  watchlistIds: string[];
  getItemId: (item: any) => string;
  getMovieCardItem: (item: any) => any;
}

export default function MediaGridLayout({
  items,
  onOpenDetails,
  onAddToWatchlist,
  watchlistIds,
  getItemId,
  getMovieCardItem
}: MediaGridLayoutProps) {
  return (
    <AnimatePresence mode="popLayout">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-10 w-full">
        {items.map((item) => (
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            key={getItemId(item)}
            className="w-full aspect-[2/3] relative"
          >
            <MovieCard
              item={getMovieCardItem(item)}
              onOpenDetails={onOpenDetails}
              onAddToWatchlist={onAddToWatchlist}
              watchlistIds={watchlistIds}
            />
          </motion.div>
        ))}
      </div>
    </AnimatePresence>
  );
}
