import { Box, Typography } from '@mui/material';
import Link from 'next/link';
import React from 'react';
import { Itim } from '@next/font/google';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { useEffect } from 'react';


const itim = Itim({
    subsets: ['latin'],
    weight: '400',
    variable: '--font-itim',
})

const MainComponent = () => {

    useEffect(() => {
        AOS.init();
      }, [])

    return (
        <div className='my-10 mx-10 text-white md:h-[400px]'  data-aos="fade-down" data-aos-easing="ease-in-out" data-aos-duration="1000" data-aos-delay="50" data-aos-once="true">
            <Box>
                <Typography variant='h6' className={`${itim.variable} font-sans pb-2 pl-1`} >
                    Hi, This is
                </Typography>
            </Box>
            <Box className='hidden md:block'>
                <Typography variant='h3' className='pb-1'>
                    Samiul Kabir
                </Typography>
            </Box>
            <Box className='md:hidden'>
                <Typography variant='h4' className='pb-1'>
                    Samiul Kabir
                </Typography>
            </Box>
            <Box className='hidden md:block'>
                <Typography variant='h3' className='pb-4 text-[#d8d8d8] writer-text2'>
                    I Forge Web Designs for the Digital space.
                </Typography>
            </Box>
            <Box className='md:hidden'>
                <Typography variant='h4' className='pb-4 text-[#d8d8d8]'>
                    I Forge Web Designs for the Digital space.
                </Typography>
            </Box>
            <Box>
                {/* <iframe src='/assets/Samiul_Kabir_Resume.pdf' /> */}
                {/* <a
                    href="/assets/Samiul_Kabir_Resume.pdf"
                    alt="alt text"
                    target="_blank"
                    rel="noopener noreferrer"
                >Download FIle</a> */}
                <Link href="/assets/Samiul_Kabir_Resume.pdf">
                    <button className='transform transition duration-500 border-2 border-[#7a61ff] py-2 px-6 my-4 font-semibold text-[#7a61ff] hover:text-[#000] hover:bg-[#7a61ff]'>Resume</button>
                </Link>
            </Box>
        </div>
    );
};

export default MainComponent;