export interface MovieTitle {
  id: string;
  title: string;
  year: string;
  description: string;
  rating: number; // 1-100 scope matching Criticker
  type: 'movie' | 'series' | 'anime';
  genres: string[];
  posterUrl: string;
}

export interface WatchlistItem {
  id: string;
  userId: string;
  titleId: string;
  title: string;
  type: 'movie' | 'series' | 'anime';
  posterUrl: string;
  year: string;
  rating: number;
  state: 'watchlist' | 'watching' | 'completed' | 'favorites';
  addedAt: string;
}

export interface RatingReview {
  id: string;
  userId: string;
  username: string;
  titleId: string;
  title: string;
  rating: number;
  reviewText: string;
  createdAt: string;
}

export interface SearchHistoryItem {
  id: string;
  userId: string;
  prompt: string;
  createdAt: string;
  results?: MovieTitle[];
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  favoriteGenres: string;
  createdAt: string;
  username?: string;
  usernameLower?: string;
  bio?: string;
  joinedAt?: string;
  subscription?: any;
  playback?: {
    autoPlayTrailers: boolean;
    trailerAudio: boolean;
    hoverPreviewVideos: boolean;
    autoPlayNextTrailer: boolean;
    dataSaverMode: boolean;
  };
  notifications?: {
    watchlistReleases: boolean;
    newSeasons: boolean;
    newEpisodes: boolean;
    recommendationUpdates: boolean;
    trendingContent: boolean;
    newsletter: boolean;
    platformUpdates: boolean;
    deliveryMethod: 'in_app' | 'email' | 'both';
  };
  privacy?: {
    publicProfile: boolean;
    showWatchlist: boolean;
    showRatings: boolean;
  };
}
