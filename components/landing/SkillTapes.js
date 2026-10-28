/**
 * Two marquee "tapes" crossing the page between the hero and About: a lime one
 * with the skills in solid type, and a dark one behind it running the other way
 * in outline.
 *
 * Each tape renders its list twice, back to back, and slides by exactly one
 * copy's width so the loop has no seam. The second copy is `aria-hidden`, and the
 * whole band is decorative to assistive tech — the same skills are listed in the
 * About section as plain text.
 */
function Tape({ skills, reverse = false, speed, className, itemClass, separator }) {
    const items = skills.map((skill, i) => (
        <span key={i} className="flex items-center gap-10 whitespace-nowrap">
            <span className={itemClass}>{skill}</span>
            <span aria-hidden="true">{separator}</span>
        </span>
    ));

    return (
        <div className={`lp-marquee ${className}`} data-reverse={reverse} style={{ '--speed': speed }}>
            <div className="lp-marquee__track">{items}</div>
            <div className="lp-marquee__track" aria-hidden="true">{items}</div>
        </div>
    );
}

const SkillTapes = ({ skills = [] }) => {
    if (!skills.length) return null;

    return (
        <div aria-hidden="true" className="relative py-16 md:py-24 -mx-4">
            <Tape
                skills={skills}
                reverse
                speed="70s"
                className="absolute inset-x-0 top-1/2 -translate-y-1/2 rotate-[2.5deg] bg-[#151513] border-y border-[rgba(242,240,234,0.1)] py-4"
                itemClass="lp-display lp-outline text-4xl md:text-6xl"
                separator="✺"
            />
            <Tape
                skills={skills}
                speed="55s"
                className="relative -rotate-[2deg] bg-[#d4ff4f] text-[#10120a] py-4 shadow-[0_20px_60px_-20px_rgba(212,255,79,0.45)]"
                itemClass="lp-display text-4xl md:text-6xl"
                separator="✺"
            />
        </div>
    );
};

export default SkillTapes;
