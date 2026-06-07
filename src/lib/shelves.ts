export const ACTIVE_SHELVES = [
  { id: 'trending', title: 'Trending Now', subtitle: 'The highest trending films globally this week.', route: 'trending', params: '' },
  { id: 'series', title: 'Popular in Your Region', subtitle: 'Top loved series and television stories.', route: 'tv_popular', params: '' },
  { id: 'anime', title: 'Elite Anime', subtitle: 'Handpicked animated masterworks.', route: 'anime', params: '' },
  { id: 'top_imdb', title: 'Top IMDb Picks', subtitle: 'Critically loved legendary masterpieces.', route: 'movie_top_rated', params: '' },
  { id: 'indian', title: 'Indian Hits', subtitle: 'The absolute biggest blockbusters from Bollywood.', route: 'discover', params: 'with_original_language=hi' },
  { id: 'south_indian', title: 'South Indian Blockbusters', subtitle: 'High intensity epic dramas and action blockbusters.', route: 'discover', params: 'with_original_language=te|ta' },
  { id: 'hollywood', title: 'Hollywood Essentials', subtitle: 'Global chartbusters and star-studded screenplays.', route: 'movie_popular', params: '' },
  { id: 'scifi', title: 'Mind-Bending Sci-Fi', subtitle: 'Stellar space odysseys and cerebral futurology.', route: 'discover', params: 'with_genres=878' },
  { id: 'dark_thrillers', title: 'Dark Thrillers', subtitle: 'Haunting psychological suspense and crime mysteries.', route: 'discover', params: 'with_genres=53' },
  { id: 'anime_zone', title: 'Anime Zone', subtitle: 'Premium animation and high fantasy epics.', route: 'discover', params: 'with_genres=16' },
  { id: 'critically_acclaimed', title: 'Critically Acclaimed', subtitle: 'Selected masterpiece blockbusters loved by global critics.', route: 'discover', params: 'vote_average_gte=8' }
];

export const SHELF_POOL = [
  { id: 'hidden_gems', title: 'Hidden Gems', subtitle: 'Highly rated underrated films with fewer reviews.', route: 'discover', params: 'vote_average_gte=7.5&vote_count_lte=2000' },
  { id: 'feel_good', title: 'Feel-Good Weekend', subtitle: 'Light-hearted comedies and family favorites to elevate your day.', route: 'discover', params: 'with_genres=35' },
  { id: 'crime_mystery', title: 'Crime & Mystery', subtitle: 'Suspenseful detective operations and dark puzzle timelines.', route: 'discover', params: 'with_genres=9648' },
  { id: 'award_winners', title: 'Award Winners', subtitle: 'Oscar gold and major global film academy recipients.', route: 'discover', params: 'sort_by=vote_count.desc' },
  { id: 'recently_added', title: 'Recently Added', subtitle: 'Recent digital streaming integrations with pristine quality.', route: 'upcoming', params: '' },
  { id: 'neo_noir', title: 'Neo Noir Crimes', subtitle: 'Shadowy streets, gritty detectives, and morally grey cases.', route: 'discover', params: 'with_genres=80&sort_by=popularity.desc' },
  { id: 'time_travel', title: 'Time Travel Paradoxes', subtitle: 'Mind-bending temporal loops and destiny shifts.', route: 'discover', params: 'with_genres=878&query=time' },
  { id: 'korean_thrillers', title: 'Korean Thrillers', subtitle: 'Intense suspense and brilliant plots from South Korea.', route: 'discover', params: 'with_original_language=ko&with_genres=53' },
  { id: 'space_epics', title: 'Space Epics', subtitle: 'Infinite galaxies, interstellar travel, and cosmic secrets.', route: 'discover', params: 'with_genres=878&query=space' },
  { id: 'psychological_horror', title: 'Psychological Horrors', subtitle: 'Eerie nightmares and tense, bone-chilling mental terrors.', route: 'discover', params: 'with_genres=27&sort_by=vote_average.desc' },
  { id: 'survival_stories', title: 'Survival Stories', subtitle: 'Struggle against elements and raw endurance thrillers.', route: 'discover', params: 'with_genres=12,53' },
  { id: 'true_stories', title: 'True Story Dramas', subtitle: 'Extraordinary real world histories brought to the screen.', route: 'discover', params: 'with_genres=18,36' }
];

export const ALL_SHELVES = [...ACTIVE_SHELVES, ...SHELF_POOL];
