import { motion } from 'motion/react';
import { useShell } from './Shell';
import { EASE_OUT } from './ease';
import { SplitText } from './motion';

/**
 * The opening of an inner page: an outsized title that rises in letter by
 * letter as the page is uncovered, an optional count beside it, and a lede.
 * `children` sits under the lede (the About page puts its bio there).
 */
export default function PageHeader({ title, count, lede, eyebrow, children }) {
    const { ready } = useShell();
    const letters = [...title];

    return (
        <header className="mx-auto max-w-[1440px] px-5 sm:px-8 pt-36 sm:pt-44 pb-14 sm:pb-20">
            {eyebrow ? (
                <motion.p
                    className="mo-label text-mo-muted mb-6"
                    initial={{ opacity: 0, y: 12 }}
                    animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                    transition={{ duration: 0.8, ease: EASE_OUT }}
                >
                    {eyebrow}
                </motion.p>
            ) : null}

            <h1 className="relative inline-flex items-start mo-display text-[clamp(84px,17vw,280px)] !leading-[0.82]">
                <span className="sr-only">{title}</span>
                <span aria-hidden="true" className="flex">
                    {letters.map((char, i) => (
                        <span key={i} className="mo-mask !pb-[0.2em] !-mb-[0.2em]">
                            <motion.span
                                initial={{ y: '135%' }}
                                animate={{ y: ready ? '0%' : '135%' }}
                                transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.1 + i * 0.05 }}
                            >
                                {char === ' ' ? ' ' : char}
                            </motion.span>
                        </span>
                    ))}
                </span>
                {typeof count === 'number' ? (
                    <motion.sup
                        className="ml-3 mt-[0.4em] mo-label !text-[clamp(13px,1.3vw,18px)] text-mo-accent-ink"
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={ready ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
                        transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.1 + letters.length * 0.05 }}
                    >
                        ({count})
                    </motion.sup>
                ) : null}
            </h1>

            {lede ? (
                <SplitText
                    as="p"
                    text={lede}
                    delay={0.35}
                    stagger={0.025}
                    className="block mt-8 max-w-3xl text-[clamp(22px,2.6vw,36px)] leading-[1.2] tracking-[-0.025em] text-mo-muted"
                />
            ) : null}

            {children}
        </header>
    );
}
