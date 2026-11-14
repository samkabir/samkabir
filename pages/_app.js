import '@/styles/globals.css'
import { useRouter } from 'next/router'
import Shell from '@/components/site/Shell'
import { instrumentSerifFont, interTightFont, jetbrainsMonoFont } from '@/lib/fonts'

const FONTS = `${interTightFont.variable} ${instrumentSerifFont.variable} ${jetbrainsMonoFont.variable}`

/**
 * The public site's font variables sit on a wrapper here, because `next/font`
 * classes are only known in modules and `_document` cannot apply them. They only
 * define variables, so the admin — which sets its own fonts through its MUI
 * theme — renders exactly as before.
 *
 * Public pages are wrapped in `Shell`, which lives here rather than in each page
 * because it has to outlast a route change: smooth scrolling, the page-transition
 * curtain and the cursor carry over from one page to the next. The admin is left
 * without it.
 */
export default function App({ Component, pageProps }) {
  const { pathname } = useRouter()
  const page = <Component {...pageProps} />

  return <div className={FONTS}>{pathname.startsWith('/admin') ? page : <Shell>{page}</Shell>}</div>
}
