import Image from 'next/image'
import Link from 'next/link'
import ExperienceList from '@/components/site/ExperienceList'
import ProjectCard from '@/components/site/ProjectCard'
import Reveal from '@/components/site/Reveal'
import { SectionHeader } from '@/components/site/Section'
import SiteHead from '@/components/site/SiteHead'
import SiteLayout from '@/components/site/SiteLayout'
import Stats from '@/components/site/Stats'
import { openPalette } from '@/components/site/CommandPalette'
import * as Icon from '@/components/site/icons'
import { formatDay } from '@/lib/adminFormat'
import { getPageContent, getPublishedPosts } from '@/lib/content'

/**
 * The home page: a short introduction and a sample of everything else — a few
 * featured projects, the most recent roles, the latest writing — each with a way
 * through to its own page. The contact block closes every page (see
 * `SiteLayout`), so it is not repeated here.
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
  const avatar = profile?.avatar

  return (
    <section className="relative">
      <div aria-hidden="true" className="ss-dots absolute inset-x-0 -top-16 h-[520px] pointer-events-none" />
      <div className="relative mx-auto max-w-5xl px-5 sm:px-8 pt-16 sm:pt-28 pb-16 sm:pb-20">
        <div className="ss-in flex items-center gap-3" style={{ '--d': '0ms' }}>
          {avatar ? (
            <Image
              src={avatar.url}
              alt={avatar.alt || profile?.fullName || ''}
              width={44}
              height={44}
              priority
              className="w-11 h-11 rounded-full object-cover ring-1 ring-[color:var(--ss-line)]"
            />
          ) : null}
          <div className="text-[14px] leading-snug">
            <p className="font-medium text-ss-fg">{profile?.fullName}</p>
            {currentRole ? (
              <p className="flex items-center gap-2 text-ss-muted">
                <span className="ss-pulse" aria-hidden="true" />
                {currentRole.jobPosition} at {currentRole.companyName}
              </p>
            ) : null}
          </div>
        </div>

        {profile?.headline ? (
          <h1
            className="ss-in ss-serif mt-10 max-w-3xl text-[44px] leading-[1.04] sm:text-[68px] sm:leading-[1] text-ss-fg"
            style={{ '--d': '90ms' }}
          >
            {profile.headline}
          </h1>
        ) : null}

        {profile?.bio ? (
          <p className="ss-in mt-7 max-w-2xl text-[17px] sm:text-[18px] leading-relaxed text-ss-muted" style={{ '--d': '180ms' }}>
            {profile.bio}
          </p>
        ) : null}

        <div className="ss-in mt-9 flex flex-wrap items-center gap-2.5" style={{ '--d': '270ms' }}>
          <Link href="/work" className="ss-btn ss-btn--solid">
            View work
            <Icon.ArrowRight className="ss-arrow w-4 h-4" />
          </Link>
          <a href="#contact" className="ss-btn ss-btn--ghost">Get in touch</a>
          {hasResume ? (
            <a href="/cv" target="_blank" rel="noreferrer" className="ss-btn ss-btn--ghost">
              Résumé
              <Icon.ArrowUpRight className="ss-arrow-ne w-4 h-4" />
            </a>
          ) : null}
          <button
            type="button"
            onClick={openPalette}
            className="hidden sm:inline-flex items-center gap-1.5 ml-2 text-[13px] text-ss-faint hover:text-ss-muted transition-colors"
          >
            or press <kbd className="ss-kbd">⌘</kbd><kbd className="ss-kbd">K</kbd>
          </button>
        </div>
      </div>
    </section>
  )
}

function Toolbox({ skills }) {
  if (!skills.length) return null
  const items = skills.map((skill, i) => (
    <span key={i} className="ss-mono text-[13px] text-ss-faint whitespace-nowrap">{skill}</span>
  ))

  return (
    <div className="ss-marquee py-6 border-y border-ss-line" aria-label="Technologies I work with">
      <div className="ss-marquee__track">{items}</div>
      <div className="ss-marquee__track" aria-hidden="true">{items}</div>
    </div>
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

  return (
    <SiteLayout chrome={content} projects={projects}>
      <SiteHead seo={seo} />

      <Hero profile={profile} currentRole={currentRole} hasResume={hasResume} />

      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <Stats
          projects={projects.length}
          roles={experiences.length + contractualExperiences.length}
          skills={skills.length}
          profile={profile}
          className="ss-in"
        />
      </div>

      {featured.length ? (
        <section className="mx-auto max-w-5xl px-5 sm:px-8 pt-24 sm:pt-28" aria-labelledby="home-work">
          <SectionHeader
            id="home-work"
            label={sections.projects?.navLabel || 'Work'}
            heading={sections.projects?.heading || 'Selected work'}
            action={{ href: '/work', label: `All ${projects.length} projects` }}
          />
          <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
            {featured.map((project, i) => (
              <Reveal key={project.id} delay={i ? 80 : 0} className={featured.length % 2 && i === 0 ? 'sm:col-span-2' : ''}>
                <ProjectCard project={project} wide={featured.length % 2 === 1 && i === 0} priority={i === 0} showFeatured={false} />
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      {experiences.length ? (
        <section className="mx-auto max-w-5xl px-5 sm:px-8 pt-24 sm:pt-28" aria-labelledby="home-exp">
          <SectionHeader
            id="home-exp"
            label={sections.experience?.navLabel || 'Experience'}
            heading={sections.experience?.heading || 'Experience'}
            action={{ href: '/about#experience', label: 'Full history' }}
          />
          <ExperienceList experiences={experiences.slice(0, 4)} compact />
        </section>
      ) : null}

      <div className="pt-24 sm:pt-28">
        <Toolbox skills={skills} />
      </div>

      {posts.length ? (
        <section className="mx-auto max-w-5xl px-5 sm:px-8 pt-24 sm:pt-28" aria-labelledby="home-writing">
          <SectionHeader id="home-writing" label="Writing" heading="Latest notes" action={{ href: '/blog', label: 'All posts' }} />
          <ul>
            {posts.map((post, i) => (
              <Reveal as="li" key={post.id} delay={i * 60} className="border-t border-ss-line last:border-b">
                <Link href={`/blog/${post.slug}`} className="group ss-row -mx-3 px-3 py-5 rounded-lg grid gap-1 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-8">
                  <span>
                    <span className="block text-[16px] font-medium text-ss-fg">{post.title}</span>
                    {post.excerpt ? <span className="block mt-1 text-[14px] text-ss-muted line-clamp-1">{post.excerpt}</span> : null}
                  </span>
                  <span className="ss-mono text-ss-faint flex items-center gap-2">
                    {post.publishedAt ? <time dateTime={post.publishedAt}>{formatDay(post.publishedAt)}</time> : null}
                    <Icon.ArrowRight className="ss-arrow w-3.5 h-3.5" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="h-8 sm:h-12" />
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
