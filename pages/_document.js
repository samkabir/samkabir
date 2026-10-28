import { Html, Head, Main, NextScript } from 'next/document'

/**
 * The inline script marks the document as having JavaScript before first paint.
 * Scroll-reveal styles only hide content under `.js`, so a crawler or a visitor
 * with scripts off still gets every section, fully visible.
 */
export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <script
          dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
