import SectionHeading from '../ui/SectionHeading';
import ExperienceTabs from './ExperienceTabs';

/**
 * Permanent roles, from the database.
 *
 * `timeline` arrives as the finished string rather than as dates: `lib/content.js`
 * formats it with the same `formatTimeline` the dashboard uses, so the two cannot
 * disagree and no `Date` has to survive `getStaticProps`.
 *
 * The field names are the schema's — `jobPosition`, `companyName` — where the old
 * static file used `job_position` and `company_name`. That rename happens in the
 * read layer, so this component has one vocabulary instead of two.
 */
const Experience = ({ experiences = [], section }) => (
    <section className="py-20 md:py-28" id={section?.anchor || 'exp'}>
        <SectionHeading numberLabel={section?.numberLabel || '01.'} heading={section?.heading || 'Job Experiences'} />
        <ExperienceTabs experiences={experiences} idPrefix="job" />
    </section>
);

export default Experience;
