import '@/styles/globals.css'
import { geistFont, geistMonoFont, newsreaderFont } from '@/lib/fonts'

/**
 * The public site's font variables sit on a wrapper here, because `next/font`
 * classes are only known in modules and `_document` cannot apply them. They only
 * define variables, so the admin — which sets its own fonts through its MUI
 * theme — renders exactly as before.
 */
export default function App({ Component, pageProps }) {
  return (
    <div className={`${geistFont.variable} ${geistMonoFont.variable} ${newsreaderFont.variable}`}>
      <Component {...pageProps} />
    </div>
  )
}
