export interface PersonalizationScores {
  genres: Record<string, number>;
  actors: Record<string, number>;
  directors: Record<string, number>;
  moods: Record<string, number>;
  providers: Record<string, number>;
  animePreference: number;
  contentTypes: {
    movie: number;
    tv: number;
    anime: number;
  };
  pacing: {
    slowBurn: number;
    fastPaced: number;
  };
  tone: {
    dark: number;
    light: number;
  };
  timeOfDay: Record<string, number>; // morning, afternoon, evening, lateNight
}

const DEFAULT_SCORES: PersonalizationScores = {
  genres: {},
  actors: {},
  directors: {},
  moods: {},
  providers: {},
  animePreference: 0,
  contentTypes: { movie: 0, tv: 0, anime: 0 },
  pacing: { slowBurn: 0, fastPaced: 0 },
  tone: { dark: 0, light: 0 },
  timeOfDay: { morning: 0, afternoon: 0, evening: 0, lateNight: 0 }
};

export function getUpdatedScores(
  current: PersonalizationScores,
  action: string,
  metadata: any
): PersonalizationScores {
  const scores = JSON.parse(JSON.stringify(current || DEFAULT_SCORES)) as PersonalizationScores;

  // Initialize nodes if they do not exist
  if (!scores.genres) scores.genres = {};
  if (!scores.actors) scores.actors = {};
  if (!scores.directors) scores.directors = {};
  if (!scores.moods) scores.moods = {};
  if (!scores.providers) scores.providers = {};
  if (!scores.contentTypes) scores.contentTypes = { movie: 0, tv: 0, anime: 0 };
  if (!scores.pacing) scores.pacing = { slowBurn: 0, fastPaced: 0 };
  if (!scores.tone) scores.tone = { dark: 0, light: 0 };
  if (!scores.timeOfDay) scores.timeOfDay = { morning: 0, afternoon: 0, evening: 0, lateNight: 0 };

  let weight = 1;
  switch (action) {
    case 'movie_click':
    case 'series_click':
    case 'anime_click':
      weight = 5;
      break;
    case 'trailer_view':
      weight = 8;
      break;
    case 'watch_duration':
      weight = Math.min(Math.floor((metadata.durationSeconds || 0) / 10), 15);
      break;
    case 'search':
      weight = 10;
      break;
    case 'add_watchlist':
      weight = 20;
      break;
    case 'rating_like':
    case 'review_rate':
      weight = metadata.score >= 70 ? 15 : -10;
      break;
    case 'scroll_engage':
      weight = 2;
      break;
    case 'hover_card':
      weight = 1;
      break;
    case 'provider_click':
      weight = 10;
      break;
    default:
      weight = 3;
  }

  // 1. Process genres mapping
  const normalizedGenres = Array.isArray(metadata.genres)
    ? metadata.genres.map((g: any) => typeof g === 'string' ? g : (g && g.name))
    : [];

  normalizedGenres.forEach((gName: string) => {
    if (gName) {
      scores.genres[gName] = (scores.genres[gName] || 0) + weight;
    }
  });

  // 2. Process content type affinity
  const rawType = metadata.type || metadata.media_type;
  if (rawType) {
    if (rawType === 'anime' || (normalizedGenres && normalizedGenres.includes('Anime'))) {
      scores.contentTypes.anime = (scores.contentTypes.anime || 0) + weight;
      scores.animePreference = (scores.animePreference || 0) + weight;
    } else if (rawType === 'series' || rawType === 'tv') {
      scores.contentTypes.tv = (scores.contentTypes.tv || 0) + weight;
    } else {
      scores.contentTypes.movie = (scores.contentTypes.movie || 0) + weight;
    }
  }

  // 3. Actors & Directors affinity mapping
  if (metadata.actors && Array.isArray(metadata.actors)) {
    metadata.actors.forEach((act: string) => {
      scores.actors[act] = (scores.actors[act] || 0) + Math.round(weight * 0.6);
    });
  }
  if (metadata.directors && Array.isArray(metadata.directors)) {
    metadata.directors.forEach((dir: string) => {
      scores.directors[dir] = (scores.directors[dir] || 0) + weight;
    });
  }

  // 4. Mood & Theme affinity
  const isDarkTone = ['thriller', 'horror', 'mystery', 'crime', 'psychological'].some(term =>
    JSON.stringify(metadata).toLowerCase().includes(term)
  );
  if (isDarkTone) {
    scores.tone.dark = (scores.tone.dark || 0) + weight;
    scores.moods['psychological'] = (scores.moods['psychological'] || 0) + Math.round(weight * 0.5);
    scores.moods['dark'] = (scores.moods['dark'] || 0) + weight;
  } else {
    scores.tone.light = (scores.tone.light || 0) + weight;
  }

  // Pacing
  const isSciFiNolanStyle = ['scifi', 'sci-fi', 'space', 'mind-bending', 'nolan', 'inception', 'interstellar'].some(term =>
    JSON.stringify(metadata).toLowerCase().includes(term)
  );
  if (isSciFiNolanStyle) {
    scores.pacing.slowBurn = (scores.pacing.slowBurn || 0) + Math.round(weight * 0.4);
    scores.moods['mind-bending'] = (scores.moods['mind-bending'] || 0) + weight;
  }

  // 5. Providers clicks
  if (metadata.provider) {
    scores.providers[metadata.provider] = (scores.providers[metadata.provider] || 0) + weight;
  }

  // 6. Time of day watching analysis
  const hour = new Date().getHours();
  let timePeriod = 'evening';
  if (hour >= 6 && hour < 12) timePeriod = 'morning';
  else if (hour >= 12 && hour < 18) timePeriod = 'afternoon';
  else if (hour >= 18 && hour < 22) timePeriod = 'evening';
  else timePeriod = 'lateNight';

  scores.timeOfDay[timePeriod] = (scores.timeOfDay[timePeriod] || 0) + 1;

  return scores;
}

