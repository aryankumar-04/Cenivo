import { create } from 'zustand';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  doc, 
  setDoc, 
  onSnapshot
} from 'firebase/firestore';

export interface WatchHistoryItem {
  id?: string;
  tmdbId: string;
  mediaType: string;
  title: string;
  watchedAt: string;
  trailerDurationViewed: number; // in seconds
}

export interface ProfileSettings {
  displayName: string;
  username: string;
  usernameLower?: string;
  bio: string;
  avatarUrl: string;
}

export interface PrivacySettings {
  publicProfile: boolean;
  showWatchlist: boolean;
  showRatings: boolean;
}

export interface PlaybackSettings {
  autoPlayTrailers: boolean;
  trailerAudio: boolean;
  hoverPreviewVideos: boolean;
  autoPlayNextTrailer: boolean;
  dataSaver: boolean;
  dataSaverMode: boolean;
}

export interface NotificationSettings {
  watchlistReleases: boolean;
  newSeasons: boolean;
  newEpisodes: boolean;
  recommendationUpdates: boolean;
  trendingContent: boolean;
  newsletter: boolean;
  platformUpdates: boolean;
  deliveryMethod: 'in_app' | 'email' | 'both';
}

interface SettingsState {
  profile: ProfileSettings;
  privacy: PrivacySettings;
  playback: PlaybackSettings;
  notifications: NotificationSettings;
  historyItems: WatchHistoryItem[];
  stats: {
    moviesViewed: number;
    seriesViewed: number;
    trailersPlayed: number;
    minutesWatched: number;
  };
  loading: boolean;
  draftBio: string;

  // Actions
  subscribeToSettings: (uid: string) => () => void;
  updateProfileField: (uid: string, fields: Partial<ProfileSettings>) => Promise<void>;
  updatePrivacyField: (uid: string, field: keyof PrivacySettings, value: boolean) => Promise<void>;
  updatePlaybackField: (uid: string, field: keyof PlaybackSettings, value: boolean) => Promise<void>;
  updateNotificationField: (uid: string, field: keyof NotificationSettings | 'deliveryMethod', value: any) => Promise<void>;
  addWatchHistory: (uid: string, item: Omit<WatchHistoryItem, 'watchedAt'>) => Promise<void>;
  clearWatchHistory: (uid: string) => Promise<void>;
  setDraftBio: (bio: string) => void;
  loadWatchHistory: (uid: string) => Promise<void>;
}

const DEFAULT_PROFILE: ProfileSettings = {
  displayName: '',
  username: '',
  bio: '',
  avatarUrl: ''
};

const DEFAULT_PRIVACY: PrivacySettings = {
  publicProfile: false,
  showWatchlist: false,
  showRatings: false
};

const DEFAULT_PLAYBACK: PlaybackSettings = {
  autoPlayTrailers: true,
  trailerAudio: false,
  hoverPreviewVideos: true,
  autoPlayNextTrailer: true,
  dataSaver: false,
  dataSaverMode: false
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  watchlistReleases: true,
  newSeasons: true,
  newEpisodes: false,
  recommendationUpdates: true,
  trendingContent: false,
  newsletter: true,
  platformUpdates: true,
  deliveryMethod: 'in_app'
};

