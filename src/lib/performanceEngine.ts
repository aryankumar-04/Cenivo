/**
 * Cinevo High-Performance Engineering Engine
 * Inspired by architectural patterns from Netflix, YouTube, Hotstar, and Instagram.
 * 
 * Includes:
 * 1. Global Touch/Pointer Velocity Tracker & Hover-Intent Calculator
 * 2. Asynchronous Image Decode Scheduler with Priority Queues
 * 3. Behavior Predictor & Prefetch Broker
 * 4. Micro-task Idle Background Scheduler (using Coop requestIdleCallback)
 * 5. LRU Memory Cache Manager with Expiration & Session Alignment
 */

type PerformanceTask = () => void;

class PerformanceEngine {
  // --- 1. HOVER CONFIG & VELOCITY TRACKING ---
  private lastX = 0;
  private lastY = 0;
  private lastTime = 0;
  private currentVelocity = 0; // pixels per millisecond
  private velocityHistory: number[] = [];
  private static HIST_LEN = 5;

  // --- 2. IMAGE DISPATCHER QUEUE ---
  private activeDecodesCount = 0;
  private maxConcurrentDecodes = 3;
  private decodeQueue: Array<{ src: string; priority: number; resolve: () => void }> = [];

  // --- 4. TASK SCHEDULER & IDLE ENGINE ---
  private idleTasks: PerformanceTask[] = [];
  private isProcessingIdle = false;

  // --- 5. LRU MEMORY CACHE REGISTRY ---
  private detailCache = new Map<string, { data: any; timestamp: number }>();
  private cacheMaxCapacity = 100;
  private cacheTTL = 10 * 60 * 1000; // 10 minutes default TTL

  constructor() {
    this.initVelocityTracking();
    this.initMemoryPressureListener();
  }

  // --- pointer tracking logic (Avoids multiple listeners on individual movie cards) ---
  private initVelocityTracking() {
    if (typeof window === 'undefined') return;

    this.lastTime = performance.now();

    const updatePointerStats = (e: MouseEvent) => {
      const now = performance.now();
      const dt = now - this.lastTime;
      if (dt <= 0) return;

      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;

      // Calculate instantaneous velocity in pixels / ms
      const distance = Math.sqrt(dx * dx + dy * dy);
      const instantVelocity = distance / dt;

      // Update references
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.lastTime = now;

      // Sliding window average filter for velocity smoothing
      this.velocityHistory.push(instantVelocity);
      if (this.velocityHistory.length > PerformanceEngine.HIST_LEN) {
        this.velocityHistory.shift();
      }

      this.currentVelocity =
        this.velocityHistory.reduce((sum, v) => sum + v, 0) / this.velocityHistory.length;
    };

    window.addEventListener('mousemove', updatePointerStats, { passive: true });
  }

  /**
   * Listens to tab invisibility or browser memory signals to perform garbage collection.
   */
  private initMemoryPressureListener() {
    if (typeof document === 'undefined') return;

    const performGC = () => {
      if (document.visibilityState === 'hidden') {
        this.runGarbageCollector();
      }
    };

    document.addEventListener('visibilitychange', performGC, { passive: true });
  }

  // --- API 1: HOVER INTENT CALCULATOR (Adaptive Activation delays) ---
  /**
   * Calculates hover confidence and dynamically scales the activation timeout.
   * - Minimal movement / Hover intention: Snappy activation (120ms - 200ms)
   * - High velocity sweeping: Defer activation up to (450ms) to avoid DOM churn
   */
  public getHoverActivationDelay(): number {
    const vel = this.currentVelocity;

    // High speed swipe -> slow down hover detection to check user intent
    if (vel > 1.2) {
      return 500; // slow trigger
    }
    // Moderate pan -> standard delay
    if (vel > 0.4) {
      return 350;
    }
    // Slow target select -> super snappy response
    return 140;
  }

  /**
   * Checks current pointer velocity
   */
  public getPointerVelocity(): number {
    return this.currentVelocity;
  }

  // --- API 2: INTENT-BASED BEHAVIOR PREDICTOR ---
  /**
   * Tracks elements nearing viewports, executing prefetch commands safely in low priority loops.
   */
  public predictDetailsClick(id: string | number, mediaType: 'movie' | 'tv') {
    this.scheduleIdleTask(() => {
      const cacheKey = `${mediaType}_${id}`;
      if (this.detailCache.has(cacheKey)) return;

      // Prewarm network request
      fetch(`/api/tmdb?path=details&id=${id}&type=${mediaType}`)
        .then((res) => {
          if (res.ok) return res.clone().json();
        })
        .then((data) => {
          if (data) this.writeDetailCache(id, mediaType, data);
        })
        .catch(() => {});
    });
  }

