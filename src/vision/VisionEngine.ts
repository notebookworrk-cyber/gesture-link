import { CameraManager, CameraError } from './CameraManager'
import { HandTracker } from './handTracker'
import { FaceTracker, FACE_FRAME_STRIDE } from './faceTracker'
import { PoseTracker } from './PoseTracker'
import { FrameScheduler, videoFrameSource } from './FrameScheduler'
import { HandIdentityTracker } from './HandIdentityTracker'
import { TemporalBuffer } from './TemporalBuffer'
import { TrackingDiagnostics } from './TrackingDiagnostics'
import { normalizeHand, shoulderFrame } from './LandmarkNormalizer'
import { loadProfile, type CalibrationProfile } from './calibration'
import { LandmarkSmoother } from './oneEuro'
import { GestureStateMachine, type GestureUpdate } from './gestureStateMachine'
import {
  INDEX_TIP,
  THUMB_TIP,
  WRIST,
  classifyGesture,
  computeFingers,
  distance2d,
  palmSpan,
} from './geometry'
import { PROCESSING_WIDTH, type FaceReading, type FrameReading, type HandReading, type Handedness, type Landmark, type PoseReading, type StaticGestureId, type VisionConfig } from './types'
import { defaultVisionConfig, cameraNeedsRestart, trackerNeedsReload } from './config'
import { useVisionStatus, type VisionErrorCode } from './visionStatus'

type FrameListener = (frame: FrameReading) => void
type GestureListener = (event: { gesture: StaticGestureId; handedness: Handedness; at: number }) => void

/** One entry of the rolling per-hand history used by sign recognition. */
export interface HandHistorySample {
  timestamp: number
  id: string
  landmarks: Landmark[]
  canonical: HandReading['canonical']
  palmCenter: { x: number; y: number }
}

const STATUS_INTERVAL_MS = 250
const LOW_POWER_INTERVAL_MS = 1000 / 15
const ADAPTIVE_INFERENCE_BUDGET_MS = 42
const ADAPTIVE_COOLDOWN_MS = 6000
const ADAPTIVE_WARMUP_FRAMES = 30
const RELEASE_GRACE_MS = 1200
const RECONFIGURE_DEBOUNCE_MS = 300
const ALL_PROCESSING_WIDTHS = [640, 480, 320]
/** 2 s at 30 Hz; enough for a windowed sign, small enough to stay cheap. */
const HISTORY_CAPACITY = 64

const PALM_POINTS = [WRIST, 5, 9, 13, 17]

function palmCenterOf(landmarks: Landmark[]): { x: number; y: number } {
  let x = 0
  let y = 0
  for (const index of PALM_POINTS) {
    x += landmarks[index]?.x ?? 0
    y += landmarks[index]?.y ?? 0
  }
  return { x: x / PALM_POINTS.length, y: y / PALM_POINTS.length }
}

/**
 * The application's single vision session.
 *
 * One camera stream, one landmarker and one loop serve every workspace. Views
 * attach a preview element and subscribe to frames; they never open a stream
 * themselves. All reported numbers come from the running loop, so the UI can
 * show a real delegate, real frame rate and real inference time.
 */
export class VisionEngine {
  private readonly camera = new CameraManager()
  private readonly tracker = new HandTracker()
  private readonly faces = new FaceTracker()
  private readonly pose = new PoseTracker()
  private readonly identity = new HandIdentityTracker()
  private readonly diagnostics = new TrackingDiagnostics()
  private readonly history = new Map<string, TemporalBuffer<HandHistorySample>>()
  private faceWanted = false
  private faceReadings: FaceReading[] = []
  private poseWanted = true
  private poseReading: PoseReading | null = null
  private lastPoseAt = 0
  private calibration: CalibrationProfile | null = null
  private frameIndex = 0
  private config: VisionConfig = defaultVisionConfig

  private canvas: HTMLCanvasElement | null = null
  private context: CanvasRenderingContext2D | null = null

  private running = false
  private starting: Promise<void> | null = null
  private generation = 0
  private scheduler: FrameScheduler | null = null
  private stopLongTasks: (() => void) | null = null
  private lastVideoTime = -1
  private lastTimestamp = 0

