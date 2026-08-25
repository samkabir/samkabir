import { Box } from '@mui/material';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import AOS from 'aos';
import 'aos/dist/aos.css';

/**
 * The nav, built from `SectionCopy` rows rather than four hardcoded `<li>`s.
 *
 * The numbering and labels used to live in two places at once — here and in each
 * section component — so renumbering meant editing both files and hoping they
 * agreed. `lib/content.js` derives this list from the same rows the sections read,
 * and drops any row without an anchor so a half-filled dashboard form cannot
 * produce a link to nowhere.
 *
 * `sections` defaults to `[]` rather than to the old hardcoded list: an empty nav
 * on an unseeded database is obviously empty, whereas a fallback list would look
 * correct while linking to sections that are not there.
 */
const Header = ({ sections = [] }) => {
    const [navbar, setNavbar] = useState(false);
    useEffect(() => {
        AOS.init();
    }, [])

    return (
        <nav className="w-full bg-[#141e30] md:pt-0 shadow" data-aos="fade-down" data-aos-easing="ease-in-out" data-aos-duration="1000" data-aos-delay="50" data-aos-once="true">
            <div className="justify-between px-4 mx-auto lg:max-w-7xl md:items-center md:flex md:px-8">
                <div>
                    <div className="flex items-center justify-between py-3 md:py-5 md:block">
                        <Link href="/">
                            <Box>
                                {/* Intrinsic size 342×262, rendered at 50px wide. Passing both
                                    lets the browser reserve the right box before the file
                                    arrives, which is what the plain <img> could not do. */}
                                <Image
                                    src="/images/Logo.png"
                                    alt="Logo"
                                    width={342}
                                    height={262}
                                    priority
                                    style={{ width: '50px', height: 'auto' }}
                                />
                            </Box>
                        </Link>
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
                            {sections.map((section) => (
                                <li key={section.key} className="text-gray-600 hover:text-[#7a61ff] my-2">
                                    <a href={`#${section.anchor}`}>
                                        <span className='text-[#7a61ff]'>{section.numberLabel}</span> {section.label}
                                    </a>
                                </li>
                            ))}
                            {/* <li className="text-gray-600 hover:text-blue-600">
                            <a href="javascript:void(0)">Blog</a>
                        </li> */}
                        </ul>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Header;
