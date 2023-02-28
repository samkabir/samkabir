import { Box } from '@mui/material';
import React from 'react';
import { Rubik } from '@next/font/google';

export const rubikFont = Rubik({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
});

const Footer = () => {
    return (
        <Box className='flex flex-col justify-center items-center mb-6'>
            <Box className={`text-[#d2d2d2] text-xs hover:text-[#7a61ff] cursor-default ${rubikFont.className}`}>
                Designed & Built By Samiul Kabir
            </Box>
            <Box className={`text-[#d2d2d2] text-xs cursor-default ${rubikFont.className}`}>
                Web Design Idea - <a href='https://brittanychiang.com/' targer='_blank' className='pointer text-[#64ffda]'>Brittany Chiang</a>
            </Box>
        </Box>
    );
};

export default Footer;