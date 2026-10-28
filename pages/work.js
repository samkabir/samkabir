import { useMemo, useState } from 'react'
import ProjectCard from '@/components/site/ProjectCard'
import Reveal from '@/components/site/Reveal'
import { PageHeader } from '@/components/site/Section'
import SiteHead from '@/components/site/SiteHead'
import SiteLayout from '@/components/site/SiteLayout'
import { getPageContent } from '@/lib/content'

/**
 * `/work` — every published project, filterable by technology.
 *
 * The filters are built from the projects' own `stacks`: any technology used on
 * at least two projects becomes a chip, most-used first, so the list grows with
 * the dashboard and never offers a filter that would show a single card.
 * Filtering is client-side over props the page already has; there is one static
 * page, not one per stack.
 *
 * Featured projects lead, in dashboard order, then the rest — the same order the
 * dashboard shows within each group.
 */
const MIN_FOR_FILTER = 2
const MAX_FILTERS = 10

const norm = (stack) => stack.trim().toLowerCase()

/**
 * Stacks are free text in the dashboard, so "Tailwind" and "tailwind" are the
 * same technology spelled twice. Filters group case-insensitively and show the
 * most common spelling. Returns `[key, label, count]`.
 */
function stackFilters(projects) {
  const groups = new Map()
  projects.forEach((project) =>
    new Set(project.stacks?.map(norm)).forEach((key) => {
      const group = groups.get(key) || { count: 0, spellings: new Map() }
      group.count += 1
      const spelling = project.stacks.find((stack) => norm(stack) === key)
      group.spellings.set(spelling, (group.spellings.get(spelling) || 0) + 1)
      groups.set(key, group)
    }),
  )
  return [...groups]
    .filter(([, group]) => group.count >= MIN_FOR_FILTER)
    .map(([key, group]) => [key, [...group.spellings].sort((a, b) => b[1] - a[1])[0][0], group.count])
    .sort((a, b) => b[2] - a[2] || a[1].localeCompare(b[1]))
    .slice(0, MAX_FILTERS)
}

export default function Work({ content }) {
  const { seo, sections = {}, projects = [] } = content ?? {}
  const [filter, setFilter] = useState(null)

  const ordered = useMemo(
    () => [...projects.filter((p) => p.isFeatured), ...projects.filter((p) => !p.isFeatured)],
    [projects],
  )
  const filters = useMemo(() => stackFilters(projects), [projects])
  const visible = filter ? ordered.filter((project) => project.stacks?.some((stack) => norm(stack) === filter)) : ordered
  const filterLabel = filters.find(([key]) => key === filter)?.[1] ?? filter

  const section = sections.projects
  const heading = section?.heading || 'Work'

  return (
    <SiteLayout chrome={content} projects={projects}>
      <SiteHead seo={seo} title={section?.navLabel || 'Work'} description={section?.subheading || undefined} path="/work" />

      <PageHeader label={section?.navLabel || 'Work'} heading={heading}>
        {section?.subheading ? <p>{section.subheading}</p> : <p>{projects.length} projects, featured work first.</p>}
      </PageHeader>

      <section className="mx-auto max-w-5xl px-5 sm:px-8" aria-label="Projects">
        {filters.length ? (
          <div className="ss-in flex flex-wrap gap-1.5 mb-8" role="group" aria-label="Filter by technology" style={{ '--d': '240ms' }}>
            <button type="button" className="ss-chip" aria-pressed={filter === null} onClick={() => setFilter(null)}>
              All <span className="ml-1.5 opacity-60">{projects.length}</span>
            </button>
            {filters.map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                className="ss-chip"
                aria-pressed={filter === key}
                onClick={() => setFilter(filter === key ? null : key)}
              >
                {label} <span className="ml-1.5 opacity-60">{count}</span>
              </button>
            ))}
          </div>
        ) : null}

        <p className="sr-only" aria-live="polite">
          {filter ? `${visible.length} projects using ${filterLabel}` : `${visible.length} projects`}
        </p>

        {/* Keyed on the filter so the cards settle in again on each change. */}
        <ul key={filter || 'all'} className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((project, i) => (
            <Reveal as="li" key={project.id} delay={(i % 3) * 70}>
              <ProjectCard project={project} priority={i < 3} />
            </Reveal>
          ))}
        </ul>
      </section>

      <div className="h-8 sm:h-12" />
    </SiteLayout>
  )
}

export async function getStaticProps() {
  const content = await getPageContent()
  return { props: { content }, revalidate: 60 }
}
