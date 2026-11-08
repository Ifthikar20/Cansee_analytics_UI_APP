import { onScopeDispose, readonly, ref, toValue, watch } from 'vue'

// One shared one-second tick for the running times of research agents. A
// row subscribes only while its task runs, so the clock stops when nothing
// runs and a finished tree never re-renders on a timer.

const now = ref(Date.now())
const clock = readonly(now)
let timer = 0
let users = 0

function tick() {
  now.value = Date.now()
}

function hold(on) {
  users = Math.max(0, users + (on ? 1 : -1))
  if (users > 0 && !timer) {
    tick()
    timer = setInterval(tick, 1000)
  } else if (!users && timer) {
    clearInterval(timer)
    timer = 0
  }
}

/**
 * The shared clock (epoch ms). It ticks while `active` (a ref, getter or
 * boolean) is true for at least one caller.
 */
export function useSwarmClock(active = true) {
  let holding = false
  const set = (on) => {
    if (on === holding) return
    holding = on
    hold(on)
  }
  watch(() => Boolean(toValue(active)), set, { immediate: true })
  onScopeDispose(() => set(false))
  return clock
}
