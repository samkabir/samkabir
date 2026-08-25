import { Box, Typography } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Image from 'next/image';
import { rubikFont } from '../../lib/fonts';

/**
 * One project card.
 *
 * Two changes beyond the field renames (`name`→`title`, `github`→`repoUrl`,
 * `liveWebsite`→`liveUrl`, `image`→`cover`):
 *
 * **`next/image` instead of `<img>`.** This is the one visual-layer change the
 * project's rules permit, and only because it fixes measurable layout shift: the
 * old `<img width={280}>` declared no height, so the browser reserved no vertical
 * space and every card jumped when its screenshot arrived. `Media.width` and
 * `Media.height` were recorded at upload, so passing both gives the browser the
 * aspect ratio up front and the shift goes to zero. `style` pins the rendered
 * width at the same 280px as before, so nothing moves.
 *
 * **Real alt text.** It was `alt="project image"` on all sixteen cards, which
 * tells someone using a screen reader nothing. The text now comes from
 * `Media.alt`, written per screenshot during the asset import.
 */
const ProjectCard = ({ e }) => {

    return (
        <Box className='bg-[#233352] rounded transform transition duration-500 hover:scale-105 mt-6 md:mt-0 pb-4 pt-2'>
            <Box className='flex justify-center py-3'>
            <a href={e.liveUrl} target="_blank" rel="noreferrer">
                {e.cover?.url ? (
                    <Image
                        src={e.cover.url}
                        alt={e.cover.alt || `Screenshot of ${e.title}`}
                        width={e.cover.width ?? 280}
                        height={e.cover.height ?? 158}
                        className="rounded"
                        sizes="280px"
                        style={{ width: 280, height: 'auto' }}
                    />
                ) : null}
            </a>
            </Box>
            <Box className='px-5 py-2'>
                <Box className='flex justify-between'>
                    {/* Project Title and links */}
                    <Box className=''>
                        <Typography variant='h6' className={`font-[600] text-[#d6d6d6] ${rubikFont.className}`}>
                            {e.title}
                        </Typography>
                    </Box>
                    <Box className=''>
                        <a href={e.repoUrl} target="_blank" rel="noreferrer">
                            <GitHubIcon className="text-[#d6d6d6] hover:text-[#7a61ff] text-3xl mr-2 transform transition duration-500" />
                        </a>
                        <a href={e.liveUrl} target="_blank" rel="noreferrer">
                            <OpenInNewIcon className="text-[#d6d6d6] hover:text-[#7a61ff] text-3xl mr-2 transform transition duration-500" />
                        </a>
                    </Box>
                </Box>
                <Box>
                    {/* project description */}
                    <Box>
                        <Typography variant='caption' className={`text-[#d6d6d6] ${rubikFont.className}`}>
                            {e.description}
                        </Typography>
                    </Box>
                </Box>
                <Box className='flex flex-wrap mt-3'>
                    {/* stacks used */}
                    {e.stacks.map((stack, i) => (
                        <Box key={i} className='border-2 text-[#d6d6d6] rounded border-[#d6d6d6] mr-2 mb-1 px-2 hover:border-[#7a61ff] hover:text-[#7a61ff] cursor-pointer transform transition duration-500'>
                            {stack}
                        </Box>
                    ))}
                </Box>
            </Box>
        </Box>
    );
};

export default ProjectCard;
