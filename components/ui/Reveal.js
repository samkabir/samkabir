import { useEffect, useRef } from 'react';

/**
 * Fades its children up into place the first time they scroll into view.
 *
 * One `IntersectionObserver` is shared by every `Reveal` on the page rather than
 * one each — a page with forty skill chips would otherwise run forty observers.
 * The element is unobserved after it appears, so nothing re-animates on the way
 * back up.
 *
 * The hidden state lives in CSS under `.js .reveal` (see `globals.css` and the
 * script in `_document.js`), so the server-rendered HTML is fully visible to a
 * crawler or a visitor without JavaScript. `prefers-reduced-motion` turns the
 * transition off there too.
 */
let observer;

function getObserver() {
    if (observer || typeof IntersectionObserver === 'undefined') return observer;

    observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
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
            node.classList.add('is-visible');
            return undefined;
        }
        io.observe(node);
        return () => io.unobserve(node);
    }, []);

    return (
        <Tag
            ref={ref}
            className={`reveal ${className}`}
            style={{ '--delay': `${delay}ms`, ...style }}
            {...rest}
        >
            {children}
        </Tag>
    );
};

export default Reveal;
