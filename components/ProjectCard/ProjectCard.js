import { Box, Typography } from '@mui/material';
import React from 'react';
import GitHubIcon from '@mui/icons-material/GitHub';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Rubik } from '@next/font/google';

export const rubikFont = Rubik({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
});

const ProjectCard = ({ e }) => {
    
    return (
        <Box className='bg-[#233352] rounded transform transition duration-500 hover:scale-105 mt-6 md:mt-0'>
            <Box className='flex justify-center py-3'>
            <a href={e.liveWebsite} target='_blank'><img src={e.image} alt='project image' className='rounded' width={280} /></a>
            </Box>
            <Box className='px-5 py-2'>
                <Box className='flex justify-between'>
                    {/* Project Title and links */}
                    <Box className=''>
                        <Typography variant='h6' className={`font-[600] text-[#d6d6d6] ${rubikFont.className}`}>
                            {e.name}
                        </Typography>
                    </Box>
                    <Box className=''>
                        <a href={e.github} target='_blank' ><GitHubIcon className='text-[#d6d6d6] hover:text-[#7a61ff] text-3xl mr-2 transform transition duration-500' /></a>
                        <a href={e.liveWebsite} target='_blank' ><OpenInNewIcon className='text-[#d6d6d6] hover:text-[#7a61ff] text-3xl mr-2 transform transition duration-500' /></a>
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
                    {e.stacks.map((e,i) => (
                        <Box key={i} className='border-2 text-[#d6d6d6] rounded border-[#d6d6d6] mr-2 mb-1 px-2 hover:border-[#7a61ff] hover:text-[#7a61ff] cursor-pointer transform transition duration-500'>
                            {e}
                        </Box>
                    ))}
                </Box>
            </Box>
        </Box>
    );
};

export default ProjectCard;