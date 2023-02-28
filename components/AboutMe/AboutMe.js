import { Box, Typography } from '@mui/material';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { skills } from '../../data/skills';
import SkillCard from '../SkillCard/SkillCard';
import Popover from '@mui/material/Popover';
import AOS from 'aos';
import 'aos/dist/aos.css';


const AboutMe = () => {
    const [data, setData] = useState();
    const [anchorEl, setAnchorEl] = useState(null);
    useEffect(() => {
        fetch('https://leetcode-stats-api.herokuapp.com/greeed', {
            method: 'GET'
        })
            .then(response => response.json())
            .then(data => {
                setData(data);
            });
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
                        To pursue a challenging and rewarding career as a Software Engineer, utilizing my expertise in software
                        design and development, to contribute to the success of a dynamic organization by delivering innovative and
                        high-quality software solutions that meet the evolving needs of the business and its customers. Committed to
                        continuously learning and staying updated with the latest technologies and industry trends to deliver cutting edge software solutions
                    </Typography>
                    <Box className='md:pl-4'>
                        <ul className='list-disc'>
                            <li>
                                <Typography variant='subtitle2' className='pt-6'>
                                    Completed UnderGraduation, Bachelor's in <span className='text-[#7a61ff] font-semibold'>Computer Science and Engineering</span> from <span className='text-[#7a61ff] font-semibold'>BRAC University</span>.
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
                <Box className='flex justify-center items-center mt-8 md:mt-0'>
                    <Box className='transform transition duration-500 border-4 border-[#7a61ff] hover:border-[#fff] p-3 rounded '>
                        <img src='/images/pic.webp' alt='ProfilePicture' className='rounded' width={300} />
                    </Box>
                </Box>
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
                        <Typography sx={{ p: 1 }}>It ain't much, but it's honest work. Click on the number and View my LeetCode Profile.</Typography>
                    </Popover>
                </Box>
                <Link href='https://leetcode.com/Greeed/' target='_blank'>
                    <Box className='border-4 border-[#fff] rounded-full w-min py-2 px-3 text-[#7a61ff] font-semibold text-xl hover:border-[#7a61ff] hover:text-[#7a61ff] cursor-pointer transform transition duration-500'>
                        {data && data.totalSolved}
                    </Box>
                </Link>
            </Box>



        </Box>
    );
};

export default AboutMe;