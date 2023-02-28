import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Rubik } from '@next/font/google';
import FacebookIcon from '@mui/icons-material/Facebook';
import GitHubIcon from '@mui/icons-material/GitHub';
import LinkedInIcon from '@mui/icons-material/LinkedIn';

export const rubikFont = Rubik({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
});

const Contact = () => {
    return (
        <Box className='py-10 mt-10 flex flex-col justify-center items-center mb-8'>
            <Box className='flex flex-col justify-center items-center'>
                <Typography variant='subtitle1' className='font-semibold text-[#7a61ff] py-4'>
                    <span className='text-[#7a61ff]'>11. </span> Contact
                </Typography>
                <Typography variant='h2' className='font-semibold text-[#d2d2d2] hidden md:block'>
                    Get In Touch
                </Typography>
                <Typography variant='h3' className='font-semibold text-[#d2d2d2] md:hidden'>
                    Get In Touch
                </Typography>
            </Box>
            <Box className='mt-6'>
                <Typography variant='subtitle1' className={`font-[600] text-[#d2d2d2] ${rubikFont.className}`}>
                    Feel free to contact me anytime.
                </Typography>
                <Box className={`flex justify-center my-12 ${rubikFont.className}`}>
                    <button href="mailto:admin@gamblingco.in" className='transform transition duration-500 border-2 border-[#7a61ff] py-2 px-6 my-4 font-semibold text-[#7a61ff] hover:text-[#000] hover:bg-[#7a61ff] normal-case'>
                        Say Hello
                    </button>
                </Box>
                <Box className='md:hidden'>
                    <ul className='list-none flex justify-center'>
                        <li><a className="active" href="https://www.linkedin.com/in/samkabir/"><LinkedInIcon className="text-4xl mx-4 mb-2 text-[#0072b1]" /></a></li>
                        <li><a className="active" href="https://github.com/samkabir"><GitHubIcon className="text-4xl mx-4 mb-2 text-[#171515] " /></a></li>
                        <li><a className="active" href="https://www.facebook.com/fahim.kabir.5/"><FacebookIcon className="text-4xl mx-4 mb-4 text-[#3b5998]" /></a></li>
                    </ul>
                </Box>
            </Box>
        </Box>
    );
};

export default Contact;