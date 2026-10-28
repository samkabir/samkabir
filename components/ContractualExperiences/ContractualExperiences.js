import SectionHeading from "../ui/SectionHeading";
import ExperienceTabs from "../Experience/ExperienceTabs";

/**
 * Consulting engagements — the same table as `Experience`, filtered to
 * `kind: CONTRACT`.
 *
 * The two components were near-duplicates over two structurally identical data
 * files, which is why the schema merged them into one model with a discriminator.
 * They stay separate components because the site renders them as two sections
 * with different headings, but they now read from one table, one endpoint, one
 * validation schema and one view (`ExperienceTabs`).
 */
const ContractualExperiences = ({ experiences = [], section }) => (
  <section className="py-20 md:py-28 md:pt-8" id={section?.anchor || "contract-exp"}>
    <SectionHeading
      size="sm"
      numberLabel={section?.numberLabel || "01.0"}
      heading={section?.heading || "Contractual Experiences"}
    />
    <ExperienceTabs experiences={experiences} idPrefix="contract" />
  </section>
);

export default ContractualExperiences;
