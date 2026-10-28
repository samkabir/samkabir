import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader from '@/components/site/PageHeader'
import { ProjectCard, ProjectDialog, ProjectRows } from '@/components/site/Projects'
import SiteHead from '@/components/site/SiteHead'
import SiteLayout from '@/components/site/SiteLayout'
import { EASE_OUT } from '@/components/site/ease'
import { Reveal } from '@/components/site/motion'
import { getPageContent } from '@/lib/content'

/**
 * `/work` — every published project, filterable by technology, as a grid or a
 * list.
 *
 * The filters are built from the projects' own `stacks`: any technology used on
 * at least two projects becomes a chip, most-used first, so the list grows with
 * the dashboard and never offers a filter that would show a single card.
 * Filtering is client-side over props the page already has; there is one static
 * page, not one per stack. Cards re-flow into place when the filter changes
 * (layout animation), and the active chip's backing slides between chips.
 *
 * Opening a project shows its details in a dialog and puts its slug in the URL
 * fragment, so `/work#slug` links straight to it.
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

function Pill({ active, onClick, children, group }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative h-10 px-4 rounded-full text-[14px] font-medium whitespace-nowrap transition-colors duration-300 ${
        active ? 'text-mo-bg' : 'text-mo-muted hover:text-mo-fg'
      }`}
    >
      {active ? (
        <motion.span layoutId={`${group}-pill`} className="absolute inset-0 rounded-full bg-mo-fg" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
      ) : null}
      <span className="relative">{children}</span>
    </button>
  )
}

export default function Work({ content }) {
  const { seo, sections = {}, projects = [] } = content ?? {}
  const [filter, setFilter] = useState(null)
  const [view, setView] = useState('grid')
  const [openSlug, setOpenSlug] = useState(null)

  const ordered = useMemo(
    () => [...projects.filter((p) => p.isFeatured), ...projects.filter((p) => !p.isFeatured)],
    [projects],
  )
  const filters = useMemo(() => stackFilters(projects), [projects])
  const visible = useMemo(
    () => (filter ? ordered.filter((project) => project.stacks?.some((stack) => norm(stack) === filter)) : ordered),
    [filter, ordered],
  )
  const filterLabel = filters.find(([key]) => key === filter)?.[1] ?? filter

  const openIndex = visible.findIndex((project) => project.slug === openSlug)
  const openProject = openIndex >= 0 ? visible[openIndex] : null

  const open = useCallback((slug) => {
    setOpenSlug(slug)
    window.history.replaceState(window.history.state, '', `#${slug}`)
  }, [])
  const close = useCallback(() => {
    setOpenSlug(null)
    window.history.replaceState(window.history.state, '', window.location.pathname)
  }, [])
  const step = useCallback(
    (delta) => {
      if (!visible.length || openIndex < 0) return
      open(visible[(openIndex + delta + visible.length) % visible.length].slug)
    },
    [visible, openIndex, open],
  )

  // `/work#slug` opens that project once the page is up.
  useEffect(() => {
    const slug = decodeURIComponent(window.location.hash.slice(1))
    if (!slug || !projects.some((project) => project.slug === slug)) return undefined
    const frame = requestAnimationFrame(() => setOpenSlug(slug))
    return () => cancelAnimationFrame(frame)
  }, [projects])

  const section = sections.projects

  return (
    <SiteLayout chrome={content}>
      <SiteHead seo={seo} title={section?.navLabel || 'Work'} description={section?.heading || undefined} path="/work" />

      <PageHeader title={section?.navLabel || 'Work'} count={projects.length} lede={section?.heading} />

      <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
        <Reveal className="sticky top-20 z-30 -mx-2 mb-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <LayoutGroup id="filters">
            <div
              role="group"
              aria-label="Filter by technology"
              className="mo-noscroll flex gap-1 overflow-x-auto rounded-full bg-[color:color-mix(in_srgb,var(--mo-elev)_85%,transparent)] backdrop-blur-xl p-1 shadow-[0_0_0_1px_var(--mo-line)] max-w-full"
            >
              <Pill group="filter" active={!filter} onClick={() => setFilter(null)}>
                All <span className="opacity-60">{projects.length}</span>
              </Pill>
              {filters.map(([key, label, count]) => (
                <Pill key={key} group="filter" active={filter === key} onClick={() => setFilter(filter === key ? null : key)}>
                  {label} <span className="opacity-60">{count}</span>
                </Pill>
              ))}
            </div>
          </LayoutGroup>

          <LayoutGroup id="view">
            <div
              role="group"
              aria-label="Layout"
              className="hidden sm:flex shrink-0 gap-1 rounded-full bg-[color:color-mix(in_srgb,var(--mo-elev)_85%,transparent)] backdrop-blur-xl p-1 shadow-[0_0_0_1px_var(--mo-line)]"
            >
              <Pill group="view" active={view === 'grid'} onClick={() => setView('grid')}>Grid</Pill>
              <Pill group="view" active={view === 'list'} onClick={() => setView('list')}>List</Pill>
            </div>
          </LayoutGroup>
        </Reveal>

        <p className="sr-only" aria-live="polite">
          {filter ? `${visible.length} projects using ${filterLabel}` : `${visible.length} projects`}
        </p>

        <AnimatePresence mode="wait" initial={false}>
          {view === 'grid' ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
              className="grid gap-x-6 gap-y-14 sm:grid-cols-2"
            >
              <AnimatePresence mode="popLayout">
                {visible.map((project, i) => (
                  <ProjectCard key={project.slug} project={project} index={i} onOpen={open} priority={i < 2} />
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: EASE_OUT }}>
              <ProjectRows projects={visible} onOpen={open} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ProjectDialog
        project={openProject}
        onClose={close}
        onStep={step}
        position={openProject ? `${String(openIndex + 1).padStart(2, '0')} / ${String(visible.length).padStart(2, '0')}` : ''}
      />
    </SiteLayout>
  )
}

export async function getStaticProps() {
  const content = await getPageContent()
  return { props: { content }, revalidate: 60 }
}
