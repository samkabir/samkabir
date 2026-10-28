import '@/styles/globals.css'
import { displayFont, interFont, monoFont, serifFont } from '@/lib/fonts'

/**
 * The font variables sit on a wrapper rather than on `<html>`: `next/font`
 * classes are only known here, and `_document` cannot import them. They only
 * define variables, so the admin (which has its own MUI theme) is unaffected.
 */
export default function App({ Component, pageProps }) {
  return (
    <div className={`${interFont.variable} ${monoFont.variable} ${displayFont.variable} ${serifFont.variable}`}>
      <Component {...pageProps} />
    </div>
  )
}
