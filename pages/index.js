import Head from 'next/head'
import Header from '@/components/Header/header'
import SocialMediaLinks from '@/components/SocialMediaLinks/SocialMediaLinks'
import AboutMe from '@/components/AboutMe/AboutMe'
import Experience from '@/components/Experience/Experience'
import DemoProjects from '@/components/DemoProjects/DemoProjects'
import Contact from '@/components/Contact/Contact'
import MainComponent from '@/components/Home/MainComponent'
import { Box } from '@mui/material'
import Footer from '@/components/Footer/Footer'
import ContractualExperiences from '@/components/ContractualExperiences/ContractualExperiences'
import { getPageContent } from '@/lib/content'

/**
 * The home page, now static HTML generated from the database.
 *
 * Two things changed here in Phase 7, and the second matters more than the CMS
 * does.
 *
 * **The loading gate is gone.** This page used to render `<Loading />` on the
 * first paint and swap in the real content from an empty `useEffect`, which meant
 * the server-rendered HTML was 2,686 bytes of spinner — a whole portfolio that no
 * crawler could see, and a visitor on a slow connection watching a logo before
 * anything arrived. There was nothing to gain from it: the data was in the bundle
 * the entire time. Deleting it is as much the point of this phase as the
 * dashboard is. The `Loading` component itself stays, for anywhere a real wait
 * needs covering.
 *
 * **`getStaticProps` with `revalidate`.** The page is HTML at the edge, and a save
 * in the dashboard reaches it within the window without a redeploy. Step 6
 * shortens that to immediate with on-demand revalidation; the timer stays as the
 * backstop for a revalidation call that never lands.
 */
export default function Home({ content }) {
  const seo = content?.seo;

  const title = seo?.siteTitle || 'Samiul Kabir';
  const description = seo?.defaultDescription || 'Portfolio Website of Samiul Kabir';

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/images/Logo.png" />
        {seo?.canonicalUrl ? <link rel="canonical" href={seo.canonicalUrl} /> : null}
      </Head>

      <main>
        <Header />
        <SocialMediaLinks />
        <Box className='px-4 md:px-20 py-8 cursor-default'>
          <MainComponent />
          <Box className='px-4 md:px-20'>
            <AboutMe />
            <Experience />
            <ContractualExperiences />
            <DemoProjects />
            <Contact />
          </Box>
        </Box>
        <Footer />
      </main>
    </>
  )
}

/**
 * Reads the whole page from the database at build time, then again on a timer.
 *
 * Deliberately **not** wrapped in a try/catch. A build that cannot reach the
 * database should fail loudly: the alternative is deploying a portfolio that
 * renders empty, which looks like a design bug rather than a missing
 * `DATABASE_URL` and would be discovered by a visitor instead of by CI. Neon
 * suspends an idle database, so the first query in a cold build pays a wake-up
 * cost — a slow first query here is normal and not a failure.
 *
 * An *empty* database is a different case and is survivable: the queries succeed
 * and return nothing, and each section falls back to what it renders today.
 */
export async function getStaticProps() {
  const content = await getPageContent();

  return {
    props: { content },
    revalidate: 60,
  };
}
