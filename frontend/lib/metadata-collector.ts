/**
 * Metadata Collector Utility
 *
 * Collects comprehensive browser and environment metadata when beta testers
 * submit feedback. This helps debug issues by understanding the exact context
 * in which the feedback was submitted.
 *
 * Usage:
 *   import { collectMetadata } from '@/lib/metadata-collector'
 *   const metadata = collectMetadata()
 */

export interface BrowserInfo {
  userAgent: string;
  language: string;
  languages: readonly string[];
  platform: string;
  cookieEnabled: boolean;
  onLine: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

export interface ViewportSize {
  width: number;
  height: number;
  screenWidth: number;
  screenHeight: number;
  availWidth: number;
  availHeight: number;
  colorDepth: number;
  pixelRatio: number;
}

export interface PerformanceMetrics {
  loadTime?: number;
  domReady?: number;
  firstPaint?: number;
  firstContentfulPaint?: number;
}

export interface PageMetadata {
  url: string;
  pathname: string;
  search: string;
  hash: string;
  referrer: string;
  title: string;
}

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchEnabled: boolean;
  orientation?: string;
}

export interface CollectedMetadata {
  timestamp: string;
  page: PageMetadata;
  browser: BrowserInfo;
  viewport: ViewportSize;
  performance: PerformanceMetrics;
  device: DeviceInfo;
}

/**
 * Detects if the device is mobile or tablet
 */
function detectDevice(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouchEnabled: false,
    };
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const isTouchEnabled = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Tablet detection
  const isTablet =
    /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(
      userAgent
    );

  // Mobile detection (excluding tablets)
  const isMobile =
    !isTablet &&
    /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(
      userAgent
    );

  return {
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
    isTouchEnabled,
    orientation:
      typeof window.screen.orientation !== 'undefined'
        ? window.screen.orientation.type
        : undefined,
  };
}

/**
 * Collects page performance metrics
 */
function collectPerformance(): PerformanceMetrics {
  if (typeof window === 'undefined' || !window.performance) {
    return {};
  }

  const metrics: PerformanceMetrics = {};

  try {
    const timing = performance.timing;
    const navigation = timing.navigationStart;

    // Page load time
    if (timing.loadEventEnd > 0) {
      metrics.loadTime = timing.loadEventEnd - navigation;
    }

    // DOM ready time
    if (timing.domContentLoadedEventEnd > 0) {
      metrics.domReady = timing.domContentLoadedEventEnd - navigation;
    }

    // Paint timings (if available)
    const paintEntries = performance.getEntriesByType('paint');
    paintEntries.forEach((entry) => {
      if (entry.name === 'first-paint') {
        metrics.firstPaint = entry.startTime;
      } else if (entry.name === 'first-contentful-paint') {
        metrics.firstContentfulPaint = entry.startTime;
      }
    });
  } catch (error) {
    console.warn('Error collecting performance metrics:', error);
  }

  return metrics;
}

/**
 * Main function to collect all metadata
 */
export function collectMetadata(): CollectedMetadata {
  if (typeof window === 'undefined') {
    throw new Error('collectMetadata can only be called in the browser');
  }

  // Page information
  const page: PageMetadata = {
    url: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    referrer: document.referrer,
    title: document.title,
  };

  // Browser information
  const browser: BrowserInfo = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: navigator.languages,
    platform: navigator.platform,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    // @ts-ignore - These may not be available in all browsers
    deviceMemory: navigator.deviceMemory,
    // @ts-ignore
    hardwareConcurrency: navigator.hardwareConcurrency,
  };

  // Viewport information
  const viewport: ViewportSize = {
    width: window.innerWidth,
    height: window.innerHeight,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    availWidth: window.screen.availWidth,
    availHeight: window.screen.availHeight,
    colorDepth: window.screen.colorDepth,
    pixelRatio: window.devicePixelRatio || 1,
  };

  // Performance metrics
  const performance = collectPerformance();

  // Device detection
  const device = detectDevice();

  return {
    timestamp: new Date().toISOString(),
    page,
    browser,
    viewport,
    performance,
    device,
  };
}

/**
 * Returns a simplified metadata object suitable for storage
 */
export function collectMetadataForStorage() {
  const metadata = collectMetadata();

  return {
    // Page
    url: metadata.page.url,
    pathname: metadata.page.pathname,
    referrer: metadata.page.referrer,
    title: metadata.page.title,

    // Browser (simplified)
    browserInfo: {
      userAgent: metadata.browser.userAgent,
      language: metadata.browser.language,
      platform: metadata.browser.platform,
      onLine: metadata.browser.onLine,
    },

    // Viewport
    viewportSize: {
      width: metadata.viewport.width,
      height: metadata.viewport.height,
      screenWidth: metadata.viewport.screenWidth,
      screenHeight: metadata.viewport.screenHeight,
      pixelRatio: metadata.viewport.pixelRatio,
    },

    // Device
    deviceInfo: metadata.device,

    // Performance
    performanceMetrics: metadata.performance,

    // Timestamp
    timestamp: metadata.timestamp,
  };
}
