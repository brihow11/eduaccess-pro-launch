import { AdminExclusion } from './adminExclusion';
import { TimeBasedExclusion } from './timeBasedExclusion';

type Metadata = Record<string, unknown>;

class Analytics {
  private readonly enabled: boolean;
  private readonly abTestVariant: 'with_mascot' | 'without_mascot';

  constructor() {
    this.enabled = !AdminExclusion.isAdminExcluded() && !TimeBasedExclusion.isWithinExclusionWindow();
    const saved = window.localStorage.getItem('ace_ab_variant');
    this.abTestVariant = saved === 'without_mascot' ? 'without_mascot' : 'with_mascot';
    window.localStorage.setItem('ace_ab_variant', this.abTestVariant);
  }

  getABVariant() {
    return this.abTestVariant;
  }

  private send(eventName: string, metadata: Metadata = {}) {
    if (!this.enabled) return;
    const gtag = (window as any).gtag;
    if (typeof gtag === 'function') {
      gtag('event', eventName, metadata);
    }
  }

  async trackInteraction(
    eventType: string,
    elementId?: string | null,
    elementText?: string | null,
    elementUrl?: string | null,
    metadata: Metadata = {},
  ) {
    this.send(eventType, { elementId, elementText, elementUrl, ...metadata });
  }

  async trackCTAClick(buttonType: string, url: string) {
    this.send('cta_click', { buttonType, url });
  }

  async trackExitIntent() {
    this.send('exit_intent');
  }

  async trackExitPopupShown() {
    this.send('exit_popup_shown');
  }

  async trackExitPopupDismissed() {
    this.send('exit_popup_dismissed');
  }

  async trackExitPopupClosed() {
    this.send('exit_popup_closed');
  }

  async trackExitPopupCTAClick(url?: string) {
    this.send('exit_popup_cta_click', { url });
  }

  async trackPainPointRead(section: string, index: number, text: string, duration: string) {
    this.send('pain_point_read', { section, index, text, duration });
  }

  async trackVideoPlay(title: string) {
    this.send('video_play', { title });
  }

  async trackVideoProgress(progress: number, currentTime: number) {
    this.send('video_progress', { progress, currentTime });
  }

  async trackVideoAutoplayStart(title: string) {
    this.send('video_autoplay_start', { title });
  }

  async trackVideoManualPlay(title: string) {
    this.send('video_manual_play', { title });
  }

  async trackVideoUnmute(title: string, currentTime: number) {
    this.send('video_unmute', { title, currentTime });
  }

  async trackVideoPause(title: string, currentTime: number) {
    this.send('video_pause', { title, currentTime });
  }

  async trackVideoSeek(title: string, fromTime: number, toTime: number) {
    this.send('video_seek', { title, fromTime, toTime });
  }

  async trackVideoFullscreen(title: string, entered: boolean) {
    this.send('video_fullscreen', { title, entered });
  }

  async trackEngagedWatchTime(title: string, seconds: number) {
    this.send('video_engaged_watch_time', { title, seconds });
  }
}

export const analytics = new Analytics();
