import { Box, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import AOS from 'aos';
import 'aos/dist/aos.css';

function TabPanel(props) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`vertical-tabpanel-${index}`}
            aria-labelledby={`vertical-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ p: 3 }}>
                    <Box>{children}</Box>
                </Box>
            )}
        </div>
    );
}

TabPanel.propTypes = {
    children: PropTypes.node,
    index: PropTypes.number.isRequired,
    value: PropTypes.number.isRequired,
};

function a11yProps(index) {
    return {
        id: `vertical-tab-${index}`,
        'aria-controls': `vertical-tabpanel-${index}`,
    };
}

/**
 * Permanent roles, from the database.
 *
 * `timeline` arrives as the finished string rather than as dates: `lib/content.js`
 * formats it with the same `formatTimeline` the dashboard uses, so the two cannot
 * disagree and no `Date` has to survive `getStaticProps`.
 *
 * The field names are the schema's — `jobPosition`, `companyName` — where the old
 * static file used `job_position` and `company_name`. That rename happens in the
 * read layer, so this component has one vocabulary instead of two.
 */
const Experience = ({ experiences = [], section }) => {
    const [value, setValue] = useState(0);

    useEffect(() => {
        AOS.init();
      }, [])

    const handleChange = (event, newValue) => {
        setValue(newValue);
    };
    return (
        <Box className='py-10 md:h-[500px]' id={section?.anchor || 'exp'} data-aos="fade-down" data-aos-easing="ease-in-out" data-aos-duration="1000" data-aos-delay="50" data-aos-once="true">
            <Box>
                <Typography variant='h4' className='font-semibold text-[#d2d2d2]'>
                    <span className='text-[#7a61ff]'>{section?.numberLabel || '01.'} </span> {section?.heading || 'Job Experiences'}
                </Typography>
            </Box>
            <Box className='mt-4'>
                <Box
                    sx={{ flexGrow: 1 }}
                    className='md:flex'
                >
                    <Box>
                        {/* for desktop view */}
                        <Tabs
                            orientation="vertical"
                            scrollButtons
                            allowScrollButtonsMobile
                            value={value}
                            variant="scrollable"
                            onChange={handleChange}
                            aria-label="Vertical tabs example"
                            sx={{ borderRight: 2, borderColor: 'divider' }}
                            className='hidden md:block'
                        >
                            {
                                experiences.map((e, i) => (
                                    <Tab label={e.jobPosition} key={e.id} className='text-white w-[180px] normal-case font-[600]' {...a11yProps(i)} />
                                ))
                            }
                        </Tabs>
                    </Box>
                    {/* For Mobile View */}
                    <Box sx={{ maxWidth: { xs: 320, sm: 480 } }} className='md:hidden border-2 border-black mt-2 rounded'>
                        <Tabs
                            value={value}
                            onChange={handleChange}
                            variant="scrollable"
                            scrollButtons
                            allowScrollButtonsMobile
                            aria-label="scrollable force tabs example"
                        >
                            {
                                experiences.map((e, i) => (
                                    <Tab label={e.jobPosition} key={e.id} className='text-white w-[180px] normal-case font-[600]' />
                                ))
                            }
                        </Tabs>
                    </Box>

                    {
                        experiences.map((e, i) => (
                            <TabPanel value={value} index={i} key={e.id} className='md:w-[800px]' >
                                <Box>
                                    <Box>
                                        <Typography variant='subtitle1' className='text-white font-[600]'>
                                            {e.companyName}
                                        </Typography>
                                    </Box>
                                    <Box className='pb-2'>
                                        <Typography variant='subtitle2' className='text-white font-[500] pl-4'>
                                            {e.timeline}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        {e.responsibilities && e.responsibilities.map((e, i) => (
                                            <Box className='flex pt-2' key={i}>
                                                <ArrowRightIcon className='text-white' />
                                                <Typography variant='subtitle2' className='text-white' >
                                                    {e}
                                                </Typography>
                                            </Box>
                                        ))}
                                    </Box>
                                </Box>
                            </TabPanel>

                        ))
                    }

                </Box>
            </Box>
            {/* <Box className='md:hidden'>

            </Box> */}
        </Box>
    );
};

export default Experience;
