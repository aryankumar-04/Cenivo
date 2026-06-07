import { create } from "zustand";
import { db } from "../lib/firebase";
import {
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";

export interface RatingItem {
  id: string; // Used internally, string titleId
  userId: string;
  username: string;
  titleId: string;
  title: string;
  type: string; // Let's add type to ratings so we can filter by Movies/Series
  posterUrl: string; // Add posterUrl
  year: string; // Add year
  tmdbRating: number; // Add tmdbRating
  rating: number; // 0.5 to 10
  reviewText: string;
  createdAt: string;
}

interface RatingsStore {
  ratings: RatingItem[];
  loading: boolean;
  initialized: boolean;
  fetchRatings: (userId: string) => Promise<void>;
  upsertRating: (
    item: any,
    userId: string,
    username: string,
    rating: number,
    reviewText?: string
  ) => Promise<void>;
  removeRating: (titleId: string, userId: string) => Promise<void>;
  getRating: (titleId: string) => number | null;
  clear: () => void;
}

export const useRatingsStore = create<RatingsStore>((set, get) => ({
  ratings: [],
  loading: false,
  initialized: false,

  fetchRatings: async (userId: string) => {
    if (!userId) return;
    set({ loading: true });
    try {
      const snap = await getDocs(collection(db, `users/${userId}/ratings`));
      const items = snap.docs.map((doc) => doc.data() as RatingItem);
      set({ ratings: items, loading: false, initialized: true });
    } catch (e) {
      console.error("Error fetching ratings:", e);
      set({ loading: false, initialized: true });
    }
  },

  upsertRating: async (
    movie: any,
    userId: string,
    username: string,
    rating: number,
    reviewText: string = ""
  ) => {
    if (!userId) return;

    const titleIdStr = String(movie.id || movie.tmdbId || movie.titleId);
    let mediaType = "movie";
    if (movie.media_type === "tv" || movie.type === "tv" || movie.type === "series") mediaType = "series";
    else if (movie.type === "anime") mediaType = "anime";

    const newItem: RatingItem = {
      id: titleIdStr,
      userId,
      username,
      titleId: titleIdStr,
      title: movie.title || movie.name || "Unknown",
      type: mediaType,
      posterUrl: movie.poster_path || movie.posterUrl || "",
      year: String(movie.release_date || movie.first_air_date || movie.year || new Date().getFullYear().toString()).substring(0, 4),
      tmdbRating: movie.vote_average ? movie.vote_average * 10 : movie.rating || 0,
      rating,
      reviewText,
      createdAt: new Date().toISOString(),
    };

    set((current) => {
      const filtered = current.ratings.filter((i) => i.titleId !== titleIdStr);
      return { ratings: [...filtered, newItem] };
    });

    try {
      await setDoc(doc(db, `users/${userId}/ratings/${titleIdStr}`), newItem);
    } catch (e) {
      console.error("Error saving rating:", e);
    }
  },

  removeRating: async (titleId: string, userId: string) => {
    if (!userId) return;
    const strId = String(titleId);

    set((current) => ({
      ratings: current.ratings.filter((i) => i.titleId !== strId),
    }));

    try {
      await deleteDoc(doc(db, `users/${userId}/ratings/${strId}`));
    } catch (e) {
      console.error("Error removing rating:", e);
    }
  },

  getRating: (titleId: string) => {
    const strId = String(titleId);
    const item = get().ratings.find((i) => i.titleId === strId);
    return item ? item.rating : null;
  },

  clear: () => set({ ratings: [], initialized: false }),
}));
