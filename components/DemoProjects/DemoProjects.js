import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import ProjectCard from '../ProjectCard/ProjectCard';
import AOS from 'aos';
import 'aos/dist/aos.css';

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
    useEffect(() => {
        AOS.init();
    }, [])

    const [showAll, setShowAll] = useState(false);

    const featured = projects.filter((project) => project.isFeatured);
    const someProjects = featured.length > 0 ? featured : projects.slice(0, 3);
    const visible = showAll ? projects : someProjects;

    return (
        <Box className='py-10' id={section?.anchor || 'project'} data-aos="fade-down" data-aos-easing="ease-in-out" data-aos-duration="1000" data-aos-delay="50" data-aos-once="true">
            <Box>
                <Typography variant='h4' className='font-semibold text-[#d2d2d2]'>
                    <span className='text-[#7a61ff]'>{section?.numberLabel || '10.'} </span> {section?.heading || 'Some Projects I worked on...'}
                </Typography>
            </Box>
            <Box className='md:grid md:grid-cols-3 gap-4 mt-8' >
                {
                    visible.map((e) => (
                        <ProjectCard key={e.id} e={e} />
                    ))
                }
            </Box>
            {/* Only offered when there is more to show than is already on screen —
                a "View All Projects" button that reveals nothing is worse than none. */}
            {
                projects.length > someProjects.length ? (
                    <Box className='flex justify-center mt-10'>
                        <button className='transform transition duration-500 border-2 border-[#7a61ff] py-2 px-6 my-4 font-semibold text-[#7a61ff] hover:text-[#000] hover:bg-[#7a61ff] normal-case' onClick={() => { setShowAll(!showAll) }}>
                            {showAll ? 'View Less Projects' : 'View All Projects'}
                        </button>
                    </Box>
                ) : null
            }

        </Box>
    );
};

export default DemoProjects;
