import Head from 'next/head'
import Shell from '@/components/landing/Shell'
import Nav from '@/components/landing/Nav'
import Hero from '@/components/landing/Hero'
import SkillTapes from '@/components/landing/SkillTapes'
import AboutBento from '@/components/landing/AboutBento'
import ExperienceList from '@/components/landing/ExperienceList'
import Work from '@/components/landing/Work'
import ContactFooter from '@/components/landing/ContactFooter'
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
  const {
    profile,
    seo,
    sections = {},
    nav = [],
    skills = [],
    education = [],
    experiences = [],
    contractualExperiences = [],
    projects = [],
    socialLinks = { sidebar: [], contact: [] },
    hasResume = false,
  } = content ?? {};

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

      {/* The landing page has its own visual language, built in
          `components/landing`. The blog still uses `Header`/`Footer`. */}
      <Shell name={profile?.fullName}>
        <span id="top" />
        <Nav
          items={nav}
          contactHref={`#${sections.contact?.anchor || 'contact'}`}
          email={profile?.publicEmail}
          socialLinks={socialLinks.contact}
        />
        <main>
          <Hero
            profile={profile}
            hasResume={hasResume}
            workHref={`#${sections.projects?.anchor || 'project'}`}
            nextHref={`#${sections.about?.anchor || 'about'}`}
          />
          <SkillTapes skills={skills} />
          <AboutBento
            profile={profile}
            skills={skills}
            education={education}
            sections={sections}
            socialLinks={socialLinks.contact}
            hasResume={hasResume}
          />
          <ExperienceList
            experiences={experiences}
            section={sections.experience}
            idPrefix="job"
            fallback={{ anchor: 'exp', numberLabel: '01.', label: 'Experience', heading: 'Job Experiences' }}
          />
          <ExperienceList
            compact
            experiences={contractualExperiences}
            section={sections.contractual}
            idPrefix="contract"
            fallback={{ anchor: 'contract-exp', numberLabel: '01.0', label: 'Contract', heading: 'Contractual Experiences' }}
          />
          <Work projects={projects} section={sections.projects} />
          <ContactFooter section={sections.contact} profile={profile} socialLinks={socialLinks.contact} />
        </main>
      </Shell>
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
