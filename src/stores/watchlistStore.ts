import { create } from "zustand";
import { db, auth } from "../lib/firebase";
import {
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  query,
  where,
  Timestamp
} from "firebase/firestore";

export interface WatchlistItem {
  id: string; // Used internally, string titleId
  userId: string;
  titleId: string;
  title: string;
  type: string;
  posterUrl: string;
  year: string;
  rating: number;
  state: "watchlist" | "watching" | "completed" | "favorites";
  addedAt: string;
}

interface WatchlistStore {
  watchlist: WatchlistItem[];
  loading: boolean;
  initialized: boolean;
  fetchWatchlist: (userId: string) => Promise<void>;
  addToWatchlist: (
    item: any,
    userId: string,
    state?: WatchlistItem["state"],
  ) => Promise<void>;
  removeFromWatchlist: (titleId: string, userId: string) => Promise<void>;
  isInWatchlist: (titleId: string) => boolean;
  clear: () => void;
}

export const useWatchlistStore = create<WatchlistStore>((set, get) => ({
  watchlist: [],
  loading: false,
  initialized: false,

  fetchWatchlist: async (userId: string) => {
    if (!userId) return;
    set({ loading: true });
    try {
      const snap = await getDocs(collection(db, `users/${userId}/watchlist`));
      const items = snap.docs.map((doc) => doc.data() as WatchlistItem);
      set({ watchlist: items, loading: false, initialized: true });
    } catch (e) {
      console.error("Error fetching watchlist:", e);
      set({ loading: false, initialized: true });
    }
  },

  addToWatchlist: async (
    movie: any,
    userId: string,
    state: WatchlistItem["state"] = "watchlist",
  ) => {
    if (!userId) return;

    const titleIdStr = String(movie.id || movie.tmdbId || movie.titleId);

    const mediaType = (movie.media_type === "tv" || movie.type === "tv" || movie.type === "series") ? "series" : (movie.type === "anime" ? "anime" : "movie");

    const newItem: WatchlistItem = {
      id: titleIdStr,
      userId: userId,
      titleId: titleIdStr,
      title: movie.title || movie.name || "Unknown",
      type: mediaType,
      posterUrl: movie.poster_path || movie.posterUrl || "",
      year: String(movie.release_date || movie.first_air_date || movie.year || new Date().getFullYear().toString()).substring(0, 4),
      rating: movie.vote_average ? movie.vote_average * 10 : movie.rating || 0,
      state,
      addedAt: new Date().toISOString(),
    };

    set((current) => ({
      watchlist: [
        ...current.watchlist.filter((i) => i.titleId !== titleIdStr),
        newItem,
      ],
    }));

    try {
      await setDoc(doc(db, `users/${userId}/watchlist/${titleIdStr}`), newItem);
    } catch (e) {
      console.error("Error saving to watchlist:", e);
    }
  },

  removeFromWatchlist: async (titleId: string, userId: string) => {
    if (!userId) return;
    const strId = String(titleId);

    set((current) => ({
      watchlist: current.watchlist.filter((i) => i.titleId !== strId),
    }));

    try {
      await deleteDoc(doc(db, `users/${userId}/watchlist/${strId}`));
    } catch (e) {
      console.error("Error removing from watchlist:", e);
    }
  },

  isInWatchlist: (titleId: string) => {
    const strId = String(titleId);
    return get().watchlist.some((i) => i.titleId === strId);
  },

  clear: () => set({ watchlist: [], initialized: false }),
}));
