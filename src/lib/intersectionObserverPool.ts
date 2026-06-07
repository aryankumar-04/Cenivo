import { useEffect } from 'react';

type IntersectionCallback = (isIntersecting: boolean) => void;

class IntersectionObserverPool {
  private observer: IntersectionObserver | null = null;
  private callbacks = new Map<Element, IntersectionCallback>();
  private rootMargin: string;

  constructor(rootMargin: string) {
    this.rootMargin = rootMargin;
  }

  private init() {
    if (this.observer) return;
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const cb = this.callbacks.get(entry.target);
        if (cb) {
          cb(entry.isIntersecting);
        }
      });
    }, {
      rootMargin: this.rootMargin,
      threshold: [0, 0.01]
    });
  }

  observe(element: Element, callback: IntersectionCallback) {
    this.init();
    this.callbacks.set(element, callback);
    this.observer!.observe(element);
  }

  unobserve(element: Element) {
    if (this.observer) {
      this.observer.unobserve(element);
    }
    this.callbacks.delete(element);
  }
}

const pools = new Map<string, IntersectionObserverPool>();

/**
 * Retrieves a shared Intersection Observer pool matching the given rootMargin.
 */
export function getSharedObserver(rootMargin: string = '1000px'): IntersectionObserverPool {
  let pool = pools.get(rootMargin);
  if (!pool) {
    pool = new IntersectionObserverPool(rootMargin);
    pools.set(rootMargin, pool);
  }
  return pool;
}
