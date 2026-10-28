import { useEffect, useRef } from 'react';

/**
 * Settles its children out of a light blur the first time they scroll into view.
 *
 * One `IntersectionObserver` is shared by every `Reveal` on the page, and each
 * element is unobserved once it has appeared. The hidden state is CSS under
 * `.js .ss-reveal`, so without JavaScript — a crawler, a script blocker —
 * everything is simply visible.
 */
let observer;

function getObserver() {
    if (observer || typeof IntersectionObserver === 'undefined') return observer;
    observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-in');
                observer.unobserve(entry.target);
            });
        },
        { rootMargin: '0px 0px -6% 0px', threshold: 0.08 },
    );
    return observer;
}

const Reveal = ({ as: Tag = 'div', delay = 0, className = '', style, children, ...rest }) => {
    const ref = useRef(null);

    useEffect(() => {
        const node = ref.current;
        const io = getObserver();
        if (!node) return undefined;
        if (!io) {
            node.classList.add('is-in');
            return undefined;
        }
        io.observe(node);
        return () => io.unobserve(node);
    }, []);

    return (
        <Tag ref={ref} className={`ss-reveal ${className}`} style={{ '--d': `${delay}ms`, ...style }} {...rest}>
            {children}
        </Tag>
    );
};

export default Reveal;
