import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { track } from '../analytics'

/**
 * A scene is a short looping sequence that shows one feature, built from the app's own components on made-up data.
 * It is a list of frames: each waits, then changes a few fields of the scene's state. Nothing in a scene can be
 * clicked or focused (the stage is inert); the page says the same in words beside it.
 */
export type Frame<S> = { wait: number; set: Partial<S> }

type Pointer = { cursor: string | null; press: boolean }

/** A click in a scene: the pointer travels to the element marked `data-cue={cue}`, presses, lets go. */
export function click<S extends Pointer>(cue: string, wait = 600): Frame<S>[] {
  return [
    { wait, set: { cursor: cue } as Partial<S> },
    { wait: 650, set: { press: true } as Partial<S> },
    { wait: 140, set: { press: false } as Partial<S> },
  ]
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

/**
 * Plays the frames in a loop while `ref` is on screen. The first frame's `wait` is the pause before the loop starts again.
 * With reduced motion nothing plays: the scene shows the last frame of a phase, and `goTo` switches phases.
 * `name` is the scene's name in the measured events (../analytics.ts): seen, played to the end, paused, a caption chosen.
 */
export function useScene<S extends { phase: number }>(name: string, initial: S, frames: Frame<S>[]) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const states = useMemo(() => {
    let s = initial
    return frames.map((f) => (s = { ...s, ...f.set }))
  }, [initial, frames])
  const lastOf = (phase: number) => states.reduce((at, s, i) => (s.phase === phase ? i : at), 0)
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 })
    if (ref.current) io.observe(ref.current)
    return () => io.disconnect()
  }, [])

  useEffect(() => { if (reduced) setIndex(lastOf(0)) }, [reduced]) // eslint-disable-line react-hooks/exhaustive-deps

  const playing = visible && !paused && !reduced
  useEffect(() => {
    if (!playing) return
    const next = (index + 1) % frames.length
    const timer = setTimeout(() => {
      // Back at the first frame: the visitor has watched the whole story once.
      if (next === 0 && !done.current) { done.current = true; track({ event: 'scene_complete', scene: name }) }
      setIndex(next)
    }, frames[next].wait)
    return () => clearTimeout(timer)
  }, [playing, index, frames, name])

  // Measured once per visit: the scene came on screen.
  const seen = useRef(false), done = useRef(false)
  useEffect(() => {
    if (visible && !seen.current) { seen.current = true; track({ event: 'scene_view', scene: name }) }
  }, [visible, name])

  return {
    ref, state: states[index], playing, reduced,
    pause: () => { setPaused(true); track({ event: 'scene_pause', scene: name, phase: states[index].phase }) },
    play: () => { setPaused(false); track({ event: 'scene_resume', scene: name, phase: states[index].phase }) },
    /** Jump to a phase: its first frame when playing, its last (the finished picture) with reduced motion. */
    goTo: (phase: number) => {
      track({ event: 'scene_caption_click', scene: name, phase: phase + 1 })
      setIndex(reduced ? lastOf(phase) : Math.max(0, states.findIndex((s) => s.phase === phase)))
    },
  }
}

/**
 * The scene's canvas: drawn at a fixed size and scaled down to the width it gets, like a video, so a scene looks the
 * same on a phone. The pointer goes to the element marked with the current `cursor` cue.
 */
export function Stage({ width, height, cursor, press, sceneKey, maxScale = 1, children }: {
  width: number; height: number; cursor: string | null; press: boolean
  /** How far the scene may be enlarged when it gets more room than its drawn width (the masthead). */
  maxScale?: number
  /** Changes when the scene's layout changes, so the pointer finds its cue again. */
  sceneKey: unknown; children: ReactNode
}) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)

  useLayoutEffect(() => {
    const el = outer.current!
    const fit = () => setScale(Math.min(maxScale, el.clientWidth / width))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width, maxScale])

  useLayoutEffect(() => {
    if (!cursor) return setAt(null)
    const target = inner.current?.querySelector(`[data-cue="${cursor}"]`)
    if (!target) return // The cue is on another screen of the scene: the pointer stays where it was.
    const box = inner.current!.getBoundingClientRect(), r = target.getBoundingClientRect()
    setAt({ x: (r.left - box.left + r.width / 2) / scale, y: (r.top - box.top + r.height / 2) / scale })
  }, [cursor, sceneKey, scale])

  return (
    <div ref={outer} aria-hidden="true" className="relative w-full overflow-hidden" style={{ height: height * scale }}>
      <div ref={inner} inert className="absolute top-0 left-0 origin-top-left" style={{ width, height, transform: `scale(${scale})` }}>
        {children}
        {at && (
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-0 left-0 z-30 size-6 transition-transform duration-500 ease-out motion-reduce:hidden"
            style={{ transform: `translate(${at.x - 4}px, ${at.y - 3}px) scale(${press ? 0.82 : 1})`, transformOrigin: '4px 3px' }}>
            <path d="M4 3l14.5 7.2-6.2 1.9-2 6.3z" className="fill-fg stroke-surface" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  )
}
