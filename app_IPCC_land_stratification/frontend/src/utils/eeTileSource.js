/**
 * Earth Engine-aligned tile loading.
 *
 * Faithful port of the tile-loading architecture in the official Earth Engine
 * JS client (github.com/google/earthengine-api → javascript/src/layers):
 *
 *   PriorityPool          ← goog.structs.PriorityPool   (concurrency token pool)
 *   EarthEngineTile       ← ee.layers.AbstractTile + ImageOverlay.ImageTile
 *   earthEngineTileSource ← ee.layers.EarthEngineTileSource
 *
 * Kept in its own module — the way EE keeps these in separate layers/*.js files
 * — so that BOTH the Leaflet map overlay (components/MapComponent.jsx) and the
 * tile prewarmer (utils/api.js) share the SAME global token pool. EE does the
 * same thing with a single static EarthEngineTileSource.TOKEN_POOL_, so the
 * total number of in-flight GEE tile requests across the whole app is capped in
 * one place and a background prewarm can never pile on top of the visible-tile
 * requests and trigger an HTTP 429 burst.
 *
 * A browser <img> cannot read an HTTP status code, so — exactly like the EE
 * client — every tile is fetched with XMLHttpRequest as a Blob. That makes HTTP
 * 429 (TOO_MANY_REQUESTS) visible so we can back off deterministically instead
 * of guessing from an opaque <img> "error". The decoded Blob is handed to the
 * <img> through a same-origin object URL, which additionally means a consumer's
 * canvas getImageData() is never CORS-tainted.
 */

/** Mirrors ee.layers.AbstractTile.Status. */
export const TileStatus = {
  NEW: 'new',
  LOADING: 'loading',
  THROTTLED: 'throttled',
  LOADED: 'loaded',
  FAILED: 'failed',
  ABORTED: 'aborted',
  REMOVED: 'removed',
};

const HTTP_TOO_MANY_REQUESTS = 429;

/**
 * Port of goog.structs.PriorityPool as used by EarthEngineTileSource. Hands out
 * up to `maxCount` opaque tokens (concurrency slots); callers that arrive while
 * every token is in use wait in a queue ordered by ascending priority (smaller
 * number = front). EE uses each tile's creation timestamp as the priority so
 * tiles load in the center-out order they were created in.
 */
export class PriorityPool {
  constructor(minCount = 0, maxCount = 4) {
    this.maxCount_ = maxCount;
    this.inUse_ = 0;
    this.nextToken_ = 1;
    this.waiting_ = []; // [{ callback, priority }] sorted by ascending priority
  }

  /** Mirrors PriorityPool.getObject(callback, priority). */
  getObject(callback, priority = 0) {
    if (this.inUse_ < this.maxCount_) {
      this.inUse_ += 1;
      callback({ id: this.nextToken_++ });
      return;
    }
    let i = this.waiting_.length;
    while (i > 0 && this.waiting_[i - 1].priority > priority) i -= 1;
    this.waiting_.splice(i, 0, { callback, priority });
  }

  /** Mirrors PriorityPool.releaseObject(token): hand the slot to the next waiter. */
  releaseObject(token) {
    if (this.waiting_.length > 0) {
      this.waiting_.shift().callback(token);
      return;
    }
    this.inUse_ = Math.max(0, this.inUse_ - 1);
  }

  /** Mirrors PriorityPool.setMaximumCount(maxCount). */
  setMaximumCount(maxCount) {
    this.maxCount_ = maxCount;
    while (this.inUse_ < this.maxCount_ && this.waiting_.length > 0) {
      this.inUse_ += 1;
      this.waiting_.shift().callback({ id: this.nextToken_++ });
    }
  }
}

/**
 * Port of ee.layers.AbstractTile + ImageOverlay.ImageTile. Loads a tile's bytes
 * with XMLHttpRequest (so HTTP 429 is visible), then renders them into the
 * supplied <img> via a same-origin object URL. Failures are retried with the
 * same exponential backoff EE uses (1s, 2s, 4s, 8s, 16s), capped at maxRetries.
 *
 * `maxRetries` is a per-tile option (EE exposes the same settable field on
 * AbstractTile): opportunistic callers like the prewarmer pass 0 so a failed
 * tile fails fast and frees its token instead of holding it through backoff.
 */
export class EarthEngineTile {
  constructor(img, sourceUrl, { onLoad, onError, maxRetries } = {}) {
    this.img = img;
    this.sourceUrl = sourceUrl;
    this.onLoad_ = onLoad || (() => {});
    this.onError_ = onError || (() => {});
    this.status_ = TileStatus.NEW;
    this.retryAttemptCount_ = 0;
    this.maxRetries_ = Number.isFinite(maxRetries)
      ? maxRetries
      : EarthEngineTile.DEFAULT_MAX_LOAD_RETRIES;
    this.xhr_ = null;
    this.objectUrl_ = '';
    this.retryTimer_ = null;
    this.statusListeners_ = [];
  }

  onStatusChange(fn) { this.statusListeners_.push(fn); }
  offStatusChange(fn) {
    const i = this.statusListeners_.indexOf(fn);
    if (i !== -1) this.statusListeners_.splice(i, 1);
  }
  setStatus_(status) {
    this.status_ = status;
    this.statusListeners_.slice().forEach((fn) => fn(status));
  }
  getStatus() { return this.status_; }
  isAborted() { return this.status_ === TileStatus.ABORTED; }
  isDone() {
    return (
      this.status_ === TileStatus.LOADED ||
      this.status_ === TileStatus.FAILED ||
      this.status_ === TileStatus.ABORTED ||
      this.status_ === TileStatus.REMOVED
    );
  }

