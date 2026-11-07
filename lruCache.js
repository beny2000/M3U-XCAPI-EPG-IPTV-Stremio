// Minimal LRU + TTL cache used when Redis is not configured
const _LRU_DEBUG = (process.env.DEBUG_MODE || '').toLowerCase() === 'true';
function _llog(...a) { if (_LRU_DEBUG) console.log('[LRU]', ...a); }

class LRUCache {
    constructor({ max = 100, ttl = 6 * 3600 * 1000 } = {}) {
        this.max = max;
        this.ttl = ttl;
        this.map = new Map(); // key -> { value, expires }
    }

    _now() { return Date.now(); }

    _pruneExpired() {
        const now = this._now();
        for (const [k, v] of this.map.entries()) {
            if (v.expires && v.expires < now) {
                this.map.delete(k);
            }
        }
    }

    get(key) {
        this._pruneExpired();
        if (!this.map.has(key)) {
            _llog('MISS', key);
            return undefined;
        }
        const entry = this.map.get(key);
        if (entry.expires && entry.expires < this._now()) {
            this.map.delete(key);
            _llog('EXPIRED', key);
            return undefined;
        }
        // Promote (LRU)
        this.map.delete(key);
        this.map.set(key, entry);
        _llog('HIT', key);
        return entry.value;
    }

    set(key, value) {
        this._pruneExpired();
        if (this.map.has(key)) this.map.delete(key);
        this.map.set(key, { value, expires: this.ttl ? this._now() + this.ttl : null });
        // Evict LRU
        if (this.map.size > this.max) {
            const oldestKey = this.map.keys().next().value;
            _llog('EVICT', oldestKey);
            this.map.delete(oldestKey);
        }
        _llog('SET', key, `(size=${this.map.size}/${this.max})`);
    }

    delete(key) {
        this.map.delete(key);
    }

    has(key) {
        return this.get(key) !== undefined;
    }

    keys() {
        this._pruneExpired();
        return Array.from(this.map.keys());
    }

    clear() {
        this.map.clear();
    }
}

module.exports = LRUCache;
