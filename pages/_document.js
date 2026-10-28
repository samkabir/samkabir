import { Html, Head, Main, NextScript } from 'next/document'

/**
 * Runs before first paint, so the page never flashes the wrong theme or
 * un-hidden scroll-reveal content.
 *
 *   * `data-theme` — the visitor's saved choice, else their system preference.
 *     Only the public site (`.ss` in globals.css) reads it; the admin ignores it.
 *   * `.js` — marks that scripts run, for styles that only make sense with them.
 *   * `data-preload` — the intro counter (`components/site/Preloader.js`) plays
 *     once per browser session, on the first public page, and never for a
 *     visitor who prefers reduced motion. Deciding here, before paint, is what
 *     stops the page flashing before the preloader covers it.
 *
 * A constant string, not user input, so `dangerouslySetInnerHTML` carries nothing
 * from the database.
 */
const BOOT = `(function(){var d=document.documentElement;d.classList.add('js');var t;try{t=localStorage.getItem('theme')}catch(e){}if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}d.dataset.theme=t;try{if(location.pathname.indexOf('/admin')!==0&&!sessionStorage.getItem('mo:seen')&&!matchMedia('(prefers-reduced-motion: reduce)').matches)d.dataset.preload=''}catch(e){}})()`

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
