import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { projects } from '../../data/projects';
import ProjectCard from '../ProjectCard/ProjectCard';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { useEffect } from 'react';

const DemoProjects = () => {
    useEffect(() => {
        AOS.init();
    }, [])
    
    const [showAll, setShowAll] = useState(false);
    const someProjects = projects.slice(0, 3);
   
    return (
        <Box className='py-10' id='project' data-aos="fade-down" data-aos-easing="ease-in-out" data-aos-duration="1000" data-aos-delay="50" data-aos-once="true">
            <Box>
                <Typography variant='h4' className='font-semibold text-[#d2d2d2]'>
                    <span className='text-[#7a61ff]'>10. </span> Some Projects I worked on...
                </Typography>
            </Box>
            <Box className='md:grid md:grid-cols-3 gap-4 mt-8' >
                {
                    showAll?
                    projects && projects.map((e, i) => (
                        <ProjectCard key={i} e={e} />
                    ))
                    :
                    someProjects && someProjects.map((e, i) => (
                        <ProjectCard key={i} e={e} />
                    ))
                }
            </Box>
            {
                showAll ?
                <Box className='flex justify-center mt-10'>
                <button className='transform transition duration-500 border-2 border-[#7a61ff] py-2 px-6 my-4 font-semibold text-[#7a61ff] hover:text-[#000] hover:bg-[#7a61ff] normal-case' onClick={() => { setShowAll(!showAll) }}>
                    View Less Projects
                </button>
            </Box>
                    :
                    <Box className='flex justify-center mt-10'>
                        <button className='transform transition duration-500 border-2 border-[#7a61ff] py-2 px-6 my-4 font-semibold text-[#7a61ff] hover:text-[#000] hover:bg-[#7a61ff] normal-case' onClick={() => { setShowAll(!showAll) }}>
                            View All Projects
                        </button>
                    </Box>
            }

        </Box>
    );
};

export default DemoProjects;