  // --- API 3: ADVANCED IMAGE DECODE SCHEDULER (GPU-friendly) ---
  /**
   * Directs high-performance asynchronous decoding for heavy composite images.
   * Prevents frames dropping due to synchronous main-thread image allocations.
   */
  public scheduleImageDecode(src: string, priority: number = 2): Promise<void> {
    return new Promise((resolve) => {
      this.decodeQueue.push({ src, priority, resolve });
      // Sort prioritised images first (higher values = higher priority)
      this.decodeQueue.sort((a, b) => b.priority - a.priority);
      
      this.processDecodeQueue();
    });
  }

  private processDecodeQueue() {
    if (this.activeDecodesCount >= this.maxConcurrentDecodes || this.decodeQueue.length === 0) {
      return;
    }

    const item = this.decodeQueue.shift();
    if (!item) return;

    this.activeDecodesCount++;

    const img = new Image();
    img.src = item.src;
    img.referrerPolicy = 'no-referrer';

    const cleanAndNext = () => {
      this.activeDecodesCount--;
      item.resolve();
      this.processDecodeQueue();
    };

    if (typeof img.decode === 'function') {
      img.decode()
        .then(cleanAndNext)
        .catch(() => {
          // Fallback if decoding error occurs
          cleanAndNext();
        });
    } else {
      // Browsers lacking HTMLImageElement.decode support
      img.onload = cleanAndNext;
      img.onerror = cleanAndNext;
    }
  }

  // --- API 4: MICRO-TASK IDLE BACKGROUND SCHEDULER (requestIdleCallback fallback) ---
  /**
   * Postpones non-visual heavy work (housekeeping, ratings stats calculation, database tracking etc.)
   * during scroll velocity bursts to target full 60 FPS scrolling.
   */
  public scheduleIdleTask(task: PerformanceTask) {
    this.idleTasks.push(task);
    this.triggerIdleLoop();
  }

  private triggerIdleLoop() {
    if (this.isProcessingIdle) return;
    this.isProcessingIdle = true;

    const process = () => {
      if (this.idleTasks.length === 0) {
        this.isProcessingIdle = false;
        return;
      }

      // Respect active scrolling frames
      if (this.currentVelocity > 1.8) {
        requestAnimationFrame(() => process());
        return;
      }

      const task = this.idleTasks.shift();
      if (task) {
        try {
          task();
        } catch (e) {
          console.error('[PerformanceEngine IDLE_TASK ERROR]:', e);
        }
      }

      // Check support for requestIdleCallback
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback((deadline) => {
          if (deadline.timeRemaining() > 1) {
            process();
          } else {
            this.isProcessingIdle = false;
            this.triggerIdleLoop();
          }
        }, { timeout: 2000 });
      } else {
        setTimeout(process, 16);
      }
    };

    process();
  }

  // --- API 5: LRU DETAIL & DATA MEMORY CACHE Registry ---
  /**
   * Retrieves a record if valid (under TTL) and updates LRU position.
   */
  public readDetailCache(id: string | number, mediaType: string): any | null {
    const key = `${mediaType}_${id}`;
    const cached = this.detailCache.get(key);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > this.cacheTTL;
    if (isExpired) {
      this.detailCache.delete(key);
      return null;
    }

    // Update LRU placement by moving to the end of insertion order
    this.detailCache.delete(key);
    this.detailCache.set(key, cached);

    return cached.data;
  }

  /**
   * Writes a metadata retrieval structure under TTL safety.
   */
  public writeDetailCache(id: string | number, mediaType: string, data: any) {
    const key = `${mediaType}_${id}`;
    
    // Check capacity to prevent infinite RAM buildup
    if (this.detailCache.size >= this.cacheMaxCapacity) {
      const oldestKey = this.detailCache.keys().next().value;
      if (oldestKey) {
        this.detailCache.delete(oldestKey);
      }
    }

    this.detailCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Deep Purges obsolete caches and expired assets.
   */
  public runGarbageCollector() {
    const now = Date.now();
    
    // 1. Audit Detail cache TTLs
    for (const [key, val] of this.detailCache.entries()) {
      if (now - val.timestamp > this.cacheTTL) {
        this.detailCache.delete(key);
      }
    }

    // 2. Refresh priority structures
    this.velocityHistory = [];
    this.decodeQueue = [];
    
    console.debug('[PerformanceEngine GC]: Eviction run complete.');
  }
}

export const performanceEngine = new PerformanceEngine();
