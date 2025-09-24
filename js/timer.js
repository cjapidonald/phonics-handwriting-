const YT_VIDEO_MAP = {
  60: '6H8jMHyvDbk',
  120: 'zKTNXUA7lWI'
};

export class TimerController {
  constructor({ menu, retroTv, controls, playerElementId = 'tvPlayer' } = {}) {
    this.menu = menu;
    this.retroTv = retroTv;
    this.controls = controls;
    this.playerElementId = playerElementId;

    this.player = null;
    this.playerReady = false;
    this.pendingVideoId = null;

    this.totalDuration = 0;
    this.remaining = 0;
    this.tickInterval = null;
    this.isActive = false;

    this.lastDuration = 60;
    this.enabled = true;
  }

  init() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedDuration = Number(window.localStorage.getItem('timer.durationLastUsed'));
      if (Number.isFinite(storedDuration) && storedDuration > 0) {
        this.lastDuration = storedDuration;
      }
      const tvEnabled = window.localStorage.getItem('tv.enabled');
      this.enabled = tvEnabled !== 'false';
    }

    this.highlightDuration(this.lastDuration);
    this.setupMenu();
    this.ensureYouTubeAPI();
  }

  setupMenu() {
    if (!this.menu) {
      return;
    }

    const durationButtons = this.menu.querySelectorAll('[data-duration]');
    durationButtons.forEach(button => {
      button.addEventListener('click', () => {
        const duration = Number(button.dataset.duration);
        if (!Number.isFinite(duration) || duration <= 0) {
          return;
        }
        this.start(duration);
        this.controls?.closeOpenPopover?.();
      });
    });

    const stopButton = this.menu.querySelector('[data-action="stop"]');
    if (stopButton) {
      stopButton.addEventListener('click', () => {
        this.stop(true);
        this.controls?.closeOpenPopover?.();
      });
    }
  }

  ensureYouTubeAPI() {
    if (typeof window === 'undefined') {
      return;
    }

    if (window.YT && window.YT.Player) {
      this.createPlayer();
      return;
    }

    if (!document.querySelector('script[data-yt-api="true"], script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.ytApi = 'true';
      document.head.appendChild(script);
    }

    window.__ytReadyCallbacks = window.__ytReadyCallbacks || [];
    window.__ytReadyCallbacks.push(() => this.createPlayer());

    if (!window.onYouTubeIframeAPIReady || !window.onYouTubeIframeAPIReady.__augmented) {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previous === 'function') {
          previous();
        }
        (window.__ytReadyCallbacks || []).forEach(cb => cb());
        window.__ytReadyCallbacks = [];
      };
      window.onYouTubeIframeAPIReady.__augmented = true;
    }
  }

  createPlayer() {
    if (this.player || typeof window === 'undefined' || !window.YT) {
      return;
    }

    this.player = new window.YT.Player(this.playerElementId, {
      width: 220,
      height: 150,
      playerVars: { controls: 0, rel: 0, modestbranding: 1, playsinline: 1, autoplay: 1 },
      events: {
        onReady: () => {
          this.playerReady = true;
          try {
            this.player.setVolume?.(100);
            this.player.unMute?.();
          } catch (error) {
            // Ignore inability to control volume due to browser policies.
          }
          this.maybePlayPendingVideo();
        }
      }
    });
  }

  start(durationSeconds) {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      return;
    }

    this.stop(false);

    this.totalDuration = durationSeconds;
    this.remaining = durationSeconds;
    this.isActive = true;
    this.pendingVideoId = null;

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('timer.durationLastUsed', String(durationSeconds));
    }
    this.lastDuration = durationSeconds;

    this.highlightDuration(durationSeconds);
    this.controls?.setTimerActiveState(true);
    this.controls?.updateTimerProgress(0);
    this.setRetroTvState(true);

    const videoId = YT_VIDEO_MAP[durationSeconds];
    this.queueOrPlayVideo(videoId);

    this.tickInterval = window.setInterval(() => this.tick(), 1000);
    this.tick(true);
  }

  queueOrPlayVideo(videoId) {
    if (!videoId || !this.enabled) {
      this.pendingVideoId = null;
      return;
    }

    this.ensureYouTubeAPI();

    if (this.player && this.playerReady) {
      try {
        this.player.loadVideoById({ videoId, startSeconds: 0 });
        this.player.playVideo?.();
        this.pendingVideoId = null;
      } catch (error) {
        console.warn('Unable to start timer video playback.', error);
        this.pendingVideoId = videoId;
      }
    } else {
      this.pendingVideoId = videoId;
    }
  }

  tick(initial = false) {
    if (!this.isActive) {
      return;
    }

    if (!initial) {
      this.remaining = Math.max(0, this.remaining - 1);
    }

    const progress = this.totalDuration > 0 ? 1 - this.remaining / this.totalDuration : 0;
    this.controls?.updateTimerProgress(progress);

    if (this.remaining <= 0) {
      this.stop(false);
    }
  }

  stop(manual = true) {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    if (this.player && (this.player.stopVideo || this.player.pauseVideo)) {
      try {
        this.player.stopVideo();
      } catch (error) {
        // ignore
      }
    }

    this.isActive = false;
    this.remaining = 0;
    this.pendingVideoId = null;

    this.controls?.setTimerActiveState(false);
    this.controls?.updateTimerProgress(0);
    this.setRetroTvState(false);
    this.highlightDuration(this.lastDuration);
  }

  highlightDuration(duration) {
    if (!this.menu) {
      return;
    }
    const durationButtons = this.menu.querySelectorAll('[data-duration]');
    durationButtons.forEach(button => {
      const buttonDuration = Number(button.dataset.duration);
      button.classList.toggle('is-selected', buttonDuration === duration && duration > 0);
    });
  }

  setRetroTvState(isOn) {
    if (!this.retroTv) {
      return;
    }
    const active = Boolean(isOn);
    this.retroTv.classList.toggle('tv-on', active);
    this.retroTv.classList.toggle('tv-off', !active);
    this.retroTv.setAttribute('aria-hidden', active ? 'false' : 'true');
  }

  maybePlayPendingVideo() {
    if (!this.isActive) {
      this.pendingVideoId = null;
      return;
    }

    if (this.pendingVideoId && this.player && this.playerReady && this.enabled) {
      const videoId = this.pendingVideoId;
      this.pendingVideoId = null;
      this.queueOrPlayVideo(videoId);
    }
  }
}
