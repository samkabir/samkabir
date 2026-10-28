import GitHubIcon from '@mui/icons-material/GitHub';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Image from 'next/image';
import { trackPointer } from '../ui/spotlight';

/**
 * One project card.
 *
 * Two changes beyond the field renames (`name`→`title`, `github`→`repoUrl`,
 * `liveWebsite`→`liveUrl`, `image`→`cover`):
 *
 * **`next/image` instead of `<img>`.** The old `<img width={280}>` declared no
 * height, so the browser reserved no vertical space and every card jumped when
 * its screenshot arrived. The cover now sits in a fixed 16:10 frame and fills it,
 * so the card's height is known before the file arrives and every card in a row
 * lines up regardless of the screenshot's own proportions.
 *
 * **Real alt text.** It was `alt="project image"` on all sixteen cards, which
 * tells someone using a screen reader nothing. The text now comes from
 * `Media.alt`, written per screenshot during the asset import.
 *
 * Either link may be empty; a card without a live URL simply has no clickable
 * cover, rather than a link to nowhere.
 */
const ProjectCard = ({ e }) => {
    const cover = e.cover?.url ? (
        <Image
            src={e.cover.url}
            alt={e.cover.alt || `Screenshot of ${e.title}`}
            fill
            sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
            className="object-cover object-top transition-transform duration-700 group-hover:scale-105"
        />
    ) : (
        <div className="absolute inset-0 grid place-items-center text-5xl font-extrabold text-[rgba(122,97,255,0.35)]">
            {e.title?.[0]}
        </div>
    );

    return (
        <article
            onPointerMove={trackPointer}
            className="spotlight glass group flex flex-col h-full rounded-2xl overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_30px_60px_-25px_rgba(122,97,255,0.45)]"
        >
            <div className="relative aspect-[16/10] overflow-hidden bg-[#0f1729]">
                {e.liveUrl ? (
                    <a href={e.liveUrl} target="_blank" rel="noreferrer" aria-label={`Open ${e.title}`} tabIndex={-1}>
                        {cover}
                    </a>
                ) : cover}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b1222] via-transparent to-transparent opacity-80"
                />
            </div>

            <div className="flex flex-col flex-1 p-6">
                <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold text-[#f1f3fb] transition-colors duration-300 group-hover:text-[#c9c2ff]">
                        {e.title}
                    </h3>
                    <div className="flex items-center gap-1 -mr-1 shrink-0">
                        {e.repoUrl ? (
                            <a
                                href={e.repoUrl}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`${e.title} source code`}
                                className="p-1.5 rounded-full text-[#94a0bf] hover:text-white hover:bg-[rgba(255,255,255,0.06)] transition-colors"
                            >
                                <GitHubIcon className="text-[20px]" />
                            </a>
                        ) : null}
                        {e.liveUrl ? (
                            <a
                                href={e.liveUrl}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`${e.title} live site`}
                                className="p-1.5 rounded-full text-[#94a0bf] hover:text-white hover:bg-[rgba(255,255,255,0.06)] transition-colors"
                            >
                                <OpenInNewIcon className="text-[20px]" />
                            </a>
                        ) : null}
                    </div>
                </div>

                {e.description ? (
                    <p className="mt-2 text-sm leading-relaxed text-[#94a0bf]">{e.description}</p>
                ) : null}

                {e.stacks?.length ? (
                    <ul className="flex flex-wrap gap-x-3 gap-y-1 mt-auto pt-5 font-mono text-xs text-[#a594ff]">
                        {e.stacks.map((stack, i) => (
                            <li key={i}>{stack}</li>
                        ))}
                    </ul>
                ) : null}
            </div>
        </article>
    );
};

export default ProjectCard;
