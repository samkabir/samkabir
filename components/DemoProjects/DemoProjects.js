import { useState } from 'react';
import ProjectCard from '../ProjectCard/ProjectCard';
import Reveal from '../ui/Reveal';
import SectionHeading from '../ui/SectionHeading';

/**
 * The projects section: three by default, all of them behind a toggle.
 *
 * Which three used to be `projects.slice(0, 3)` — whichever happened to sit at
 * the top of `data/projects.js`. It is now `isFeatured`, so the choice is a
 * switch in the dashboard rather than the order of a source file. The seed set
 * the flag on the same three the slice was showing, so the section opens with
 * exactly what it did before.
 *
 * The slice survives as a fallback for one specific case: a database where
 * nothing is flagged. Without it the section would collapse to a heading and a
 * "View All Projects" button, which reads as a bug rather than as an unset flag.
 */
const DemoProjects = ({ projects = [], section }) => {
    const [showAll, setShowAll] = useState(false);

    const featured = projects.filter((project) => project.isFeatured);
    const someProjects = featured.length > 0 ? featured : projects.slice(0, 3);
    const visible = showAll ? projects : someProjects;
    const anchor = section?.anchor || 'project';

    return (
        <section className="py-20 md:py-28" id={anchor}>
            <SectionHeading
                numberLabel={section?.numberLabel || '10.'}
                heading={section?.heading || 'Some Projects I worked on...'}
            />

            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((e, i) => (
                    <Reveal as="li" key={e.id} delay={(i % 3) * 120} className="h-full">
                        <ProjectCard e={e} />
                    </Reveal>
                ))}
            </ul>

            {/* Only offered when there is more to show than is already on screen —
                a "View All Projects" button that reveals nothing is worse than none. */}
            {projects.length > someProjects.length ? (
                <div className="flex justify-center mt-14">
                    <button
                        type="button"
                        className="btn btn-ghost"
                        aria-expanded={showAll}
                        onClick={() => {
                            // Collapsing from far down the list would leave the reader
                            // stranded below a section that just got shorter.
                            if (showAll) document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' });
                            setShowAll(!showAll);
                        }}
                    >
                        {showAll ? 'View Less Projects' : `View All Projects (${projects.length})`}
                        <svg
                            className={`w-4 h-4 transition-transform duration-500 ${showAll ? 'rotate-180' : ''}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            aria-hidden="true"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                        </svg>
                    </button>
                </div>
            ) : null}
        </section>
    );
};

export default DemoProjects;