export const useSettingsStore = create<SettingsState>((set, get) => {
  return {
    profile: DEFAULT_PROFILE,
    privacy: DEFAULT_PRIVACY,
    playback: DEFAULT_PLAYBACK,
    notifications: DEFAULT_NOTIFICATIONS,
    historyItems: [],
    stats: {
      moviesViewed: 0,
      seriesViewed: 0,
      trailersPlayed: 0,
      minutesWatched: 0
    },
    loading: true,
    draftBio: '',

    setDraftBio: (bio: string) => set({ draftBio: bio }),

    subscribeToSettings: (uid: string) => {
      set({ loading: true });

      const handleProfileSnap = (snapshot: any) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          set({ profile: { ...DEFAULT_PROFILE, ...data } });
          if (!get().draftBio && data.bio) {
            set({ draftBio: data.bio });
          }
        } else {
          // Fallback check user's main doc or seed
          onSnapshot(doc(db, 'users', uid), (userSnap) => {
            if (userSnap.exists()) {
              const uData = userSnap.data();
              const profileSeed = {
                displayName: uData.displayName || '',
                username: (uData.username || '').replace(/^@+/, ''),
                usernameLower: (uData.usernameLower || '').toLowerCase(),
                bio: uData.bio || '',
                avatarUrl: uData.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${uid}`
              };
              set({ profile: profileSeed });
            }
          });
        }
      };

      const handlePrivacySnap = (snapshot: any) => {
        if (snapshot.exists()) {
          set({ privacy: { ...DEFAULT_PRIVACY, ...snapshot.data() } });
        }
      };

      const handlePlaybackSnap = (snapshot: any) => {
        if (snapshot.exists()) {
          const data = snapshot.data() || {};
          const mapped = {
            ...DEFAULT_PLAYBACK,
            ...data,
            dataSaver: data.dataSaver ?? data.dataSaverMode ?? false,
            dataSaverMode: data.dataSaverMode ?? data.dataSaver ?? false
          };
          set({ playback: mapped });
        }
      };

      const handleNotificationsSnap = (snapshot: any) => {
        if (snapshot.exists()) {
          set({ notifications: { ...DEFAULT_NOTIFICATIONS, ...snapshot.data() } });
        }
      };

      // Set up onSnapshot subscriptions for the settings paths
      const unsubProfile = onSnapshot(doc(db, 'users', uid, 'settings', 'profile'), handleProfileSnap, (err) => {
        console.warn("Sub settings profile error:", err);
      });

      const unsubPrivacy = onSnapshot(doc(db, 'users', uid, 'settings', 'privacy'), handlePrivacySnap, (err) => {
        console.warn("Sub settings privacy error:", err);
      });

      const unsubPlayback = onSnapshot(doc(db, 'users', uid, 'settings', 'playback'), handlePlaybackSnap, (err) => {
        console.warn("Sub settings playback error:", err);
      });

      const unsubNotifications = onSnapshot(doc(db, 'users', uid, 'settings', 'notifications'), handleNotificationsSnap, (err) => {
        console.warn("Sub settings notifications error:", err);
      });

      // Fetch history immediately (client-side offline localStorage approach)
      get().loadWatchHistory(uid).then(() => {
        set({ loading: false });
      });

      return () => {
        unsubProfile();
        unsubPrivacy();
        unsubPlayback();
        unsubNotifications();
      };
    },

    loadWatchHistory: async (uid: string) => {
      try {
        const key = `cenivo_watch_history_${uid}`;
        const dataStr = localStorage.getItem(key) || '[]';
        const items = JSON.parse(dataStr);
        let moviesCount = 0;
        let seriesCount = 0;
        let totalTimeSec = 0;

        items.forEach((item: any) => {
          const isTv = ['tv', 'series', 'anime'].includes((item.mediaType || 'movie').toLowerCase());
          if (isTv) {
            seriesCount++;
          } else {
            moviesCount++;
          }
          totalTimeSec += Number(item.trailerDurationViewed || 120);
        });

        // Sorted descending by watchedAt
        items.sort((a: any, b: any) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime());

        set({
          historyItems: items,
          stats: {
            moviesViewed: moviesCount,
            seriesViewed: seriesCount,
            trailersPlayed: items.length,
            minutesWatched: Math.round(totalTimeSec / 60)
          }
        });
      } catch (err) {
        console.warn("Failed loading watch history client-side:", err);
      }
    },

    updateProfileField: async (uid: string, fields: Partial<ProfileSettings>) => {
      const path = `users/${uid}/settings/profile`;
      try {
        const profileRef = doc(db, 'users', uid, 'settings', 'profile');
        const nextProfile = { ...get().profile, ...fields };
        await setDoc(profileRef, nextProfile, { merge: true }).catch(err => 
          handleFirestoreError(err, OperationType.UPDATE, path)
        );

        // Also save to users/{uid} for standard global display compatibility
        const userRef = doc(db, 'users', uid);
        const userUpdate: Record<string, any> = {};
        if (fields.displayName !== undefined) userUpdate.displayName = fields.displayName;
        if (fields.username !== undefined) {
          const cleanedUsername = fields.username.replace(/^@+/, '');
          userUpdate.username = cleanedUsername;
          userUpdate.usernameLower = cleanedUsername.toLowerCase();
          nextProfile.username = cleanedUsername;
          nextProfile.usernameLower = cleanedUsername.toLowerCase();
        }
        if (fields.bio !== undefined) userUpdate.bio = fields.bio;
        if (fields.avatarUrl !== undefined) {
          userUpdate.avatarUrl = fields.avatarUrl;
        }
        await setDoc(userRef, userUpdate, { merge: true }).catch(err => 
          handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`)
        );

        set({ profile: nextProfile });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },

    updatePrivacyField: async (uid: string, field: keyof PrivacySettings, value: boolean) => {
      const path = `users/${uid}/settings/privacy`;
      try {
        const docRef = doc(db, 'users', uid, 'settings', 'privacy');
        const updated = { ...get().privacy, [field]: value };
        await setDoc(docRef, updated, { merge: true }).catch(err => 
          handleFirestoreError(err, OperationType.UPDATE, path)
        );

        // Also sync profile visibility on the main user document
        if (field === 'publicProfile') {
          await setDoc(doc(db, 'users', uid), { publicProfile: value }, { merge: true });
        }

        set({ privacy: updated });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },

    updatePlaybackField: async (uid: string, field: keyof PlaybackSettings, value: boolean) => {
      const path = `users/${uid}/settings/playback`;
      try {
        const docRef = doc(db, 'users', uid, 'settings', 'playback');
        let updated = { ...get().playback, [field]: value };
        if (field === 'dataSaver' || field === 'dataSaverMode') {
          updated.dataSaver = value;
          updated.dataSaverMode = value;
        }
        await setDoc(docRef, updated, { merge: true }).catch(err => 
          handleFirestoreError(err, OperationType.UPDATE, path)
        );
        set({ playback: updated });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },

    updateNotificationField: async (uid: string, field: keyof NotificationSettings | 'deliveryMethod', value: any) => {
      const path = `users/${uid}/settings/notifications`;
      try {
        const docRef = doc(db, 'users', uid, 'settings', 'notifications');
        const updated = { ...get().notifications, [field]: value };
        await setDoc(docRef, updated, { merge: true }).catch(err => 
          handleFirestoreError(err, OperationType.UPDATE, path)
        );
        set({ notifications: updated });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },

    addWatchHistory: async (uid: string, item: Omit<WatchHistoryItem, 'watchedAt'>) => {
      try {
        const key = `cenivo_watch_history_${uid}`;
        const dataStr = localStorage.getItem(key) || '[]';
        const items = JSON.parse(dataStr);
        const watchedAt = new Date().toISOString();
        const payload = {
          ...item,
          id: Math.random().toString(36).substring(2, 9),
          watchedAt
        };
        items.push(payload);
        localStorage.setItem(key, JSON.stringify(items));

        // Fetch again to update stats
        await get().loadWatchHistory(uid);
      } catch (err) {
        console.warn("Failed saving watch history client-side:", err);
      }
    },

    clearWatchHistory: async (uid: string) => {
      try {
        const key = `cenivo_watch_history_${uid}`;
        localStorage.removeItem(key);

        set({
          historyItems: [],
          stats: {
            moviesViewed: 0,
            seriesViewed: 0,
            trailersPlayed: 0,
            minutesWatched: 0
          }
        });
      } catch (err) {
        console.warn("Failed clearing watch history client-side:", err);
      }
    }
  };
});
