import { Box, Typography } from '@mui/material';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { useEffect } from 'react';
import { rubikFont } from '../../lib/fonts';
import { socialIcon } from '../SocialMediaLinks/socialIcons';

/**
 * The closing contact block.
 *
 * This is the section that needs both halves of a `SectionCopy` row: the small
 * accent line reads `{numberLabel} {navLabel}` — "11. Contact" — while the large
 * heading below it reads `{heading}` — "Get In Touch". Every other section uses
 * only one of the two, which is why the model carries both.
 *
 * The icon row here is the mobile counterpart to the desktop rail in
 * `SocialMediaLinks`: same rows, same lookup, different styling. It shows each
 * platform's colour outright rather than on hover, since there is no hover on a
 * touchscreen.
 */
const Contact = ({ links = [], profile, section }) => {
    useEffect(() => {
        AOS.init();
      }, [])

    const email = profile?.publicEmail;

    return (
        <Box className='py-10 mt-10 flex flex-col justify-center items-center mb-8' id={section?.anchor || 'contact'} data-aos="fade-down" data-aos-easing="ease-in-out" data-aos-duration="1000" data-aos-delay="50" data-aos-once="true">
            <Box className='flex flex-col justify-center items-center'>
                <Typography variant='subtitle1' className='font-semibold text-[#7a61ff] py-4'>
                    <span className='text-[#7a61ff]'>{section?.numberLabel || '11.'} </span> {section?.navLabel || 'Contact'}
                </Typography>
                <Typography variant='h2' className='font-semibold text-[#d2d2d2] hidden md:block'>
                    {section?.heading || 'Get In Touch'}
                </Typography>
                <Typography variant='h3' className='font-semibold text-[#d2d2d2] md:hidden'>
                    {section?.heading || 'Get In Touch'}
                </Typography>
            </Box>
            <Box className='mt-6'>
                <Typography variant='subtitle1' className={`font-[600] text-[#d2d2d2] ${rubikFont.className}`}>
                    {section?.subheading || 'Feel free to contact me anytime.'}
                </Typography>
                {email ? (
                    <Box className={`flex justify-center my-12 ${rubikFont.className}`}>
                        <a href={`mailto:${email}`} className='transform transition duration-500 border-2 border-[#7a61ff] py-2 px-6 my-4 font-semibold text-[#7a61ff] hover:text-[#000] hover:bg-[#7a61ff] normal-case'>
                            Say Hello
                        </a>
                    </Box>
                ) : null}
                <Box className='md:hidden'>
                    <ul className='list-none flex justify-center'>
                        {links.map((link, i) => {
                            const { Icon, colorClass } = socialIcon(link.iconKey);
                            const spacing = i === links.length - 1 ? 'mb-4' : 'mb-2';

                            return (
                                <li key={link.id}>
                                    <a className="active" href={link.url} target="_blank" rel="noreferrer" aria-label={link.label}>
                                        <Icon className={`text-4xl mx-4 ${spacing} ${colorClass}`} />
                                    </a>
                                </li>
                            );
                        })}
                    </ul>
                </Box>
            </Box>
        </Box>
    );
};

export default Contact;
