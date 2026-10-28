import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCopy } from './feedback';
import { useTheme } from './theme';
import * as Icon from './icons';

export const OPEN_PALETTE_EVENT = 'ss:open-palette';

/** Opens the palette from anywhere — the nav button, the hero hint. */
export const openPalette = () => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));

/**
 * ⌘K / Ctrl+K: jump anywhere on the site, open any project, copy the email,
 * fetch the résumé, flip the theme.
 *
 * Every command is built from content the page already has — the nav, the
 * projects, the social links — so it grows with the dashboard and never lists a
 * page or project that is not published.
 *
 * It follows the combobox pattern: focus stays in the input, ↑/↓ move the
 * highlighted option (`aria-activedescendant`), Enter runs it, Esc closes and
 * hands focus back to whatever opened it.
 */
function useCommands({ nav, projects, socialLinks, email, hasResume }) {
    const router = useRouter();
    const copy = useCopy();
    const { toggle } = useTheme();

    return useMemo(() => {
        const go = (href) => () => (href.startsWith('#') ? window.location.assign(href) : router.push(href));
        const open = (href) => () => window.open(href, '_blank', 'noopener,noreferrer');

        const navIcon = { projects: Icon.Grid, about: Icon.User, blog: Icon.Pen, contact: Icon.Mail };
        const commands = [
            { group: 'Pages', id: 'home', label: 'Home', icon: Icon.Home, run: go('/') },
            ...nav.map((item) => ({
                group: 'Pages',
                id: `nav-${item.key}`,
                label: item.label,
                icon: navIcon[item.key] || Icon.ArrowRight,
                run: go(item.href),
            })),
        ];

        if (email) {
            commands.push({
                group: 'Actions',
                id: 'copy-email',
                label: 'Copy email address',
                hint: email,
                icon: Icon.Copy,
                run: () => copy(email, { label: 'Email copied', fallbackHref: `mailto:${email}` }),
            });
            commands.push({ group: 'Actions', id: 'mail', label: 'Send an email', icon: Icon.Mail, run: () => window.location.assign(`mailto:${email}`) });
        }
        if (hasResume) {
            commands.push({ group: 'Actions', id: 'resume', label: 'Open résumé', icon: Icon.File, run: open('/cv') });
        }
        commands.push({ group: 'Actions', id: 'theme', label: 'Toggle theme', icon: Icon.Moon, run: toggle });

        projects.forEach((project) => {
            commands.push({
                group: 'Projects',
                id: `project-${project.id}`,
                label: project.title,
                hint: project.stacks?.slice(0, 2).join(' · '),
                keywords: project.stacks?.join(' '),
                icon: Icon.ArrowUpRight,
                run: project.liveUrl ? open(project.liveUrl) : project.repoUrl ? open(project.repoUrl) : go(`/work#${project.slug}`),
            });
        });

        socialLinks.forEach((link) => {
            commands.push({ group: 'Elsewhere', id: `social-${link.id}`, label: link.label, icon: Icon.Link, run: open(link.url) });
        });

        return commands;
    }, [nav, projects, socialLinks, email, hasResume, router, copy, toggle]);
}

function match(command, query) {
    if (!query) return true;
    const haystack = `${command.label} ${command.hint || ''} ${command.keywords || ''} ${command.group}`.toLowerCase();
    return query
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .every((token) => haystack.includes(token));
}

const CommandPalette = ({ nav = [], projects = [], socialLinks = [], email, hasResume = false }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const returnFocus = useRef(null);

    const commands = useCommands({ nav, projects, socialLinks, email, hasResume });
    const results = useMemo(() => commands.filter((command) => match(command, query)), [commands, query]);

    const show = useCallback(() => {
        returnFocus.current = document.activeElement;
        setQuery('');
        setActive(0);
        setOpen(true);
    }, []);

    const hide = useCallback(() => {
        setOpen(false);
        returnFocus.current?.focus?.();
    }, []);

    useEffect(() => {
        const onKey = (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                if (open) hide();
                else show();
            }
        };
        window.addEventListener('keydown', onKey);
        window.addEventListener(OPEN_PALETTE_EVENT, show);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener(OPEN_PALETTE_EVENT, show);
        };
    }, [open, show, hide]);

    useEffect(() => {
        if (!open) return undefined;
        const root = document.documentElement;
        const previous = root.style.overflow;
        root.style.overflow = 'hidden';
        inputRef.current?.focus();
        return () => {
            root.style.overflow = previous;
        };
    }, [open]);

    useEffect(() => {
        listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    }, [active]);

    if (!open) return null;

    const run = (command) => {
        hide();
        command.run();
    };

    const onKeyDown = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            hide();
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((i) => (results.length ? (i + 1) % results.length : 0));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
        } else if (event.key === 'Enter' && results[active]) {
            event.preventDefault();
            run(results[active]);
        }
    };

    let lastGroup = null;

    return (
        <div className="ss-overlay" onMouseDown={(event) => event.target === event.currentTarget && hide()}>
            <div className="ss-palette" role="dialog" aria-modal="true" aria-label="Command menu">
                <div className="flex items-center gap-3 px-4 border-b border-ss-line">
                    <Icon.Search className="w-4 h-4 text-ss-faint shrink-0" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setActive(0);
                        }}
                        onKeyDown={onKeyDown}
                        placeholder="Search pages, projects, actions…"
                        role="combobox"
                        aria-expanded="true"
                        aria-controls="ss-palette-list"
                        aria-activedescendant={results[active] ? `ss-cmd-${results[active].id}` : undefined}
                        className="w-full h-14 bg-transparent outline-none text-[15px] text-ss-fg placeholder:text-ss-faint"
                    />
                    <kbd className="ss-kbd">esc</kbd>
                </div>

                <div ref={listRef} id="ss-palette-list" role="listbox" aria-label="Commands" className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
                    {results.length ? (
                        results.map((command, i) => {
                            const heading = command.group !== lastGroup ? command.group : null;
                            lastGroup = command.group;
                            const CommandIcon = command.icon;
                            return (
                                <div key={command.id}>
                                    {heading ? (
                                        <div className="ss-mono px-3 pt-3 pb-1.5 text-ss-faint uppercase tracking-wider" role="presentation">
                                            {heading}
                                        </div>
                                    ) : null}
                                    <div
                                        id={`ss-cmd-${command.id}`}
                                        role="option"
                                        aria-selected={i === active}
                                        className="ss-option"
                                        onMouseMove={() => i !== active && setActive(i)}
                                        onClick={() => run(command)}
                                    >
                                        <CommandIcon className="w-4 h-4 text-ss-muted shrink-0" />
                                        <span className="truncate">{command.label}</span>
                                        {command.hint ? <span className="ml-auto pl-3 text-ss-faint text-[13px] truncate">{command.hint}</span> : null}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p className="px-3 py-10 text-center text-ss-muted">Nothing matches “{query}”.</p>
                    )}
                </div>

                <div className="flex items-center gap-4 px-4 py-2.5 border-t border-ss-line text-[12px] text-ss-faint">
                    <span className="flex items-center gap-1.5"><kbd className="ss-kbd">↑</kbd><kbd className="ss-kbd">↓</kbd> navigate</span>
                    <span className="flex items-center gap-1.5"><kbd className="ss-kbd">↵</kbd> open</span>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
