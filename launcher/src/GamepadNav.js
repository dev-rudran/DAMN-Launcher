/**
 * Gamepad navigation engine.
 *
 * Reads navigator.getGamepads() every animation frame and:
 *  - maps the left stick / d-pad to directional movement via onMove(dy, dx, pad)
 *    (repeat with acceleration while held)
 *  - fires onPress(buttonIndex, pad) on rising edges
 *    (0 A/select, 1 B/back, 2 X/favorite, 3 Y/search,
 *     4 LB, 5 RB, 8 back, 9 start; d-pad buttons 12–15 are movement-only)
 *  - feeds the right stick to onRstick(x, y) (scrolling)
 */
export function createGamepadNav({ speedMs = 120, accelMs = 700, repeatMs = 55, deadzone = 0.25,
                                   onMove, onPress, onRstick }) {
  let raf = 0
  let active = false
  let heldSince = 0
  let lastMoveAt = 0
  const pressed = new Set()

  const dirs = (gp) => {
    const out = new Set()
    const btns = gp.buttons || []
    for (let i = 12; i <= 15; i++) {
      if (btns[i] && btns[i].pressed) out.add(['up', 'right', 'down', 'left'][i - 12])
    }
    if (!out.size) {
      const ax = gp.axes || []
      const ay = ax[1], ax0 = ax[0]
      if (ay < -deadzone) out.add('up')
      if (ay > deadzone) out.add('down')
      if (ax0 > deadzone) out.add('right')
      if (ax0 < -deadzone) out.add('left')
    }
    return out
  }

  const frame = () => {
    if (!active) return
    const pad = navigator.getGamepads()[0]
    if (pad && pad.connected) {
      const now = performance.now()

      // Directional movement (repeats while held).
      const d = dirs(pad)
      if (d.size) {
        const dx = (d.has('right') ? 1 : 0) - (d.has('left') ? 1 : 0)
        const dy = (d.has('down') ? 1 : 0) - (d.has('up') ? 1 : 0)
        if (heldSince === 0) heldSince = now
        const accel = now - heldSince > accelMs ? 1.35 : 1
        if (now - lastMoveAt >= speedMs / accel) {
          lastMoveAt = now
          onMove(dy, dx, pad)
        }
      }

      // Right stick (scrolling in details).
      if (onRstick) {
        const ax = pad.axes || []
        if (ax[2] && ax[3]) onRstick(ax[2], ax[3], pad)
      }

      // Face buttons / triggers — rising edges only.
      const btns = pad.buttons || []
      for (let i = 0; i < 16; i++) {
        const b = btns[i]
        const isDown = !!(b && b.pressed)
        if (isDown && !pressed.has(i)) {
          pressed.add(i)
          onPress(i, pad)
        }
        if (!isDown && pressed.has(i)) pressed.delete(i)
      }
    }
    raf = requestAnimationFrame(frame)
  }

  return {
    start() {
      if (!active) {
        active = true
        raf = requestAnimationFrame(frame)
      }
    },
    stop() {
      active = false
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    },
  }
}
