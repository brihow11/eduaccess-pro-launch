import { analytics } from '../services/analytics';

interface VideoTrackingOptions {
  videoTitle: string;
  isAutoplay: boolean;
  trackMilestones?: number[];
}

export class VideoTracker {
  private video: HTMLVideoElement;
  private videoTitle: string;
  private isAutoplay: boolean;
  private trackedMilestones: Set<number>;
  private milestones: number[];
  private engagementStartTime: number | null = null;
  private totalEngagedTime: number = 0;
  private isInViewport: boolean = false;
  private hasUserEngaged: boolean = false;
  private lastTimeUpdate: number = 0;

  constructor(video: HTMLVideoElement, options: VideoTrackingOptions) {
    this.video = video;
    this.videoTitle = options.videoTitle;
    this.isAutoplay = options.isAutoplay;
    this.milestones = options.trackMilestones || [25, 50, 75, 100];
    this.trackedMilestones = new Set();

    this.setupTracking();
  }

  private setupTracking() {
    if (this.isAutoplay) {
      this.video.addEventListener('play', () => {
        if (!this.hasUserEngaged) {
          analytics.trackVideoAutoplayStart(this.videoTitle);
        }
      }, { once: true });
    }

    this.video.addEventListener('play', (e) => {
      if (this.hasUserEngaged || !this.isAutoplay) {
        const isManual = !(e.target as HTMLVideoElement).autoplay || this.hasUserEngaged;
        if (isManual) {
          analytics.trackVideoManualPlay(this.videoTitle);
          this.hasUserEngaged = true;
        }
      }
    });

    this.video.addEventListener('volumechange', () => {
      if (this.video.muted === false && this.video.volume > 0) {
        analytics.trackVideoUnmute(this.videoTitle, this.video.currentTime);
        this.hasUserEngaged = true;
        this.startEngagementTracking();
      }
    });

    this.video.addEventListener('pause', () => {
      if (this.hasUserEngaged) {
        analytics.trackVideoPause(this.videoTitle, this.video.currentTime);
        this.stopEngagementTracking();
      }
    });

    this.video.addEventListener('seeked', () => {
      if (this.hasUserEngaged && Math.abs(this.video.currentTime - this.lastTimeUpdate) > 1) {
        analytics.trackVideoSeek(this.videoTitle, this.lastTimeUpdate, this.video.currentTime);
      }
    });

    this.video.addEventListener('timeupdate', () => {
      this.lastTimeUpdate = this.video.currentTime;
      this.checkMilestones();

      if (this.hasUserEngaged && this.isInViewport && !this.video.paused && !this.video.muted) {
        this.updateEngagedTime();
      }
    });

    this.video.addEventListener('ended', () => {
      if (this.hasUserEngaged) {
        this.checkMilestones();
        this.stopEngagementTracking();
      }
    });

    this.video.addEventListener('webkitfullscreenchange', () => {
      const isFullscreen = document.fullscreenElement === this.video;
      if (this.hasUserEngaged) {
        analytics.trackVideoFullscreen(this.videoTitle, isFullscreen);
      }
    });

    this.video.addEventListener('fullscreenchange', () => {
      const isFullscreen = document.fullscreenElement === this.video;
      if (this.hasUserEngaged) {
        analytics.trackVideoFullscreen(this.videoTitle, isFullscreen);
      }
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          this.isInViewport = entry.intersectionRatio >= 0.5;

          if (!this.isInViewport) {
            this.stopEngagementTracking();
          } else if (this.hasUserEngaged && !this.video.paused && !this.video.muted) {
            this.startEngagementTracking();
          }
        });
      },
      { threshold: [0, 0.5, 1] }
    );

    observer.observe(this.video);

    window.addEventListener('beforeunload', () => {
      this.stopEngagementTracking();
      if (this.totalEngagedTime > 0) {
        analytics.trackEngagedWatchTime(this.videoTitle, Math.round(this.totalEngagedTime));
      }
    });
  }

  private checkMilestones() {
    if (this.video.duration > 0) {
      const progress = (this.video.currentTime / this.video.duration) * 100;

      this.milestones.forEach((milestone) => {
        if (progress >= milestone && !this.trackedMilestones.has(milestone)) {
          this.trackedMilestones.add(milestone);
          if (this.hasUserEngaged || !this.isAutoplay) {
            analytics.trackVideoProgress(milestone, this.video.currentTime);
          }
        }
      });
    }
  }

  private startEngagementTracking() {
    if (!this.engagementStartTime) {
      this.engagementStartTime = Date.now();
    }
  }

  private stopEngagementTracking() {
    if (this.engagementStartTime) {
      this.totalEngagedTime += (Date.now() - this.engagementStartTime) / 1000;
      this.engagementStartTime = null;
    }
  }

  private updateEngagedTime() {
    if (this.engagementStartTime) {
      const currentEngagedTime = (Date.now() - this.engagementStartTime) / 1000;
      if (currentEngagedTime >= 10) {
        this.totalEngagedTime += currentEngagedTime;
        this.engagementStartTime = Date.now();
      }
    }
  }

  public destroy() {
    this.stopEngagementTracking();
    if (this.totalEngagedTime > 0) {
      analytics.trackEngagedWatchTime(this.videoTitle, Math.round(this.totalEngagedTime));
    }
  }
}

export function setupVideoTracking(
  videoElement: HTMLVideoElement,
  videoTitle: string,
  isAutoplay: boolean = false
): VideoTracker {
  return new VideoTracker(videoElement, {
    videoTitle,
    isAutoplay,
  });
}
