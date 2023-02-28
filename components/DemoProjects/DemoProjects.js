import React from 'react';
import { Box, Typography } from '@mui/material';
import { projects } from '../../data/projects';
import ProjectCard from '../ProjectCard/ProjectCard';

const DemoProjects = () => {
    return (
        <Box className='py-10'>
            <Box>
                <Typography variant='h4' className='font-semibold text-[#d2d2d2]'>
                    <span className='text-[#7a61ff]'>10. </span> Some Projects I worked on...
                </Typography>
            </Box>
            <Box className='md:grid md:grid-cols-3 gap-4 mt-8'>
                {
                    projects && projects.map((e, i) => (
                        <ProjectCard key={i} e={e} />
                    ))
                }
            </Box>
        </Box>
    );
};

export default DemoProjects;