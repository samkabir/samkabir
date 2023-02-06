import { Box, Typography } from '@mui/material';
import React from 'react';

const AboutMe = () => {
    return (
        <Box className='py-10'>
            <Box>
                <Typography variant='h4' className='font-semibold text-[#d2d2d2]'>
                    <span className='text-[#7a61ff]'>00. </span> About Me
                </Typography>
            </Box>
            <Box className='grid grid-cols-2 gap-4 text-[#d2d2d2]'>
                <Box>
                    <Typography variant='subtitle1' className='pt-6'>
                        To pursue a challenging and rewarding career as a Software Engineer, utilizing my expertise in software
                        design and development, to contribute to the success of a dynamic organization by delivering innovative and
                        high-quality software solutions that meet the evolving needs of the business and its customers. Committed to
                        continuously learning and staying updated with the latest technologies and industry trends to deliver cutting edge software solutions
                    </Typography>
                    <Box>
                    UnderGrad and O and A Levels
                    </Box>
                </Box>
                <Box>
                    <img src='' alt='' className='' />
                </Box>
            </Box>
            <Box>
                <Typography variant='h5' className='font-semibold text-[#d2d2d2] pt-10'>
                <span className='text-[#7a61ff]'>00.0 </span>Skill Stack
                </Typography>
            </Box>
            <Box>

            </Box>
            <Box>
                Leetcode
            </Box>
        </Box>
    );
};

export default AboutMe;