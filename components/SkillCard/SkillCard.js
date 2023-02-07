import { Box, Typography } from '@mui/material';
import React from 'react';

const SkillCard = ({name}) => {
    return (
        <Box className='border-2 text-[#d6d6d6] rounded border-[#d6d6d6] mx-1 mb-3 hover:border-[#7a61ff] hover:text-[#7a61ff] cursor-pointer transform transition duration-500'>
            <Typography variant='subtitle2' className='font-semibold px-2 '>
                {name}
            </Typography>
        </Box>
    );
};

export default SkillCard;