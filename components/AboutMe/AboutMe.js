import { Box, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { skills } from '../../data/skills';
import SkillCard from '../SkillCard/SkillCard';
import Popover from '@mui/material/Popover';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { leetcodeProfileUrl } from '../../lib/leetcode';


const AboutMe = () => {
    const [data, setData] = useState();
    const [statsFailed, setStatsFailed] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);

    /**
     * The solved count, from this site's own endpoint.
     *
     * It used to call leetcode-stats-api.herokuapp.com directly. That service is
     * gone — Heroku retired its free dynos — and a dead host's error page carries
     * no CORS headers, so the browser reported a CORS failure rather than a 503.
     * `/api/leetcode` asks LeetCode itself, server-side, where CORS does not
     * apply.
     *
     * Three things the previous version did not do:
     *
     *   * **Catch.** A rejected fetch with no handler is an unhandled rejection
     *     in the console and nothing on screen — which is how the number could
     *     stop rendering without anyone noticing why.
     *   * **Abort on unmount.** Strict Mode runs this twice in development, so
     *     the first request is cancelled rather than left to set state on a
     *     component that has gone.
     *   * **Have a failed state.** `data && data.totalSolved` renders an empty
     *     circle when the request fails, which looks like a styling bug.
     */
    useEffect(() => {
        const controller = new AbortController();

        fetch('/api/leetcode', { signal: controller.signal })
            .then(response => (response.ok ? response.json() : Promise.reject(response)))
            .then(stats => setData(stats))
            .catch(error => {
                if (error?.name === 'AbortError') return;
                setStatsFailed(true);
            });

        return () => controller.abort();
    }, [])
    useEffect(() => {
        AOS.init();
      }, [])



    const handlePopoverOpen = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handlePopoverClose = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);
    return (
        <Box className='py-10' id="about" data-aos="fade-down" data-aos-easing="ease-in-out" data-aos-duration="1000" data-aos-delay="50" data-aos-once="true">
            <Box>
                <Typography variant='h4' className='font-semibold text-[#d2d2d2]'>
                    <span className='text-[#7a61ff]'>00. </span> About Me
                </Typography>
            </Box>
            <Box className='md:grid md:grid-cols-2 gap-4 text-[#d2d2d2]'>
                <Box>
                    <Typography variant='subtitle1' className='pt-6'>
                    To secure a challenging position as a Frontend Engineer where I can utilize my expertise in building
                    scalable, high-quality web applications, while leveraging my proficiency in React, Next.js, and software
                    development to contribute to innovative and impactful solutions.
                    </Typography>
                    <Box className='md:pl-4'>
                        <ul className='list-disc'>
                            <li>
                                <Typography variant='subtitle2' className='pt-6'>
                                    Completed UnderGraduation, Bachelor&apos;s in <span className='text-[#7a61ff] font-semibold'>Computer Science and Engineering</span> from <span className='text-[#7a61ff] font-semibold'>BRAC University</span>.
                                </Typography>
                            </li>
                            <li>
                                <Typography variant='subtitle2' className='pt-2'>
                                    Completed <span className='text-[#7a61ff] font-semibold'>O and A Levels</span> under Pearson Edexcel Education.
                                </Typography>
                            </li>
                        </ul>
                    </Box>
                </Box>
                {/* <Box className='flex justify-center items-center mt-8 md:mt-0'>
                    <Box className='transform transition duration-500 border-4 border-[#7a61ff] hover:border-[#fff] p-3 rounded '>
                        <img src='/images/pic.webp' alt='ProfilePicture' className='rounded' width={300} />
                    </Box>
                </Box> */}
            </Box>
            <Box>
                <Typography variant='h5' className='font-semibold text-[#d2d2d2] pt-10 pb-6'>
                    <span className='text-[#7a61ff]'>00.0 </span>Skill Stack
                </Typography>
            </Box>

            <Box className='flex flex-wrap mb-1'>
                {
                    skills && skills.map((item, i) => (
                        <SkillCard key={i} name={item} />
                    ))
                }
            </Box>
            <Box className='flex'>
                <Box className='flex items-center pr-6'>
                    <Typography variant='h6' className='text-[#d2d2d2] font-semibold w-full'
                    aria-owns={open ? 'mouse-over-popover' : undefined}
                    aria-haspopup="true"
                    onMouseEnter={handlePopoverOpen}
                    onMouseLeave={handlePopoverClose}
                    >
                        LeetCode Problems Solved
                    </Typography>
                    <Popover
                        id="mouse-over-popover"
                        sx={{
                            pointerEvents: 'none',
                        }}
                        open={open}
                        anchorEl={anchorEl}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'left',
                        }}
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'left',
                        }}
                        onClose={handlePopoverClose}
                        disableRestoreFocus
                    >
                        <Typography sx={{ p: 1 }}>It ain&apos;t much, but it&apos;s honest work. Click on the number and View my LeetCode Profile.</Typography>
                    </Popover>
                </Box>
                <a href={leetcodeProfileUrl()} target="_blank" rel="noreferrer">
                    <Box className='border-4 border-[#fff] rounded-full w-min py-2 px-3 text-[#7a61ff] font-semibold text-xl hover:border-[#7a61ff] hover:text-[#7a61ff] cursor-pointer transform transition duration-500'>
                        {/* A dash rather than a blank circle when the count is
                            unavailable: the link still works, and an empty ring
                            reads as a broken layout. */}
                        {data ? data.totalSolved : statsFailed ? '—' : '…'}
                    </Box>
                </a>
            </Box>



        </Box>
    );
};

export default AboutMe;
