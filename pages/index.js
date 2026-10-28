import { motion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import DotField from '@/components/site/DotField'
import ExperienceList from '@/components/site/ExperienceList'
import Marquee from '@/components/site/Marquee'
import SiteHead from '@/components/site/SiteHead'
import SiteLayout from '@/components/site/SiteLayout'
import Stats from '@/components/site/Stats'
import WorkRail from '@/components/site/WorkRail'
import { EASE_OUT } from '@/components/site/ease'
import * as Icon from '@/components/site/icons'
import { Eyebrow, Magnetic, Reveal, Roll, ScrollText, SplitText } from '@/components/site/motion'
import { TLink, useShell } from '@/components/site/Shell'
import { formatDay } from '@/lib/adminFormat'
import { getPageContent, getPublishedPosts } from '@/lib/content'

/**
 * The home page, built to be scrolled: the headline rises in as the page is
 * uncovered, the hero sinks and fades as you leave it, the bio lights up a word
 * at a time, the selected work slides past sideways, and the toolbox runs as a
 * ribbon that answers the scroll's speed.
 *
 * Statically generated and revalidated on every dashboard save
 * (`lib/revalidate.js`), with `revalidate: 60` as the backstop. The build is
 * deliberately not wrapped in a try/catch: a build that cannot reach the
 * database should fail loudly rather than deploy an empty portfolio.
 */

/** Featured projects, or the first three when none is flagged yet. */
function featuredProjects(projects) {
  const flagged = projects.filter((project) => project.isFeatured)
  return flagged.length ? flagged : projects.slice(0, 3)
}

function Hero({ profile, currentRole, hasResume }) {
  const ref = useRef(null)
  const { ready } = useShell()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const textY = useTransform(scrollYProgress, [0, 1], ['0%', '35%'])
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0])
  const fieldY = useTransform(scrollYProgress, [0, 1], ['0%', '18%'])

  const headline = profile?.headline || ''
  const words = headline.split(/\s+/).filter(Boolean)
  // The closing words are set in the italic serif — two for a full sentence,
  // one for a short one.
  const accentFrom = words.length > 4 ? words.length - 2 : words.length - 1

  const appear = (delay) => ({
    initial: { opacity: 0, y: 24 },
    animate: ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 },
    transition: { duration: 1, ease: EASE_OUT, delay },
  })

  return (
    <section ref={ref} className="relative min-h-[100svh] flex flex-col justify-end overflow-hidden">
      <motion.div aria-hidden="true" className="absolute inset-0" style={{ y: fieldY }}>
        <DotField />
      </motion.div>

      <motion.div style={{ y: textY, opacity: fade }} className="relative mx-auto w-full max-w-[1440px] px-5 sm:px-8 pb-10 sm:pb-14 pt-32">
        {currentRole ? (
          <motion.p {...appear(0.1)} className="mo-label flex flex-wrap items-center gap-x-3 gap-y-1 text-mo-muted">
            <span className="mo-pulse" aria-hidden="true" />
            <span>Currently</span>
            <span className="text-mo-fg">{currentRole.jobPosition}</span>
            <span className="text-mo-faint">at {currentRole.companyName}</span>
          </motion.p>
        ) : null}

        {headline ? (
          <SplitText
            as="h1"
            text={headline}
            accentFrom={accentFrom}
            accentClass="mo-serif text-mo-accent-ink !tracking-[-0.02em]"
            delay={0.15}
            stagger={0.07}
            className="mt-6 block mo-display text-[clamp(52px,9.6vw,168px)] max-w-[15ch]"
          />
        ) : null}

        <div className="mt-10 sm:mt-14 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <motion.div {...appear(0.7)} className="flex flex-wrap items-center gap-3">
            <Magnetic>
              <TLink href="/work" label="Work" className="mo-btn mo-btn--solid">
                <Roll>Selected work</Roll>
                <Icon.ArrowRight className="mo-arrow w-4 h-4" />
              </TLink>
            </Magnetic>
            <Magnetic>
              <TLink href="#contact" className="mo-btn mo-btn--ghost">
                <Roll>Get in touch</Roll>
              </TLink>
            </Magnetic>
            {hasResume ? (
              <a href="/cv" target="_blank" rel="noreferrer" className="group inline-flex items-center gap-1.5 px-3 text-[15px] font-medium text-mo-muted hover:text-mo-fg transition-colors">
                <span className="mo-link">Résumé</span>
                <Icon.ArrowUpRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            ) : null}
          </motion.div>

          <motion.div {...appear(0.85)} className="hidden sm:flex items-center gap-3 mo-label text-mo-faint">
            <span>Scroll</span>
            <span className="relative block w-px h-12 overflow-hidden bg-mo-line">
              <motion.span
                className="absolute inset-x-0 top-0 h-1/2 bg-mo-fg"
                animate={{ y: ['-100%', '200%'] }}
                transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity }}
              />
            </span>
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}