/**
 * Tracks a user interaction in an offline-safe, non-blocking, zero-lag fashion.
 */
export function trackInteraction(userId: string | undefined | null, action: string, metadata: any) {
  const uid = userId || 'guest';
  
  // 1. Log guest / guest interactions list under key 'cenivo_guest_interactions' for unauthenticated
  if (!userId) {
    try {
      const unauthLogObj = localStorage.getItem('cenivo_guest_interactions');
      const parsed = unauthLogObj ? JSON.parse(unauthLogObj) : [];
      parsed.push({ action, metadata, timestamp: new Date().toISOString() });
      localStorage.setItem('cenivo_guest_interactions', JSON.stringify(parsed.slice(-20)));
    } catch (_) {}
    return;
  }

  // 2. Compute local scores of user
  try {
    const scoresKey = `cenivo_scores_${uid}`;
    const localScoresStr = localStorage.getItem(scoresKey);
    const existingScores = localScoresStr ? JSON.parse(localScoresStr) : DEFAULT_SCORES;
    const updatedScores = getUpdatedScores(existingScores, action, metadata);
    localStorage.setItem(scoresKey, JSON.stringify(updatedScores));

    // 3. Compute local recent interactions log
    const recentKey = `cenivo_recent_${uid}`;
    const localRecentStr = localStorage.getItem(recentKey);
    const existingRecent = localRecentStr ? JSON.parse(localRecentStr) : [];
    const actionLog = {
      action,
      title: metadata.title || 'Unknown',
      genres: metadata.genres || [],
      type: metadata.type || metadata.media_type || 'movie',
      timestamp: new Date().toISOString()
    };
    const updatedRecent = [actionLog, ...existingRecent].slice(0, 20);
    localStorage.setItem(recentKey, JSON.stringify(updatedRecent));

    // 4. If action is trailer view, append to local watch history
    if (action === 'trailer_view') {
      const historyKey = `cenivo_watch_history_${uid}`;
      const localHistoryStr = localStorage.getItem(historyKey) || '[]';
      const historyItems = JSON.parse(localHistoryStr);
      const standardDuration = metadata.durationSeconds || Math.floor(Math.random() * 60) + 90;
      const historyEntry = {
        id: Math.random().toString(36).substring(2, 9),
        tmdbId: String(metadata.id || metadata.tmdbId || ''),
        mediaType: metadata.type || metadata.media_type || 'movie',
        title: metadata.title || 'Cinematic Epic',
        watchedAt: new Date().toISOString(),
        trailerDurationViewed: standardDuration
      };
      historyItems.push(historyEntry);
      localStorage.setItem(historyKey, JSON.stringify(historyItems));
    }
  } catch (error) {
    console.warn("Silent local tracking update warning:", error);
  }
}
