import { Html, Head, Main, NextScript } from 'next/document'

/**
 * Runs before first paint, so the page never flashes the wrong theme or
 * un-hidden scroll-reveal content.
 *
 *   * `data-theme` — the visitor's saved choice, else their system preference.
 *     Only the public site (`.ss` in globals.css) reads it; the admin ignores it.
 *   * `.js` — scroll-reveal styles hide content only under this class, so a
 *     crawler or a visitor without scripts sees every section.
 *
 * A constant string, not user input, so `dangerouslySetInnerHTML` carries nothing
 * from the database.
 */
const BOOT = `(function(){var d=document.documentElement;d.classList.add('js');var t;try{t=localStorage.getItem('theme')}catch(e){}if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}d.dataset.theme=t})()`

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
