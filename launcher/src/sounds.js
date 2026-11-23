let soundsOn = true
let ctx = null

function audio() {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

function tone(freq, dur, vol, type = 'triangle') {
  try {
    const c = audio()
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.value = freq
    g.gain.setValueAtTime(vol, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur)
    o.connect(g).connect(c.destination)
    o.start()
    o.stop(c.currentTime + dur)
  } catch { /* audio unavailable */ }
}

export const play = {
  move: () => tone(420 + Math.random() * 60, 0.02, 0.08),
  select: () => tone(880, 0.08, 0.14),
  open: () => tone(660, 0.07, 0.12),
  back: () => tone(200, 0.12, 0.12),
  toggle: () => tone(720, 0.05, 0.12),
  theme: () => tone(1046, 0.06, 0.1),
}

export function setSoundsEnabled(v) {
  soundsOn = v
}

export function rumble(gp, strength) {
  const v = gp?.vibrationActuator
  if (!v || !gp.vibrationActuator?.playEffect) return
  try {
    if (strength > 0.3) {
      v.playEffect('dual-rumble', { duration: 90, strongMagnitude: 0.5, weakMagnitude: 0.22 })
    } else {
      v.playEffect('small-rumble', { duration: 25, strongMagnitude: 0.25, weakMagnitude: 0.08 })
    }
  } catch { /* vibration unavailable */ }
}