  private frameCount = 0
  private windowStart = 0
  private statusAt = 0
  private latestHandCount = 0
  private lastHandSeenAt = 0
  private loopStartedAt = 0
  private lastInference = 0
  private framesThisRun = 0
  private adaptiveWidth = PROCESSING_WIDTH[defaultVisionConfig.performance.quality]
  private adaptiveCooldownUntil = 0

  private readonly smoothers = new Map<string, LandmarkSmoother>()
  private readonly machines = new Map<string, GestureStateMachine>()
  private readonly lastPalm = new Map<string, { x: number; y: number; at: number }>()

  private readonly frameListeners = new Set<FrameListener>()
  private readonly gestureListeners = new Set<GestureListener>()
  private readonly previews = new Set<HTMLVideoElement>()

  private leases = 0
  private releaseTimer: number | null = null
  private reconfigureTimer: number | null = null
  private pendingCameraRestart = false
  private pendingTrackerReload = false

  private readonly onVisibility = () => {
    if (!this.running) return
    if (document.visibilityState === 'hidden') {
      this.stopLoop()
      useVisionStatus.getState().setStatus({ camera: 'paused', tracking: 'idle' })
    } else {
      this.lastVideoTime = -1
      useVisionStatus.getState().setStatus({ camera: 'live' })
      if (this.tracker.loaded) this.startLoop()
    }
  }

