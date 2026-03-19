// ---------------------------------------------------------------------------
// FPS-Based Adaptive LOD (Decision 3 — Game Engine Style)
// ---------------------------------------------------------------------------

export type RenderTier = 'full' | 'quick' | 'tile'

const TIER_ORDER: RenderTier[] = ['full', 'quick', 'tile']

/**
 * Monitors frame rendering time and auto-adjusts render tier.
 *
 * - If frameTime > 16ms for 3 consecutive frames → decrease tier (less detail)
 * - If frameTime < 10ms for 5 consecutive frames → increase tier (more detail)
 * - Tier order: full → quick → tile
 */
export class FPSMonitor {
  private consecutiveSlow = 0   // frames > 16ms
  private consecutiveFast = 0   // frames < 10ms
  private _tier: RenderTier = 'full'
  private _tierIndex = 0

  // Thresholds
  private slowThresholdMs = 16
  private fastThresholdMs = 10
  private slowCountToDecrease = 3
  private fastCountToIncrease = 5

  /** Current render tier */
  get tier(): RenderTier { return this._tier }

  /** Record a frame's render time and possibly adjust tier */
  recordFrame(elapsedMs: number) {
    if (elapsedMs > this.slowThresholdMs) {
      this.consecutiveSlow++
      this.consecutiveFast = 0

      if (this.consecutiveSlow >= this.slowCountToDecrease) {
        this.decreaseTier()
        this.consecutiveSlow = 0
      }
    } else if (elapsedMs < this.fastThresholdMs) {
      this.consecutiveFast++
      this.consecutiveSlow = 0

      if (this.consecutiveFast >= this.fastCountToIncrease) {
        this.increaseTier()
        this.consecutiveFast = 0
      }
    } else {
      // In the middle — reset both counters
      this.consecutiveSlow = 0
      this.consecutiveFast = 0
    }
  }

  /** Decrease quality (full → quick → tile) */
  private decreaseTier() {
    if (this._tierIndex < TIER_ORDER.length - 1) {
      this._tierIndex++
      this._tier = TIER_ORDER[this._tierIndex]
    }
  }

  /** Increase quality (tile → quick → full) */
  private increaseTier() {
    if (this._tierIndex > 0) {
      this._tierIndex--
      this._tier = TIER_ORDER[this._tierIndex]
    }
  }

  /** Reset to full quality (e.g., page change) */
  reset() {
    this._tier = 'full'
    this._tierIndex = 0
    this.consecutiveSlow = 0
    this.consecutiveFast = 0
  }
}