function Intro({ profile, sections, counts }) {
  const about = sections.about
  if (!profile?.bio) return null

  return (
    <section aria-labelledby="home-about" className="mx-auto max-w-[1440px] px-5 sm:px-8 pt-28 sm:pt-40">
      <div className="grid gap-10 lg:grid-cols-[1fr_3fr]">
        <div>
          <Eyebrow index="01">{about?.navLabel || 'About'}</Eyebrow>
          <h2 id="home-about" className="sr-only">{about?.heading || 'About'}</h2>
        </div>
        <div>
          <ScrollText text={profile.bio} className="text-[clamp(26px,3.3vw,50px)] leading-[1.15] tracking-[-0.03em] font-medium" />
          <Reveal className="mt-10">
            <TLink href="/about" label="About" className="group inline-flex items-center gap-3 text-[16px] font-medium">
              <span className="grid place-items-center w-11 h-11 rounded-full bg-mo-fg text-mo-bg transition-transform duration-500 group-hover:rotate-[-45deg]">
                <Icon.ArrowRight className="w-4 h-4" />
              </span>
              <span className="mo-link">More about me</span>
            </TLink>
          </Reveal>
        </div>
      </div>

      <Stats {...counts} className="mt-20 sm:mt-28" />
    </section>
  )
}

function Writing({ posts }) {
  if (!posts.length) return null

  return (
    <section aria-labelledby="home-writing" className="mx-auto max-w-[1440px] px-5 sm:px-8 pt-28 sm:pt-40">
      <div className="flex items-end justify-between gap-6 mb-10">
        <div>
          <Eyebrow index="04">Writing</Eyebrow>
          <h2 id="home-writing" className="mt-5 mo-display text-[clamp(40px,5.4vw,84px)]">
            <SplitText text="Latest notes" />
          </h2>
        </div>
        <TLink href="/blog" label="Writing" className="hidden sm:inline-flex mo-btn mo-btn--ghost mo-btn--sm">
          All posts
          <Icon.ArrowRight className="mo-arrow w-4 h-4" />
        </TLink>
      </div>
      <ul className="border-b border-mo-line">
        {posts.map((post, i) => (
          <Reveal as="li" key={post.id} delay={i * 0.08} className="border-t border-mo-line">
            <TLink href={`/blog/${post.slug}`} label="Writing" className="group mo-row grid gap-2 sm:grid-cols-[160px_1fr_auto] sm:items-center sm:gap-8 py-8 px-2 sm:px-4">
              <span className="mo-label text-mo-faint">
                {post.publishedAt ? <time dateTime={post.publishedAt}>{formatDay(post.publishedAt)}</time> : null}
              </span>
              <span>
                <span className="block text-[clamp(22px,2.4vw,32px)] font-medium tracking-[-0.03em] leading-tight transition-transform duration-500 group-hover:translate-x-2">
                  {post.title}
                </span>
                {post.excerpt ? <span className="mt-2 block text-[15px] text-mo-muted line-clamp-2 max-w-2xl">{post.excerpt}</span> : null}
              </span>
              <span className="hidden sm:grid place-items-center w-12 h-12 rounded-full border border-mo-line transition-all duration-500 group-hover:bg-mo-accent group-hover:border-transparent group-hover:text-white group-hover:-rotate-45">
                <Icon.ArrowRight className="w-4 h-4" />
              </span>
            </TLink>
          </Reveal>
        ))}
      </ul>
    </section>
  )
}

export default function Home({ content, posts }) {
  const {
    profile,
    seo,
    sections = {},
    skills = [],
    experiences = [],
    contractualExperiences = [],
    projects = [],
    hasResume = false,
  } = content ?? {}

  const featured = featuredProjects(projects)
  const currentRole = experiences.find((e) => e.isCurrent) ?? null
  const counts = {
    projects: projects.length,
    roles: experiences.length + contractualExperiences.length,
    skills: skills.length,
    profile,
  }

  return (
    <SiteLayout chrome={content}>
      <SiteHead seo={seo} />

      <Hero profile={profile} currentRole={currentRole} hasResume={hasResume} />
      <Intro profile={profile} sections={sections} counts={counts} />

      <div className="pt-16 sm:pt-24">
        <WorkRail projects={featured} total={projects.length} section={sections.projects} />
      </div>

      {experiences.length ? (
        <section aria-labelledby="home-exp" className="mx-auto max-w-[1440px] px-5 sm:px-8 pt-28 sm:pt-32 grid gap-12 lg:grid-cols-[1fr_2.2fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Eyebrow index="03">{sections.experience?.navLabel || 'Experience'}</Eyebrow>
            <h2 id="home-exp" className="mt-5 mo-display text-[clamp(40px,5vw,76px)]">
              <SplitText text={sections.experience?.heading || 'Experience'} />
            </h2>
            <Reveal className="mt-8">
              <TLink href="/about#experience" label="About" className="mo-btn mo-btn--ghost mo-btn--sm">
                Full history
                <Icon.ArrowRight className="mo-arrow w-4 h-4" />
              </TLink>
            </Reveal>
          </div>
          <ExperienceList experiences={experiences.slice(0, 4)} />
        </section>
      ) : null}

      <div className="pt-24 sm:pt-32">
        <Marquee items={skills} label={sections.skills?.heading || 'Skills'} />
      </div>

      <Writing posts={posts} />
    </SiteLayout>
  )
}

export async function getStaticProps() {
  const [content, { posts }] = await Promise.all([getPageContent(), getPublishedPosts({ take: 3 })])

  return {
    props: { content, posts },
    revalidate: 60,
  }
}
