import React from 'react';
import { Box } from '@mui/material'
import FacebookIcon from '@mui/icons-material/Facebook';
import GitHubIcon from '@mui/icons-material/GitHub';
import LinkedInIcon from '@mui/icons-material/LinkedIn';

const SocialMediaLinks = () => {
    return (
        <div className='hidden md:block'>
            <Box>
                <ul className='list-none m-0 p-0 fixed overflow-auto bottom-36 left-8'>
                    <li><a className="active" href="https://www.linkedin.com/in/samkabir/"><LinkedInIcon className="text-4xl mb-2 hover:text-[#0072b1] transform transition duration-500 hover:text-[40px]" /></a></li>
                    <li><a className="active" href="https://github.com/samkabir"><GitHubIcon className="text-4xl mb-2 hover:text-[#171515] transform transition duration-500 hover:text-[40px]" /></a></li>
                    <li><a className="active" href="https://www.facebook.com/fahim.kabir.5/"><FacebookIcon className="text-4xl mb-4 hover:text-[#3b5998] transform transition duration-500 hover:text-[40px]" /></a></li>
                </ul>
            </Box>
            <Box>
                <ul className='list-none m-0 p-0 fixed bottom-36 right-0'>
                    <li className="rotate-90 font-semibold text-[#5845c4]" ><a href="mailto:admin@gamblingco.in">samkabir26@gmail.com</a></li>
                </ul>
            </Box>
        </div>
    );
};

export default SocialMediaLinks;