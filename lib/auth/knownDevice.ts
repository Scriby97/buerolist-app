import { useSyncExternalStore } from 'react'

/**
 * Merkt sich pro Browser, dass hier schon einmal jemand angemeldet war. Die
 * Login-Seite zeigt Neulingen (noch nie angemeldet) den Weg zur Registrierung
 * deutlicher an - ob der Browser die E-Mail automatisch ausfuellt, laesst sich
 * nicht zuverlaessig erkennen.
 */
const KNOWN_DEVICE_KEY = 'buerolist:hasSignedIn'

export function markDeviceKnown() {
  try {
    window.localStorage.setItem(KNOWN_DEVICE_KEY, '1')
  } catch {
    // localStorage nicht verfuegbar - dann sieht man den Hinweis eben weiterhin
  }
}

function readKnownDevice() {
  try {
    return window.localStorage.getItem(KNOWN_DEVICE_KEY) === '1'
  } catch {
    return false
  }
}

const subscribe = () => () => {}

/** Auf dem Server/beim Hydrieren "bekannt", damit wiederkehrende Nutzer keinen Hinweis aufblitzen sehen. */
export function useIsKnownDevice() {
  return useSyncExternalStore(subscribe, readKnownDevice, () => true)
}
