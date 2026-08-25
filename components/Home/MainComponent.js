import { Box, Typography } from '@mui/material';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { useEffect } from 'react';
import { itimFont } from '../../lib/fonts';

/**
 * The hero block: greeting, name, headline and the CV link.
 *
 * The CV link is the one behavioural change here. It used to point straight at
 * `/assets/Samiul_Kabir_Resume.pdf`, a file in the repository, which meant
 * replacing a CV was a commit and every link anyone had already shared pointed at
 * whatever that path held. It now points at `/cv`, which resolves through
 * `pages/api/cv.js` to whichever `Resume` row is active — so the URL never
 * changes and uploading a new version takes effect immediately.
 *
 * The button is hidden entirely when no résumé is active, rather than left
 * pointing at a 404. A Resume button that returns "No CV is published yet" is
 * worse than no button.
 */
const MainComponent = ({ profile, hasResume = false }) => {

    useEffect(() => {
        AOS.init();
      }, [])

    const greeting = profile?.greeting || 'Hi, This is';
    const fullName = profile?.fullName || '';
    const headline = profile?.headline || '';

    return (
        <div className='my-10 mx-10 text-white md:h-[400px]'  data-aos="fade-down" data-aos-easing="ease-in-out" data-aos-duration="1000" data-aos-delay="50" data-aos-once="true">
            <Box>
                <Typography variant='h6' className={`${itimFont.variable} font-sans pb-2 pl-1`} >
                    {greeting}
                </Typography>
            </Box>
            <Box className='hidden md:block'>
                <Typography variant='h3' className='pb-1'>
                    {fullName}
                </Typography>
            </Box>
            <Box className='md:hidden'>
                <Typography variant='h4' className='pb-1'>
                    {fullName}
                </Typography>
            </Box>
            <Box className='hidden md:block'>
                <Typography variant='h3' className='pb-4 text-[#d8d8d8] writer-text2'>
                    {headline}
                </Typography>
            </Box>
            <Box className='md:hidden'>
                <Typography variant='h4' className='pb-4 text-[#d8d8d8]'>
                    {headline}
                </Typography>
            </Box>
            {hasResume ? (
                <Box>
                    <a
                        href="/cv"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block transform transition duration-500 border-2 border-[#7a61ff] py-2 px-6 my-4 font-semibold text-[#7a61ff] hover:text-[#000] hover:bg-[#7a61ff]"
                    >
                        Resume
                    </a>
                </Box>
            ) : null}
        </div>
    );
};

export default MainComponent;