  private readonly onPageHide = () => {
    this.stop()
  }

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibility)
      window.addEventListener('pagehide', this.onPageHide)
    }
  }

  // ---------------------------------------------------------------------
  // Public session control
  // ---------------------------------------------------------------------

  async start(): Promise<void> {
    if (this.running) return
    if (this.starting) return this.starting
    this.starting = this.startInternal().finally(() => {
      this.starting = null
    })
    return this.starting
  }

  /** Stop and start again. Used by the error state's retry action. */
  async retry(): Promise<void> {
    this.stop()
    await this.start()
  }

  stop(): void {
    this.generation += 1
    this.running = false
    this.pendingCameraRestart = false
    this.pendingTrackerReload = false
    this.clearReconfigureTimer()
    this.stopLoop()
    this.tracker.close()
    this.faces.close()
    this.pose.close()
    this.stopLongTasks?.()
    this.stopLongTasks = null
    this.faceReadings = []
    this.poseReading = null
    this.camera.stop()
    // Drop the inference buffer so the next session recreates it and publishes
    // its real width again; `stop` resets the reported width to zero.
    if (this.canvas) {
      this.canvas.width = 0
      this.canvas.height = 0
    }
    this.syncPreviews()
    this.resetTrackingState()
    useVisionStatus.getState().setStatus({
      camera: 'idle',
      tracking: 'idle',
      hands: 0,
      fps: 0,
      inferenceMs: 0,
      delegate: null,
      cameraLabel: null,
      captureWidth: 0,
      captureHeight: 0,
      processingWidth: 0,
      faces: 0,
      faceTracking: this.faceWanted ? 'idle' : 'off',
      faceDelegate: null,
      faceMs: 0,
      poseTracking: this.poseWanted ? 'idle' : 'off',
      poseDelegate: null,
      poseMs: 0,
      shoulderFrameReady: false,
      diagnostics: this.diagnostics.snapshot(),
      error: null,
    })
  }

  configure(next: VisionConfig): void {
    const previous = this.config
    this.config = next

    if (previous.tracking.smoothing !== next.tracking.smoothing) this.resetSmoothers()
    if (previous.performance.quality !== next.performance.quality) {
      this.adaptiveWidth = PROCESSING_WIDTH[next.performance.quality]
      this.lastInference = 0
      this.framesThisRun = 0
    }
    if (!next.performance.adaptive) {
      this.adaptiveWidth = PROCESSING_WIDTH[next.performance.quality]
    }
    for (const machine of this.machines.values()) machine.configure(this.machineConfig())

    // Low-power mode changes the scheduler's rate limit, so the loop is rebuilt.
    if (this.running && previous.performance.lowPower !== next.performance.lowPower) {
      this.stopLoop()
      this.startLoop()
    }
    if (previous.tracking.pose !== next.tracking.pose) {
      this.poseWanted = next.tracking.pose !== 'off'
      if (!this.poseWanted) {
        this.pose.close()
        this.poseReading = null
        useVisionStatus.getState().setStatus({
          poseTracking: 'off',
          poseDelegate: null,
          poseMs: 0,
          shoulderFrameReady: false,
        })
      } else if (this.running) {
        void this.reloadPose()
      }
    }

    if (!this.running) return

    if (cameraNeedsRestart(previous.camera, next.camera)) this.pendingCameraRestart = true
    if (trackerNeedsReload(previous, next)) this.pendingTrackerReload = true
    if (!this.pendingCameraRestart && !this.pendingTrackerReload) return

    this.clearReconfigureTimer()
    this.reconfigureTimer = window.setTimeout(
      () => this.flushReconfigure(),
      RECONFIGURE_DEBOUNCE_MS,
    )
  }

  /**
   * Turns the face landmarker on or off. Workspaces that place stickers ask for
   * faces explicitly; every other workspace keeps the per-frame budget for hands.
   * Resolves once the model is loaded (or the load failed, which is reported in
   * the status store rather than thrown at the view).
   */
  async setFaceTracking(enabled: boolean): Promise<void> {
    this.faceWanted = enabled
    if (!enabled) {
      this.faces.close()
      this.faceReadings = []
      useVisionStatus
        .getState()
        .setStatus({ faceTracking: 'off', faces: 0, faceDelegate: null, faceMs: 0 })
      return
    }
    await this.reloadFaces()
  }

  private async reloadFaces(): Promise<void> {
    if (this.faces.loaded) {
      useVisionStatus.getState().setStatus({ faceTracking: 'running' })
      return
    }
    useVisionStatus.getState().setStatus({ faceTracking: 'loading' })
    try {
      const delegate = await this.faces.load({ delegate: this.trackerDelegate(), maxFaces: 2 })
      if (!this.faceWanted) {
        this.faces.close()
        useVisionStatus.getState().setStatus({ faceTracking: 'off', faces: 0 })
        return
      }
      useVisionStatus.getState().setStatus({
        faceTracking: 'running',
        faceDelegate: delegate === 'GPU' ? 'gpu' : 'cpu',
      })
    } catch {
      this.faceWanted = false
      useVisionStatus.getState().setStatus({ faceTracking: 'error', faces: 0 })
    }
  }

  /**
   * Turns the pose pass on or off. Pose only feeds the shoulder frame, so a
   * failed load degrades to hand-relative normalisation instead of blocking the
   * session, and the status says so.
   */
  async setPoseTracking(enabled: boolean): Promise<void> {
    this.poseWanted = enabled
    if (!enabled) {
      this.pose.close()
      this.poseReading = null
      useVisionStatus.getState().setStatus({
        poseTracking: 'off',
        poseDelegate: null,
        poseMs: 0,
        shoulderFrameReady: false,
      })
      return
    }
    await this.reloadPose()
  }

  private async reloadPose(): Promise<void> {
    if (this.pose.loaded) {
      useVisionStatus.getState().setStatus({ poseTracking: 'running' })
      return
    }
    useVisionStatus.getState().setStatus({ poseTracking: 'loading' })
    const started = performance.now()
    try {
      const delegate = await this.pose.load({ delegate: this.trackerDelegate() })
      if (!this.poseWanted) {
        this.pose.close()
        useVisionStatus.getState().setStatus({ poseTracking: 'off', poseDelegate: null })
        return
      }
      this.diagnostics.recordModelLoad(performance.now() - started)
      useVisionStatus.getState().setStatus({
        poseTracking: 'running',
        poseDelegate: delegate === 'GPU' ? 'gpu' : 'cpu',
      })
    } catch {
      // No pose model means no shoulder frame; hands still track.
      this.poseWanted = false
      useVisionStatus.getState().setStatus({ poseTracking: 'error', poseDelegate: null })
    }
  }

  /** Reads the profile saved by the calibration screen. */
  setCalibration(profile: CalibrationProfile | null): void {
    this.calibration = profile
  }

  get calibrationProfile(): CalibrationProfile | null {
    return this.calibration
  }

  /** Rolling landmark history for one stable hand id. */
  historyFor(handId: string): HandHistorySample[] {
    return this.history.get(handId)?.entries() ?? []
  }

  /**
   * Marks a view as interested in the stream. When the last lease is released
   * and auto-release is enabled, the camera stops shortly after, which keeps the
   * stream from staying open after the user leaves every workspace.
   */
  acquire(): () => void {
    this.leases += 1
    this.clearReleaseTimer()
    let released = false
    return () => {
      if (released) return
      released = true
      this.leases = Math.max(0, this.leases - 1)
      if (this.leases > 0 || !this.config.camera.autoRelease) return
      this.clearReleaseTimer()
      this.releaseTimer = window.setTimeout(() => {
        this.releaseTimer = null
        if (this.leases === 0 && this.config.camera.autoRelease) this.stop()
      }, RELEASE_GRACE_MS)
    }
  }

  // ---------------------------------------------------------------------
  // Preview and subscriptions
  // ---------------------------------------------------------------------

  /** Attaches a `video` element to the shared stream. Returns the detach fn. */
  bindPreview(video: HTMLVideoElement): () => void {
    video.muted = true
    this.previews.add(video)
    this.syncPreview(video)
    return () => {
      this.previews.delete(video)
      if (video.srcObject) video.srcObject = null
    }
  }

  subscribeFrames(listener: FrameListener): () => void {
    this.frameListeners.add(listener)
    return () => {
      this.frameListeners.delete(listener)
    }
  }

  onGesture(listener: GestureListener): () => void {
    this.gestureListeners.add(listener)
    return () => {
      this.gestureListeners.delete(listener)
    }
  }

  get isRunning(): boolean {
    return this.running
  }

  // ---------------------------------------------------------------------
  // Start pipeline
  // ---------------------------------------------------------------------

  private async startInternal(): Promise<void> {
    const generation = ++this.generation
    this.resetTrackingState()
    this.calibration = loadProfile()
    this.stopLongTasks = this.diagnostics.observeLongTasks()
    useVisionStatus.getState().setStatus({
      camera: 'starting',
      tracking: 'idle',
      hands: 0,
      fps: 0,
      inferenceMs: 0,
      delegate: null,
      cameraLabel: null,
      captureWidth: 0,
      captureHeight: 0,
      processingWidth: 0,
      faces: 0,
      faceTracking: this.faceWanted ? 'idle' : 'off',
      faceDelegate: null,
      faceMs: 0,
      poseTracking: this.poseWanted ? 'idle' : 'off',
      poseDelegate: null,
      poseMs: 0,
      shoulderFrameReady: false,
      diagnostics: this.diagnostics.snapshot(),
      error: null,
    })

    try {
      const info = await this.camera.start(this.config.camera)
      if (generation !== this.generation) {
        this.camera.stop()
        return
      }

      this.running = true
      this.syncPreviews()
      useVisionStatus.getState().setStatus({
        camera: 'live',
        cameraLabel: info.trackLabel || null,
        captureWidth: info.width,
        captureHeight: info.height,
        processingWidth: 0,
      })

      await this.loadTracker(generation, true)
      // A workspace may have asked for faces before the camera started, and the
      // tracker is closed on stop, so re-open the face model for this session.
      if (this.faceWanted && this.running) void this.reloadFaces()
      if (this.poseWanted && this.config.tracking.pose !== 'off' && this.running) {
        void this.reloadPose()
      }
    } catch (error) {
      if (generation !== this.generation) return
      this.running = false
      this.tracker.close()
      this.stopLongTasks?.()
      this.stopLongTasks = null
      this.camera.stop()
      this.syncPreviews()
      const cameraError =
        error instanceof CameraError
          ? error
          : new CameraError('unknown', error instanceof Error ? error.message : 'Camera failed to start.')
      useVisionStatus.getState().setStatus({
        camera: 'error',
        tracking: 'idle',
        hands: 0,
        fps: 0,
        inferenceMs: 0,
        delegate: null,
        cameraLabel: null,
        captureWidth: 0,
        captureHeight: 0,
        processingWidth: 0,
        error: { code: cameraError.reason as VisionErrorCode, detail: cameraError.message },
      })
    }
  }

  private async loadTracker(generation: number, startLoopWhenReady: boolean): Promise<void> {
    useVisionStatus.getState().setStatus({ tracking: 'loading', error: null })
    try {
      const delegate = await this.tracker.load({
        delegate: this.trackerDelegate(),
        maxHands: this.config.tracking.maxHands,
        detectionConfidence: this.config.tracking.detectionConfidence,
        trackingConfidence: this.config.tracking.trackingConfidence,
      })
      if (generation !== this.generation) return
      useVisionStatus.getState().setStatus({
        tracking: 'running',
        delegate: delegate === 'GPU' ? 'gpu' : 'cpu',
      })
      if (startLoopWhenReady) this.startLoop()
      else if (!this.looping) this.startLoop()
    } catch (error) {
      if (generation !== this.generation) return
      useVisionStatus.getState().setStatus({
        tracking: 'error',
        error: {
          code: 'model',
          detail: error instanceof Error ? error.message : 'The hand model could not be loaded.',
        },
      })
    }
  }

  private trackerDelegate(): 'GPU' | 'CPU' {
    switch (this.config.performance.delegate) {
      case 'gpu':
        return 'GPU'
      case 'cpu':
        return 'CPU'
      default:
        return 'GPU'
    }
  }

  // ---------------------------------------------------------------------
  // Reconfiguration
  // ---------------------------------------------------------------------

  private flushReconfigure(): void {
    this.reconfigureTimer = null
    const restartCamera = this.pendingCameraRestart
    const reloadTracker = this.pendingTrackerReload
    this.pendingCameraRestart = false
    this.pendingTrackerReload = false

    if (!this.running) return
    if (restartCamera) {
      this.stop()
      void this.start()
      return
    }
    if (reloadTracker) {
      const generation = this.generation
      void this.loadTracker(generation, false)
    }
  }

  private clearReconfigureTimer(): void {
    if (this.reconfigureTimer !== null) {
      window.clearTimeout(this.reconfigureTimer)
      this.reconfigureTimer = null
    }
  }

  private clearReleaseTimer(): void {
    if (this.releaseTimer !== null) {
      window.clearTimeout(this.releaseTimer)
      this.releaseTimer = null
    }
  }

  // ---------------------------------------------------------------------
  // Capture loop
  // ---------------------------------------------------------------------

  private get looping(): boolean {
    return this.scheduler?.running ?? false
  }

  private startLoop(): void {
    if (!this.running || this.looping) return
    const video = this.camera.videoElement
    if (!video) return
    this.lastVideoTime = -1
    this.windowStart = performance.now()
    this.statusAt = this.windowStart
    this.loopStartedAt = this.windowStart
    this.lastHandSeenAt = 0
    this.frameCount = 0
    this.latestHandCount = 0
    this.scheduler = new FrameScheduler(videoFrameSource(video), {
      // Low power is a rate limit, not a different pipeline.
      minIntervalMs: this.config.performance.lowPower ? LOW_POWER_INTERVAL_MS : 0,
      onFrame: (now) => this.processFrame(now),
    })
    this.scheduler.start()
  }

  private stopLoop(): void {
    this.scheduler?.stop()
    this.scheduler = null
  }

  private processFrame = (now: number): void => {
    if (!this.running || !this.looping) return

    const video = this.camera.videoElement
    if (!video || video.readyState < 2 || video.videoWidth === 0) return
    if (document.visibilityState === 'hidden') return

    const started = performance.now()
    // The scheduler already enforces the rate limit; this guard only rejects a
    // repeated video frame, which the callback can deliver after a seek.
    if (video.currentTime === this.lastVideoTime) return
    this.lastVideoTime = video.currentTime

    const canvas = this.ensureCanvas(video)
    const context = this.context
    if (!canvas || !context) return
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    this.lastTimestamp = Math.max(now, this.lastTimestamp + 0.01)

    // Pose runs on its own cadence: hands need every frame, the shoulder frame
    // does not. A pose pass never delays the hand pass for longer than one
    // frame, because both read the same canvas.
    const poseMs = this.posePass(canvas, this.lastTimestamp)
    const result = this.tracker.detect(canvas, this.lastTimestamp)
    this.frameCount += 1
    this.framesThisRun += 1

    // Faces run on alternate frames: the hand landmarker owns most of the
    // per-frame budget, and sticker anchors do not need 30 Hz.
    this.frameIndex += 1
    if (this.faceWanted && this.faces.loaded && this.frameIndex % FACE_FRAME_STRIDE === 0) {
      const faceStarted = performance.now()
      this.faceReadings = this.faces.detect(canvas, this.lastTimestamp)
      const faceMs = performance.now() - faceStarted
      this.diagnostics.recordFace(faceMs)
      useVisionStatus.getState().setStatus({
        faces: this.faceReadings.length,
        faceMs: Math.round(faceMs * 10) / 10,
      })
    }
    const faces = this.faceReadings

    if (result) {
      const handCount = Math.min(result.landmarks.length, this.config.tracking.maxHands)
      const ids = this.identity.assign(
        Array.from({ length: handCount }, (_, index) => {
          const raw = result.landmarks[index] ?? []
          return {
            handedness: (result.handedness[index]?.[0]?.categoryName === 'Left'
              ? 'Left'
              : 'Right') as Handedness,
            center: palmCenterOf(raw),
            score: result.handedness[index]?.[0]?.score ?? 0,
          }
        }),
        started,
      )

      const hands: HandReading[] = []
      for (let index = 0; index < handCount; index += 1) {
        const reading = this.readHand(result, index, started, ids[index]!)
        if (reading) hands.push(reading)
      }
      this.latestHandCount = hands.length
      if (hands.length > 0) this.lastHandSeenAt = started
      else this.expireGestures(started)

      const inferenceMs = performance.now() - started
      this.lastInference =
        this.lastInference > 0 ? this.lastInference * 0.8 + inferenceMs * 0.2 : inferenceMs
      this.diagnostics.recordHand(inferenceMs)
      if (poseMs > 0) this.diagnostics.recordPipeline(inferenceMs + poseMs)

      const frame: FrameReading = {
        timestamp: started,
        hands,
        faces,
        pose: this.poseReading,
        inferenceMs,
        sourceTime: video.currentTime,
      }
      for (const listener of this.frameListeners) {
        try {
          listener(frame)
        } catch {
          // A view must never be able to break the shared loop.
        }
      }
    }

    this.reportStatus(performance.now())
  }

  /** Runs the pose pass when its cadence is due; returns its cost in ms. */
  private posePass(canvas: HTMLCanvasElement, timestamp: number): number {
    if (!this.poseWanted || !this.pose.loaded) return 0
    const interval = 1000 / Math.max(1, this.config.tracking.poseRateHz)
    if (timestamp - this.lastPoseAt < interval) return 0
    const started = performance.now()
    const reading = this.pose.detect(canvas, timestamp)
    const elapsed = performance.now() - started
    this.lastPoseAt = timestamp
    this.diagnostics.recordPose(elapsed)
    if (reading) this.poseReading = reading
    useVisionStatus.getState().setStatus({
      poseMs: Math.round(elapsed * 10) / 10,
      shoulderFrameReady: shoulderFrame(this.poseReading) !== null,
    })
    return elapsed
  }

  private readHand(
    result: { landmarks: Array<Array<Landmark>>; worldLandmarks: Array<Array<Landmark>>; handedness: Array<Array<{ categoryName?: string; score?: number }>> },
    index: number,
    now: number,
    id: string,
  ): HandReading | null {
    const raw = result.landmarks[index]
    if (!raw || raw.length < 21) return null
    const category = result.handedness[index]?.[0]
    const handedness: Handedness = category?.categoryName === 'Left' ? 'Left' : 'Right'

    // Smoothers and gesture machines follow the stable id, not the handedness
    // label, so a label flip mid-sign no longer resets them.
    const smoothed = this.smootherFor(id).smooth(raw, now)
    const world = (result.worldLandmarks[index] ?? raw).map((point) => ({
      x: point.x,
      y: point.y,
      z: point.z,
    }))

    const span = palmSpan(smoothed) || 1
    const fingers = computeFingers(smoothed, this.config.tracking.sensitivity)
    const pinchRatio = distance2d(smoothed[THUMB_TIP]!, smoothed[INDEX_TIP]!) / span
    const gesture = classifyGesture(fingers, pinchRatio, this.config.tracking.pinchSensitivity)

    let palmX = 0
    let palmY = 0
    for (const point of PALM_POINTS) {
      palmX += smoothed[point]?.x ?? 0
      palmY += smoothed[point]?.y ?? 0
    }
    palmX /= PALM_POINTS.length
    palmY /= PALM_POINTS.length

    const previous = this.lastPalm.get(id)
    let speed = 0
    if (previous) {
      const dt = Math.max((now - previous.at) / 1000, 1 / 240)
      speed = distance2d({ x: palmX, y: palmY, z: 0 }, { x: previous.x, y: previous.y, z: 0 }) / dt
    }
    this.lastPalm.set(id, { x: palmX, y: palmY, at: now })

    const canonical = normalizeHand(
      smoothed,
      shoulderFrame(this.poseReading),
      this.config.camera.mirror,
    )

    const machine = this.machineFor(id)
    const update: GestureUpdate = machine.update(gesture, now)
    if (update.fired) {
      for (const listener of this.gestureListeners) {
        try {
          listener({ gesture: update.fired, handedness, at: now })
        } catch {
          // Listener isolation, same reason as frames.
        }
      }
    }

    this.pushHistory({
      timestamp: now,
      id,
      landmarks: smoothed,
      canonical,
      palmCenter: { x: palmX, y: palmY },
    })

    return {
      landmarks: smoothed,
      worldLandmarks: world,
      id,
      canonical,
      handedness,
      score: category?.score ?? 0,
      fingers,
      gesture,
      pinchRatio,
      palmSpan: span,
      palmCenter: { x: palmX, y: palmY },
      speed,
      holdProgress: update.progress,
      fired: update.fired,
    }
  }

  /** Appends to the per-hand rolling history, creating the buffer on demand. */
  private pushHistory(sample: HandHistorySample): void {
    let buffer = this.history.get(sample.id)
    if (!buffer) {
      buffer = new TemporalBuffer<HandHistorySample>(HISTORY_CAPACITY)
      this.history.set(sample.id, buffer)
    }
    buffer.push(sample)
  }

  private expireGestures(now: number): void {
    for (const machine of this.machines.values()) machine.update(null, now)
    this.lastPalm.clear()
  }

  // ---------------------------------------------------------------------
  // Status reporting
  // ---------------------------------------------------------------------

  private reportStatus(now: number): void {
    if (now - this.statusAt < STATUS_INTERVAL_MS) return
    const elapsed = Math.max((now - this.windowStart) / 1000, 0.001)
    const fps = this.frameCount / elapsed
    this.frameCount = 0
    this.windowStart = now
    this.statusAt = now

    const sinceSeen =
      this.lastHandSeenAt > 0 ? now - this.lastHandSeenAt : now - this.loopStartedAt
    const tracking =
      this.latestHandCount > 0 ? 'running' : sinceSeen > 600 ? 'lost' : 'running'

    useVisionStatus.getState().setStatus({
      hands: this.latestHandCount,
      fps: Math.round(fps),
      inferenceMs: Math.round(this.lastInference * 10) / 10,
      tracking,
      diagnostics: {
        ...this.diagnostics.snapshot(),
        // Scheduler drops are the frames this loop never processed.
        droppedFrames: this.scheduler?.droppedFrames ?? this.diagnostics.snapshot().droppedFrames,
      },
    })

    this.adaptQuality(now)
  }

  /**
   * Adaptive quality only ever steps down within the selected preset. Stepping
   * back up tends to oscillate between two widths on a slow machine, so an
   * upgrade requires the user to change the preset.
   */
  private adaptQuality(now: number): void {
    if (!this.config.performance.adaptive) return
    if (this.framesThisRun < ADAPTIVE_WARMUP_FRAMES) return
    if (now < this.adaptiveCooldownUntil) return
    if (this.lastInference < ADAPTIVE_INFERENCE_BUDGET_MS) return

    const maxWidth = PROCESSING_WIDTH[this.config.performance.quality]
    const candidates = ALL_PROCESSING_WIDTHS.filter((width) => width < maxWidth)
    const next = candidates.filter((width) => width < this.adaptiveWidth)[0]
    if (next === undefined) return

    this.adaptiveWidth = next
    this.adaptiveCooldownUntil = now + ADAPTIVE_COOLDOWN_MS
    this.lastInference = 0
    this.framesThisRun = 0
    if (this.canvas) this.canvas.width = 0
    useVisionStatus.getState().setStatus({ processingWidth: next })
  }

  // ---------------------------------------------------------------------
  // Canvas and filters
  // ---------------------------------------------------------------------

  private effectiveWidth(): number {
    return this.adaptiveWidth
  }

  private ensureCanvas(video: HTMLVideoElement): HTMLCanvasElement | null {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas')
      this.context = this.canvas.getContext('2d', { alpha: false, desynchronized: true })
    }
    const context = this.context
    if (!context) return null

    const width = this.effectiveWidth()
    const aspect = video.videoHeight > 0 ? video.videoHeight / video.videoWidth : 0.75
    const height = Math.max(1, Math.round(width * aspect))
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'medium'
      useVisionStatus.getState().setStatus({ processingWidth: width })
    }
    return this.canvas
  }

  private smootherFor(id: string): LandmarkSmoother {
    let smoother = this.smoothers.get(id)
    if (!smoother) {
      const smoothing = this.config.tracking.smoothing
      smoother = new LandmarkSmoother({
        minCutoff: 0.35 + 2.8 * Math.pow(1 - smoothing, 1.6),
        beta: 0.004 + 0.035 * Math.pow(1 - smoothing, 2),
      })
      this.smoothers.set(id, smoother)
    }
    return smoother
  }

  private machineFor(key: string): GestureStateMachine {
    let machine = this.machines.get(key)
    if (!machine) {
      machine = new GestureStateMachine(this.machineConfig())
      this.machines.set(key, machine)
    }
    return machine
  }

  private machineConfig() {
    return {
      holdMs: this.config.tracking.holdMs,
      cooldownMs: this.config.tracking.cooldownMs,
      lossToleranceMs: this.config.tracking.lossToleranceMs,
    }
  }

  private resetSmoothers(): void {
    for (const smoother of this.smoothers.values()) smoother.reset()
    this.smoothers.clear()
  }

  private resetTrackingState(): void {
    this.smoothers.clear()
    this.machines.clear()
    this.lastPalm.clear()
    this.history.clear()
    this.identity.reset()
    this.poseReading = null
    this.lastPoseAt = 0
    this.diagnostics.reset()
    this.latestHandCount = 0
    this.lastInference = 0
    this.framesThisRun = 0
    this.frameCount = 0
    this.adaptiveWidth = PROCESSING_WIDTH[this.config.performance.quality]
    this.adaptiveCooldownUntil = 0
  }

  private syncPreviews(): void {
    for (const video of this.previews) this.syncPreview(video)
  }

  private syncPreview(video: HTMLVideoElement): void {
    const stream = this.camera.getStream()
    if (video.srcObject !== stream) video.srcObject = stream
    if (stream) void video.play().catch(() => undefined)
  }
}

let engine: VisionEngine | null = null

/** Lazily constructed so imports never touch `document` during tests. */
export function getVisionEngine(): VisionEngine {
  if (!engine) engine = new VisionEngine()
  return engine
}