  /** Mirrors AbstractTile.startLoad(): XHR for the blob, detect 429, dispatch. */
  startLoad() {
    if (this.isAborted()) return;
    this.setStatus_(TileStatus.LOADING);
    const xhr = new XMLHttpRequest();
    this.xhr_ = xhr;
    xhr.open('GET', this.sourceUrl, true);
    xhr.responseType = 'blob';
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      const status = xhr.status;
      // Surface the throttle for parity with EE's stats; the retry path handles it.
      if (status === HTTP_TOO_MANY_REQUESTS) this.setStatus_(TileStatus.THROTTLED);
      if (status >= 200 && status < 300 && xhr.response) {
        this.finishLoad_(xhr.response);
      } else {
        this.retryLoad_();
      }
    };
    xhr.onerror = () => this.retryLoad_();
    xhr.send();
  }

  /** Mirrors ImageOverlay.ImageTile.finishLoad(): render the blob into the <img>. */
  finishLoad_(blob) {
    try {
      this.objectUrl_ = URL.createObjectURL(blob);
    } catch (e) {
      this.objectUrl_ = ''; // No createObjectURL → fall back to the raw URL.
    }
    const img = this.img;
    const onImgLoad = () => {
      img.removeEventListener('error', onImgError);
      this.setStatus_(TileStatus.LOADED);
      this.onLoad_();
      if (this.objectUrl_) { URL.revokeObjectURL(this.objectUrl_); this.objectUrl_ = ''; }
    };
    const onImgError = () => {
      img.removeEventListener('load', onImgLoad);
      if (this.objectUrl_) { URL.revokeObjectURL(this.objectUrl_); this.objectUrl_ = ''; }
      this.retryLoad_();
    };
    img.addEventListener('load', onImgLoad, { once: true });
    img.addEventListener('error', onImgError, { once: true });
    img.src = this.objectUrl_ || this.sourceUrl;
  }

  /** Mirrors AbstractTile.retryLoad(): exponential backoff, capped at maxRetries. */
  retryLoad_() {
    this.cancelLoad();
    if (this.retryAttemptCount_ >= this.maxRetries_) {
      this.setStatus_(TileStatus.FAILED);
      this.onError_();
      return;
    }
    const delay = 1000 * Math.pow(2, this.retryAttemptCount_++);
    this.retryTimer_ = setTimeout(() => {
      this.retryTimer_ = null;
      if (!this.isAborted()) this.startLoad();
    }, delay);
  }

  /** Mirrors AbstractTile.cancelLoad(): abort the in-flight XHR. */
  cancelLoad() {
    if (this.xhr_) {
      this.xhr_.onreadystatechange = null;
      this.xhr_.onerror = null;
      try { this.xhr_.abort(); } catch (e) { /* already settled */ }
      this.xhr_ = null;
    }
  }

  /** Mirrors AbstractTile.abort(): stop loading and mark the tile aborted. */
  abort() {
    if (this.retryTimer_) { clearTimeout(this.retryTimer_); this.retryTimer_ = null; }
    this.cancelLoad();
    if (this.objectUrl_) { URL.revokeObjectURL(this.objectUrl_); this.objectUrl_ = ''; }
    if (!this.isDone()) this.setStatus_(TileStatus.ABORTED);
  }
}

/** @const Mirrors AbstractTile.DEFAULT_MAX_LOAD_RETRIES_. */
EarthEngineTile.DEFAULT_MAX_LOAD_RETRIES = 5;

/**
 * Port of ee.layers.EarthEngineTileSource. A single global PriorityPool caps how
 * many EE tile requests are in flight across every layer at once (EE's
 * DEFAULT_TOKEN_COUNT_ = 4). loadTile() waits for a token, drives the tile load,
 * and releases the token when the tile reaches a terminal state — so a tile that
 * is panned out of view (and aborted) frees its slot immediately.
 *
 * Tune with earthEngineTileSource.setGlobalParallelism(n) if a low per-project
 * quota needs fewer in-flight requests (EE's own setGlobalParallelism()).
 */
export const earthEngineTileSource = (() => {
  const DEFAULT_TOKEN_COUNT = 4; // ee.layers.EarthEngineTileSource.DEFAULT_TOKEN_COUNT_
  const tokenPool = new PriorityPool(0, DEFAULT_TOKEN_COUNT);

  function handleAvailableToken(tile, token) {
    // The tile may have been aborted while waiting for a token — release it
    // immediately without firing a request (EarthEngineTileSource does the same).
    if (tile.isAborted()) {
      tokenPool.releaseObject(token);
      return;
    }
    const onChange = () => {
      if (tile.isDone()) {
        tile.offStatusChange(onChange);
        tokenPool.releaseObject(token);
      }
    };
    tile.onStatusChange(onChange);
    tile.startLoad();
  }

  return {
    /** Mirrors EarthEngineTileSource.loadTile(tile, opt_priority). */
    loadTile(tile, priority) {
      tokenPool.getObject((token) => handleAvailableToken(tile, token), priority);
    },
    /** Mirrors EarthEngineTileSource.setGlobalParallelism(parallelism). */
    setGlobalParallelism(parallelism) {
      tokenPool.setMaximumCount(parallelism);
    },
  };
})();
