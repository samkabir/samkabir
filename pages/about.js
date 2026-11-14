import { motion } from 'motion/react'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import ExperienceList from '@/components/site/ExperienceList'
import PageHeader from '@/components/site/PageHeader'
import SiteHead from '@/components/site/SiteHead'
import SiteLayout from '@/components/site/SiteLayout'
import Stats from '@/components/site/Stats'
import { EASE_OUT } from '@/components/site/ease'
import { Eyebrow, Reveal, SplitText, useEntrance } from '@/components/site/motion'
import { getPageContent } from '@/lib/content'

/**
 * `/about` — the long version: the bio, every role (permanent and contract, each
 * under its own `SectionCopy` heading), education and the full skill set.
 *
 * Skills are grouped by their dashboard `category` when any are set; with none
 * set there is a single group and it renders as one list without a heading. The
 * chips can be picked up and thrown — they spring back to their places.
 */
const ACCENT = 'text-mo-fg font-medium'

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

function SectionTitle({ index, label, heading, id }) {
  return (
    <div className="mb-10 sm:mb-14">
      <Eyebrow index={index}>{label}</Eyebrow>
      <h2 id={id} className="mt-5 mo-display text-[clamp(40px,5.4vw,84px)]">
        <SplitText text={heading} />
      </h2>
    </div>
  )
}

function SkillCloud({ groups }) {
  const ref = useRef(null)
  const show = useEntrance(ref, { amount: 0.3 })
  // Dragging is for a mouse: on a touch screen it would trap the page's scroll.
  const [canDrag, setCanDrag] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setCanDrag(window.matchMedia('(hover: hover) and (pointer: fine)').matches))
    return () => cancelAnimationFrame(frame)
  }, [])
  // Where each group starts in the whole list, so the stagger runs across groups.
  const starts = groups.map((_, g) => groups.slice(0, g).reduce((n, group) => n + group.skills.length, 0))

  return (
    <div ref={ref} className="space-y-8">
      {groups.map((group, g) => {
        const start = starts[g]
        return (
          <div key={group.category || 'all'}>
            {group.category && groups.length > 1 ? <p className="mo-label text-mo-faint mb-3">{group.category}</p> : null}
            <ul className="flex flex-wrap gap-2">
              {group.skills.map((skill, i) => (
                <motion.li
                  key={skill}
                  initial={{ opacity: 0, y: 30, scale: 0.8 }}
                  animate={show ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 30, scale: 0.8 }}
                  transition={{ duration: 0.7, ease: EASE_OUT, delay: (start + i) * 0.03 }}
                  className="relative hover:z-10"
                >
                  <motion.div
                    drag={canDrag}
                    dragSnapToOrigin
                    dragElastic={0.6}
                    dragTransition={{ bounceStiffness: 300, bounceDamping: 14 }}
                    whileHover={{ y: -4, rotate: (start + i) % 2 ? 2 : -2 }}
                    whileDrag={{ scale: 1.12, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    className="sm:cursor-grab sm:active:cursor-grabbing select-none rounded-full bg-mo-elev px-5 h-12 flex items-center text-[16px] font-medium shadow-[0_0_0_1px_var(--mo-line)] hover:shadow-[0_0_0_1px_var(--mo-fg)]"
                  >
                    {skill}
                  </motion.div>
                </motion.li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
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
    <SiteLayout chrome={content}>
      <SiteHead seo={seo} title={about?.navLabel || 'About'} description={profile?.bio || undefined} path="/about" />

      <PageHeader title={about?.navLabel || 'About'} lede={profile?.bio}>
        {avatar ? (
          <Reveal className="mt-12">
            <Image
              src={avatar.url}
              alt={avatar.alt || profile?.fullName || 'Portrait'}
              width={avatar.width ?? 320}
              height={avatar.height ?? 320}
              priority
              sizes="240px"
              className="w-48 sm:w-60 h-auto rounded-[28px]"
            />
          </Reveal>
        ) : null}
      </PageHeader>

      <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
        <Stats
          projects={projects.length}
          roles={experiences.length + contractualExperiences.length}
          skills={skills.length}
          profile={profile}
        />
      </div>

      {experiences.length ? (
        <section id="experience" aria-labelledby="about-exp" className="mx-auto max-w-[1440px] px-5 sm:px-8 pt-28 sm:pt-36 scroll-mt-24">
          <SectionTitle
            id="about-exp"
            index="01"
            label={sections.experience?.navLabel || 'Experience'}
            heading={sections.experience?.heading || 'Experience'}
          />
          <ExperienceList experiences={experiences} />
        </section>
      ) : null}

      {contractualExperiences.length ? (
        <section id={sections.contractual?.anchor || 'contract'} aria-labelledby="about-contract" className="mx-auto max-w-[1440px] px-5 sm:px-8 pt-28 sm:pt-36">
          <SectionTitle id="about-contract" index="02" label="Contract" heading={sections.contractual?.heading || 'Contract work'} />
          <ExperienceList experiences={contractualExperiences} />
        </section>
      ) : null}

      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 pt-28 sm:pt-36 grid gap-24 lg:gap-16 lg:grid-cols-[1fr_1.3fr]">
        {education.length ? (
          <section aria-labelledby="about-edu">
            <SectionTitle id="about-edu" index="03" label="Education" heading="Education" />
            <ol className="border-b border-mo-line">
              {education.map((row, i) => (
                <Reveal as="li" key={row.id} delay={i * 0.08} className="grid gap-2 border-t border-mo-line py-6">
                  {row.years ? <span className="mo-label text-mo-faint">{row.years}</span> : null}
                  <p className="text-[18px] leading-relaxed text-mo-muted">
                    <EducationLine row={row} />
                  </p>
                </Reveal>
              ))}
            </ol>
          </section>
        ) : null}

        {skills.length ? (
          <section aria-labelledby="about-skills">
            <SectionTitle
              id="about-skills"
              index="04"
              label={sections.skills?.navLabel || 'Skills'}
              heading={sections.skills?.heading || 'Skills'}
            />
            <SkillCloud groups={skillGroups} />
            <p className="mt-6 mo-label text-mo-faint hidden sm:block">Go on — drag them around.</p>
          </section>
        ) : null}
      </div>
    </SiteLayout>
  )
}

export async function getStaticProps() {
  const content = await getPageContent()
  return { props: { content }, revalidate: 60 }
}
