import { Box } from '@mui/material';
import Link from 'next/link';
import React from 'react';
import { useState } from "react";
import AOS from 'aos';
import 'aos/dist/aos.css';
import { useEffect } from 'react';

const Header = () => {
    const [navbar, setNavbar] = useState(false);
    useEffect(() => {
        AOS.init();
    }, [])

    return (
        <nav className="w-full bg-[#141e30] md:pt-0 shadow" data-aos="fade-down" data-aos-easing="ease-in-out" data-aos-duration="1000" data-aos-delay="50" data-aos-once="true">
            <div className="justify-between px-4 mx-auto lg:max-w-7xl md:items-center md:flex md:px-8">
                <div>
                    <div className="flex items-center justify-between py-3 md:py-5 md:block">
                        <a href="/">
                            <Box>
                                <img src='/images/Logo.png' alt='Logo' className='' width="50px" />
                            </Box>
                        </a>
                        <div className="md:hidden">
                            <button
                                className="p-2 text-gray-700 rounded-md outline-none focus:border-gray-400 focus:border"
                                onClick={() => setNavbar(!navbar)}
                            >
                                {navbar ? (
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="w-6 h-6"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                ) : (
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="w-6 h-6"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M4 6h16M4 12h16M4 18h16"
                                        />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
                <div>
                    <div
                        className={`flex-1 justify-self-center pb-3 mt-8 md:block md:pb-0 md:mt-0 ${navbar ? "block" : "hidden"
                            }`}
                    >
                        <ul className="items-center justify-center space-y-8 md:flex md:space-x-6 md:space-y-0 font-semibold">
                            <li className="text-gray-600 hover:text-[#7a61ff] my-2">
                                <a href="#about"><span className='text-[#7a61ff]'>00.</span> About</a>
                            </li>
                            {/* <li className="text-gray-600 hover:text-blue-600">
                            <a href="javascript:void(0)">Blog</a>
                        </li> */}
                            <li className="text-gray-600 hover:text-[#7a61ff] my-2">
                                <a href="#exp"><span className='text-[#7a61ff]'>01.</span> Experience</a>
                            </li>
                            <li className="text-gray-600 hover:text-[#7a61ff] my-2">
                                <a href="#project"><span className='text-[#7a61ff]'>10.</span> Work</a>
                            </li>
                            <li className="text-gray-600 hover:text-[#7a61ff] my-2">
                                <a href="#contact"><span className='text-[#7a61ff]'>11.</span> Contact</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Header;