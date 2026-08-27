import { Box } from '@mui/material'
import AOS from 'aos';
import 'aos/dist/aos.css';
import { useEffect } from 'react';
import { socialIcon } from './socialIcons';

/**
 * The fixed rail of social icons, and the rotated email address opposite it.
 *
 * Desktop only (`hidden md:block`) — `Contact` renders the same links for narrow
 * screens, which is why both flags exist on the row rather than one list being
 * derived from the other.
 *
 * The last icon carries `mb-4` where the others carry `mb-2`, giving the stack a
 * little breathing room above the bottom of the rail. That was hardcoded on the
 * third of three `<a>` tags; with a mapped list it becomes a check for the last
 * index, which keeps the spacing correct however many links there are.
 */
const SocialMediaLinks = ({ links = [], email }) => {
    useEffect(() => {
        AOS.init();
      }, [])
    return (
        <div className='hidden md:block' data-aos="fade-down" data-aos-easing="ease-in-out" data-aos-duration="1000" data-aos-delay="50" data-aos-once="true">
            <Box>
                <ul className='list-none m-0 p-0 fixed overflow-auto bottom-36 left-8'>
                    {links.map((link, i) => {
                        const { Icon, hoverClass } = socialIcon(link.iconKey);
                        const spacing = i === links.length - 1 ? 'mb-4' : 'mb-2';

                        return (
                            <li key={link.id}>
                                <a className="active" href={link.url} target="_blank" rel="noreferrer" aria-label={link.label}>
                                    <Icon className={`text-4xl ${spacing} ${hoverClass} transform transition duration-500 hover:text-[40px]`} />
                                </a>
                            </li>
                        );
                    })}
                </ul>
            </Box>
            {email ? (
                <Box>
                    <ul className='list-none m-0 p-0 fixed bottom-36 right-0'>
                        <li className="rotate-90 font-semibold text-[#5845c4]" ><a href={`mailto:${email}`}>{email}</a></li>
                    </ul>
                </Box>
            ) : null}
        </div>
    );
};

export default SocialMediaLinks;
