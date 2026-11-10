'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import Breadcrumbs from '@/app/components/Breadcrumbs'

// Rechtstext bewusst nicht via t() uebersetzt, nur die Navigations-Labels -
// gleiches Muster wie app/impressum/page.tsx und FleetTracks Datenschutzseite:
// eine deutschsprachige, rechtlich verbindliche Fassung.
const h2 = 'text-base font-semibold text-zinc-900 dark:text-zinc-50'
const strong = 'text-zinc-900 dark:text-zinc-50'
const link = 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'

export default function DatenschutzPage() {
  const t = useTranslations('datenschutz')

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-900 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: t('title') }]} />

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50">{t('title')}</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Stand: November 2026</p>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-6 space-y-6 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className={h2}>1. Verantwortliche Stelle</h2>
            <p>
              Anbieter der Applikation Bürolist (buerolistapp.ch) und verantwortlich für die Bearbeitung der
              Kontodaten ist:
            </p>
            <p>
              Deerworks by Nicolas Balmer<br />
              Aegertenstrasse 24<br />
              3702 Hondrich<br />
              Schweiz<br />
              <a href="mailto:nicolas.balmer@deerworks.ch" className={link}>
                nicolas.balmer@deerworks.ch
              </a>
            </p>
            <p>
              Die Daten, die eine Firma in Bürolist über ihre Mitarbeitenden, Kunden und Projekte erfasst, bearbeiten
              wir im Auftrag dieser Firma. Für diese Daten ist die jeweilige Firma verantwortlich; Anfragen dazu
              richten Sie am besten zuerst an sie.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={h2}>2. Welche Daten wir bearbeiten</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className={strong}>Kontodaten:</strong> Vorname, Nachname, E-Mail-Adresse, verschlüsseltes
                Passwort.
              </li>
              <li>
                <strong className={strong}>Organisationsdaten:</strong> Name und Logo der Firma, Mitgliedschaften,
                Rollen und Arbeitszeitmodelle.
              </li>
              <li>
                <strong className={strong}>Kundendaten:</strong> Name, Kontakt-E-Mail, Telefonnummer und Adresse der
                Kunden, die eine Firma erfasst.
              </li>
              <li>
                <strong className={strong}>Arbeitsdaten:</strong> Projekte, Zeiteinträge (Datum, Von/Bis,
                Tätigkeit, Material, Wegzeit, Kommentar, erfassende Person), Notizen und Fotos zu Kunden oder
                Projekten.
              </li>
              <li>
                <strong className={strong}>Abwesenheiten:</strong> Datum, Dauer und Grund, zum Beispiel Ferien,
                Krankheit, Unfall oder Militär. Medizinische Angaben wie Diagnosen werden nicht erfasst.
              </li>
              <li>
                <strong className={strong}>Zahlungsdaten:</strong> werden ausschliesslich von unserem
                Zahlungsdienstleister Stripe bearbeitet (siehe Ziff. 5). Wir selbst speichern keine Kreditkarten-
                oder Kontodaten.
              </li>
              <li>
                <strong className={strong}>Technische Daten:</strong> IP-Adresse und Zeitstempel im Rahmen des
                normalen Serverbetriebs (Logs) sowie ein Push-Benachrichtigungs-Token, falls Sie Erinnerungen
                aktivieren.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className={h2}>3. Zweck der Bearbeitung</h2>
            <p>Wir bearbeiten diese Daten, um:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Bürolist bereitzustellen und zu betreiben (Vertragserfüllung),</li>
              <li>Firmen, Mitgliedschaften und Einladungen zu verwalten,</li>
              <li>Abonnemente abzurechnen,</li>
              <li>Support zu Ihrem Konto zu leisten, und</li>
              <li>optionale Erinnerungen per Push-Benachrichtigung zu versenden.</li>
            </ul>
            <p>Wir werten die Daten nicht für eigene Zwecke aus und verkaufen sie nicht.</p>
          </section>

          <section className="space-y-2">
            <h2 className={h2}>4. Rechtsgrundlage</h2>
            <p>
              Die Bearbeitung erfolgt zur Erfüllung des Nutzungsvertrags mit Ihnen bzw. Ihrer Firma. Für optionale
              Funktionen (z.B. Push-Erinnerungen) erfolgt sie gestützt auf Ihre Einwilligung, die Sie jederzeit in
              den Einstellungen widerrufen können.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={h2}>5. Weitergabe an Dritte / Auftragsbearbeiter</h2>
            <p>Wir setzen folgende Dienstleister ein, die in unserem Auftrag Daten bearbeiten:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Supabase (Datenbank, Anmeldung, Speicher für Fotos)</li>
              <li>Render (Hosting Backend)</li>
              <li>Vercel (Hosting Frontend)</li>
              <li>Stripe (Zahlungsabwicklung)</li>
            </ul>
            <p>
              Diese Anbieter können Daten auch ausserhalb der Schweiz (z.B. in der EU oder den USA) bearbeiten. Wir
              verlassen uns dabei auf die Datenschutzgarantien und Standardvertragsklauseln der jeweiligen Anbieter.
              Eine Weitergabe an weitere Dritte erfolgt nicht, ausser wir sind gesetzlich dazu verpflichtet.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={h2}>6. Aufbewahrungsdauer</h2>
            <p>
              Wir bewahren die Daten so lange auf, wie Ihr Konto bzw. Ihre Firma besteht. Nach Kündigung bzw.
              Löschung werden die Daten innert angemessener Frist gelöscht, soweit keine gesetzlichen
              Aufbewahrungspflichten entgegenstehen.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={h2}>7. Ihre Rechte</h2>
            <p>
              Sie haben im Rahmen des Schweizer Datenschutzgesetzes das Recht auf Auskunft, Berichtigung, Löschung
              und Herausgabe Ihrer Daten (Datenportabilität). Kontaktieren Sie uns dazu unter der oben genannten
              E-Mail-Adresse. Geht es um Daten, die Ihre Firma erfasst hat, leiten wir Ihre Anfrage an sie weiter.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={h2}>8. Datensicherheit</h2>
            <p>
              Wir setzen angemessene technische und organisatorische Massnahmen ein, um die Daten vor unbefugtem
              Zugriff zu schützen, unter anderem verschlüsselte Übertragung und rollenbasierte Zugriffsrechte
              innerhalb Ihrer Firma.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={h2}>9. Cookies und lokale Speicherung</h2>
            <p>
              Bürolist verwendet keine Marketing- oder Tracking-Cookies. Für die Anmeldung wird ein technisch
              notwendiges Sitzungs-Token in Ihrem Browser gespeichert, das für den Betrieb der App zwingend
              erforderlich ist.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={h2}>10. Änderungen dieser Erklärung</h2>
            <p>
              Wir können diese Datenschutzerklärung bei Bedarf anpassen, z.B. bei Änderungen der App oder der
              Rechtslage. Massgebend ist jeweils die unter dieser Adresse abrufbare aktuelle Fassung.
            </p>
          </section>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Siehe auch:{' '}
          <Link href="/impressum" className={link}>
            Impressum
          </Link>
        </p>

        <Link href="/" className={`inline-block text-sm font-medium ${link}`}>
          &larr; {t('backToApp')}
        </Link>
      </div>
    </div>
  )
}
