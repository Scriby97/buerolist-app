import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import de from '../messages/de.json'

// Rendert mit den ECHTEN deutschen Uebersetzungen - so schlaegt ein Test auch
// fehl, wenn ein im Code verwendeter Uebersetzungsschluessel fehlt.
const withIntl = (ui: ReactElement) => (
  <NextIntlClientProvider locale="de" messages={de} timeZone="Europe/Zurich">
    {ui}
  </NextIntlClientProvider>
)

export function renderWithIntl(ui: ReactElement) {
  const result = render(withIntl(ui))
  return {
    ...result,
    // rerender muss den Provider wieder mitgeben, sonst faellt der Kontext weg.
    rerender: (next: ReactElement) => result.rerender(withIntl(next)),
  }
}
