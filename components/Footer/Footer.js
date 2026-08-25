import { Box } from '@mui/material';
import { rubikFont } from '../../lib/fonts';

/**
 * The two-line footer.
 *
 * The second line — "Web Design Idea - Brittany Chiang" — needs three things and
 * `Profile` gives it two, so a reading had to be chosen. `attributionLabel` is
 * treated as the **link text** and `attributionUrl` as its target, leaving the
 * words "Web Design Idea" as static prose here.
 *
 * That split is deliberate rather than a shortcut: the person's name and their
 * URL are the content, and they are what would change if the credit ever moved.
 * "Web Design Idea" describes the relationship between this site and that link,
 * which is not editorial. Making it editable would mean a migration for one
 * string that has never needed changing — and the alternative reading, where
 * `attributionLabel` holds the prefix, leaves the name with nowhere to live at
 * all.
 *
 * The line is omitted entirely when either field is empty, rather than rendering
 * a dangling "Web Design Idea -".
 */
const Footer = ({ profile }) => {
    const credit = profile?.footerCredit;
    const attributionLabel = profile?.attributionLabel;
    const attributionUrl = profile?.attributionUrl;

    return (
        <Box className='flex flex-col justify-center items-center mb-6'>
            {credit ? (
                <Box className={`text-[#d2d2d2] text-xs hover:text-[#7a61ff] cursor-default ${rubikFont.className}`}>
                    {credit}
                </Box>
            ) : null}
            {attributionLabel && attributionUrl ? (
                <Box className={`text-[#d2d2d2] text-xs cursor-default ${rubikFont.className}`}>
                    Web Design Idea - <a href={attributionUrl} target="_blank" rel="noreferrer" className="pointer text-[#64ffda]">{attributionLabel}</a>
                </Box>
            ) : null}
        </Box>
    );
};

export default Footer;
