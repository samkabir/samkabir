import Image from 'next/image'
import ExperienceList from '@/components/site/ExperienceList'
import Reveal from '@/components/site/Reveal'
import { PageHeader, SectionHeader } from '@/components/site/Section'
import SiteHead from '@/components/site/SiteHead'
import SiteLayout from '@/components/site/SiteLayout'
import Stats from '@/components/site/Stats'
import { getPageContent } from '@/lib/content'

/**
 * `/about` — the long version: the bio, every role (permanent and contract, each
 * under its own `SectionCopy` heading), education and the full skill set.
 *
 * Skills are grouped by their dashboard `category` when any are set; with none
 * set there is a single group and it renders as one list without a heading.
 */
const ACCENT = 'text-ss-fg font-medium'

/**
 * One education row, word for word as the site has always printed it. A degree
 * with a subject reads "… in {field} from {institution}"; a qualification without
 * one reads "… {degree} under {institution}" — the branch is on `field`.
 */
function EducationLine({ row }) {
  if (row.field) {
    return (
      <>
        Completed {row.note ? `${row.note}, ` : ''}{row.degree ? `${row.degree} ` : ''}in{' '}
        <span className={ACCENT}>{row.field}</span> from{' '}
        <span className={ACCENT}>{row.institution}</span>.
      </>
    )
  }

  return (
    <>
      Completed <span className={ACCENT}>{row.degree}</span> under {row.institution}
      {row.note ? ` ${row.note}` : ''}.
    </>
  )
}

export default function About({ content }) {
  const {
    profile,
    seo,
    sections = {},
    skills = [],
    skillGroups = [],
    education = [],
    experiences = [],
    contractualExperiences = [],
    projects = [],
  } = content ?? {}

  const about = sections.about
  const avatar = profile?.avatar

  return (
    <SiteLayout chrome={content} projects={projects}>
      <SiteHead seo={seo} title={about?.navLabel || 'About'} description={profile?.bio || undefined} path="/about" />

      <PageHeader
        label={about?.navLabel || 'About'}
        heading={about?.heading || 'About'}
        aside={
          avatar ? (
            <Image
              src={avatar.url}
              alt={avatar.alt || profile?.fullName || 'Portrait'}
              width={avatar.width ?? 320}
              height={avatar.height ?? 320}
              priority
              sizes="200px"
              className="w-40 sm:w-52 h-auto rounded-2xl ring-1 ring-[color:var(--ss-line)] shadow-[var(--ss-shadow-lg)] rotate-[2deg] transition-transform duration-500 hover:rotate-0"
            />
          ) : null
        }
      >
        {profile?.bio ? <p>{profile.bio}</p> : null}
      </PageHeader>

      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <Stats
          projects={projects.length}
          roles={experiences.length + contractualExperiences.length}
          skills={skills.length}
          profile={profile}
          className="ss-in"
        />
      </div>

      {experiences.length ? (
        <section id="experience" className="mx-auto max-w-5xl px-5 sm:px-8 pt-24 sm:pt-28" aria-labelledby="about-exp">
          <SectionHeader
            id="about-exp"
            label={sections.experience?.navLabel || 'Experience'}
            heading={sections.experience?.heading || 'Experience'}
          />
          <ExperienceList experiences={experiences} />
        </section>
      ) : null}

      {contractualExperiences.length ? (
        <section id={sections.contractual?.anchor || 'contract'} className="mx-auto max-w-5xl px-5 sm:px-8 pt-20 sm:pt-24" aria-labelledby="about-contract">
          <SectionHeader
            id="about-contract"
            label="Contract"
            heading={sections.contractual?.heading || 'Contract work'}
          />
          <ExperienceList experiences={contractualExperiences} />
        </section>
      ) : null}

      <div className="mx-auto max-w-5xl px-5 sm:px-8 pt-24 sm:pt-28 grid gap-16 lg:gap-12 lg:grid-cols-2">
        {education.length ? (
          <section aria-labelledby="about-edu">
            <SectionHeader id="about-edu" label="Education" heading="Education" />
            <ol>
              {education.map((row, i) => (
                <Reveal as="li" key={row.id} delay={i * 60} className="grid gap-1 border-t border-ss-line py-5 last:border-b">
                  {row.years ? <span className="ss-mono text-ss-faint">{row.years}</span> : null}
                  <p className="text-[15px] leading-relaxed text-ss-muted">
                    <EducationLine row={row} />
                  </p>
                </Reveal>
              ))}
            </ol>
          </section>
        ) : null}

        {skills.length ? (
          <section aria-labelledby="about-skills">
            <SectionHeader
              id="about-skills"
              label={sections.skills?.navLabel || 'Skills'}
              heading={sections.skills?.heading || 'Skills'}
            />
            <div className="space-y-6">
              {skillGroups.map((group, g) => (
                <Reveal key={group.category || 'all'} delay={g * 60}>
                  {group.category && skillGroups.length > 1 ? (
                    <p className="ss-mono text-ss-faint mb-2.5">{group.category}</p>
                  ) : null}
                  <ul className="flex flex-wrap gap-1.5">
                    {group.skills.map((skill) => (
                      <li key={skill} className="ss-chip">{skill}</li>
                    ))}
                  </ul>
                </Reveal>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <div className="h-8 sm:h-12" />
    </SiteLayout>
  )
}

export async function getStaticProps() {
  const content = await getPageContent()
  return { props: { content }, revalidate: 60 }
}
