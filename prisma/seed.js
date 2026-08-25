import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

const cuid = createId;

const prisma = new PrismaClient();

// Timeline parser: handles both U+002D (hyphen) and U+2013 (en dash)
function parseTimeline(timelineStr, recordIdentifier) {
  const parts = timelineStr.split(/\s*[-–—]\s*/);
  if (parts.length !== 2) {
    throw new Error(`Invalid timeline format in ${recordIdentifier}: "${timelineStr}"`);
  }

  const [startStr, endStr] = parts;
  const startDate = parseMonthYear(startStr.trim(), recordIdentifier);

  let isCurrent = false;
  let endDate = null;

  if (endStr.toLowerCase() === 'present') {
    isCurrent = true;
  } else {
    endDate = parseMonthYear(endStr.trim(), recordIdentifier);
  }

  return { startDate, endDate, isCurrent, timelineOverride: null };
}

function parseMonthYear(str, recordIdentifier) {
  const months = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  };

  const parts = str.trim().split(/\s+/);
  if (parts.length !== 2) {
    throw new Error(`Invalid month-year format in ${recordIdentifier}: "${str}"`);
  }

  const month = months[parts[0].toLowerCase()];
  const year = parseInt(parts[1], 10);

  if (!month || isNaN(year)) {
    throw new Error(`Invalid month or year in ${recordIdentifier}: "${str}"`);
  }

  // First day of the month at UTC noon
  return new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
}

// Data imports (simulated inline for clarity)
const skillsData = [
  'Next JS', 'React JS', 'Node JS', 'JavaScript', 'MongoDB', 'Express JS', 'Django DRF', 'Git', 'HTML', 'CSS',
  'BootStrap', 'Tailwind', 'Material UI', 'REST API', 'React Router', 'Java', 'MySQL', 'Python', 'ES6'
];

const experienceData = [
  {
    job_position: 'Software Engineer (Frontend Focused)',
    company_name: 'Zavisoft Limited, Concern of Steadfast Limited',
    timeline: 'July 2025 - Present',
    responsibilities: [
      'Developed and maintained two major repositories: Packly Marketplace and Merchant IMS, ensuring high performance, scalability, and code quality.',
      'Built and delivered two additional frontend products: Packly Car Rental Marketplace and Merchant Panel, managing development from implementation to deployment.',
      'Led and mentored two junior frontend developers and interns, coordinating tasks and ensuring timely delivery of project milestones.',
      'Collaborated closely with backend developers, designers, and product stakeholders to implement features and enhance overall user experience.',
    ],
  },
  {
    job_position: 'Software Engineer',
    company_name: 'Queries AI',
    timeline: 'May 2023 – June 2024',
    responsibilities: ['Developed and maintained key features for SaaS applications using React JS.','Maintain and develop various features of SaaS and Admin frontend repository.', 'Develop and maintain a documents generator repository (JSON to PDF/CSV).', 'Work on product features and various microservices of SaaS application.'],
  },
  {
    job_position: 'Manual Tester / QA Engineer',
    company_name: 'Stealth US Digital Health Company',
    timeline: 'October 2022 – April 2023',
    responsibilities: ['Collaborated with developers and product teams to ensure a polished user interface (UI) and seamless user experience (UX).','Conducted rigorous testing to identify and resolve critical bugs, enhancing the overall functionality of web applications.', 'Provided actionable feedback on UI/UX design and frontend workflows to improve user engagement.', 'Documented detailed test cases and debugging processes, strengthening problem-solving and attention-to-detail skills.', ' Collaborated with the product team, including the CEO, and developers daily to ensure requirements were being met.', 'Gained hands-on experience with end-to-end testing protocols, enhancing the ability to debug andoptimize frontend applications.'],
  },
  {
    job_position: 'Junior Software Engineer',
    company_name: 'BhaloVentures Limited - Bhalogari.com',
    timeline: 'February 2022 – September 2022',
    responsibilities: ['Implemented dynamic features like Bangladesh Map Search, Search AutoComplete, and Car Comparison Pages using React and Next.js.', 'Designed and developed dashboards for users and merchants, along with profile editing modules.', 'Performed bug fixes and optimized performance for various applications.'],
  },
  {
    job_position: 'Internship',
    company_name: 'BhaloVentures Limited - Bhalogari.com',
    timeline: 'November 2021 – January 2022',
    responsibilities: ['Contributed to back-end API development using Django Rest Framework (DRF) and integrated EMI calculators', 'Fixed minor bugs and refined CSS for responsive design.'],
  },
];

const contractualExperiencesData = [
  {
    job_position: 'Senior Frontend Engineer (Consulting project under NDA)',
    company_name: 'A Food Delivery Startup',
    timeline: 'July 2024 – September 2024',
    responsibilities: ['Spearheaded frontend development for user, merchant, and admin dashboards.', 'Delivered critical features, including user authentication, dashboard analytics, and merchant management tools using React.js and Next.js.', 'Collaborated with cross-functional teams to design scalable architectures and ensure timely delivery of features.', 'Enhanced communication skills by working directly with stakeholders to prioritize and refine deliverables'],
  },
  {
    job_position: 'Frontend Developer (Consulting project under NDA)',
    company_name: 'Online Casino Company',
    timeline: 'May 2023 – June 2024',
    responsibilities: ['Designed and developed 7 blog websites with multiple routes to support SEO strategies, using React (2 projects) and Next JS (5 projects).', 'Implemented modern responsive designs, optimized for performance and search engine visibility (SSR).', 'Collaborated with clients to refine requirements, ensuring seamless integration of SEO practices with functional designs.', 'Gained expertise in building scalable, maintainable front-end architectures while managing multiple projects simultaneously.'],
  },
];

const projectsData = [
  {
    name: 'Shades Sunglases',
    slug: 'shades-sunglasses',
    github: 'https://github.com/samkabir/Shades-Sunglasses-ReactJS-Client-Side',
    liveUrl: 'https://shades-sunglasses.web.app/',
    description: 'This Website has 45 Routes, 1 home, 2 private, 1 login, 1 detail(for each product). Purchase and DashBoard and its sub Routes are Private. DashBoard has Two type of access, one is User level access and one is admin level access.',
    stacks: ['React JS', 'Node JS', 'Mongo DB', 'Express JS', 'Material UI', 'Bootstrap', 'React Router'],
    isFeatured: true,
    image: '/images/projects/project1/1.webp',
    isNda: false,
  },
  {
    name: 'Evanto Tourism',
    slug: 'evanto-tourism',
    github: 'https://github.com/samkabir/React-JS-Tourism-Client-Side',
    liveUrl: 'https://assignment11-tourism-react.web.app/',
    description: 'This Website has 7 Routes, 1 home, 3 private, 1 login, 1 detail(for each service) and 1 404 page. My Bookings, Manage All Bookings and Add a Tour Plan Routes are Private. The website has one login system - Google SignIn.',
    stacks: ['React JS', 'Node JS', 'Mongo DB', 'Express JS', 'Material UI', 'Tailwind', 'React Router'],
    isFeatured: true,
    image: '/images/projects/project2/1.webp',
    isNda: false,
  },
  {
    name: 'Optima Diagnostic',
    slug: 'optima-diagnostic',
    github: 'https://github.com/samkabir/React-JS-Front-End-Optima-Diagonostic-Center',
    liveUrl: 'https://assignment10-doctors-react.web.app/',
    description: 'This Website has 6 Routes, 1 home, 2 private, 1 login, 1 detail(for each service) and 1 404 page. The website has two login system, one Google SignIn and a Email and Password SignIn. The Website has Home, About, Appointment, Login and Details of the services pages.',
    stacks: ['React JS', 'Node JS', 'Material UI', 'Bootstrap', 'React Router'],
    isFeatured: true,
    image: '/images/projects/project3/1.webp',
    isNda: false,
  },
  {
    name: 'BariKoi Map Search Page',
    slug: 'barikoi-map-search',
    github: 'https://github.com/samkabir/barikoi',
    liveUrl: 'https://barikoi.vercel.app/',
    description: 'This is a simple Project for a competition. *Due to NDA, github repo has been made private, but can be made public upon request.',
    stacks: ['Next JS', 'React-Map-GL', 'Material UI', 'tailwind', 'React Router'],
    isFeatured: false,
    image: '/images/projects/barikoi/1.PNG',
    isNda: true,
  },
  {
    name: 'Honest Elite',
    slug: 'honest-elite',
    github: 'https://github.com/samkabir/NextjsProject',
    liveUrl: 'https://nextjs-project-samkabir.vercel.app/home',
    description: 'This is a simple Project for a competition. *Due to NDA, github repo has been made private, but can be made public upon request.',
    stacks: ['React JS', 'React-Map-GL', 'Material UI', 'tailwind', 'React Router'],
    isFeatured: false,
    image: '/images/projects/honestelite/1.PNG',
    isNda: true,
  },
  {
    name: 'Food Network Static Page',
    slug: 'food-network-static',
    github: 'https://github.com/samkabir/Simple-HTML-CSS-Food-Network-Page',
    liveUrl: 'https://samkabir.github.io/Simple-HTML-CSS-Food-Network-Page/',
    description: '',
    stacks: ['PSD to HTML', 'Bootstrap'],
    isFeatured: false,
    image: '/images/projects/foodnetwork/1.PNG',
    isNda: false,
  },
  {
    name: 'Music Static Landing Page',
    slug: 'music-landing-page',
    github: 'https://github.com/samkabir/Music-Bootstrap',
    liveUrl: 'https://samkabir.github.io/Music-Bootstrap/',
    description: 'This is a Simple Static Landing Page',
    stacks: ['PSD to HTML', 'Bootstrap'],
    isFeatured: false,
    image: '/images/projects/music/1.PNG',
    isNda: false,
  },
  {
    name: 'Mache Static Landing Page',
    slug: 'mache-landing-page',
    github: 'https://github.com/samkabir/Mache-Bootstrap',
    liveUrl: 'https://samkabir.github.io/Mache-Bootstrap/',
    description: 'This is a Simple Static Landing Page',
    stacks: ['PSD to HTML', 'Bootstrap'],
    isFeatured: false,
    image: '/images/projects/Mache/1.PNG',
    isNda: false,
  },
  {
    name: 'Simple Static Login Page',
    slug: 'static-login-page',
    github: 'https://github.com/samkabir/Login-Page',
    liveUrl: 'https://samkabir.github.io/Login-Page/',
    description: 'This is a Simple Static Landing Page',
    stacks: ['PSD to HTML', 'Bootstrap'],
    isFeatured: false,
    image: '/images/projects/loginpage/1.PNG',
    isNda: false,
  },
  {
    name: 'Quiz Scoring Site',
    slug: 'quiz-scoring-site',
    github: 'https://github.com/samkabir/itechsoft',
    liveUrl: 'https://itechsoft.vercel.app/',
    description: 'This is a simple Project for a competition. *Due to NDA, github repo has been made private, but can be made public upon request.',
    stacks: ['React JS', 'React-Map-GL', 'Material UI', 'tailwind', 'React Router'],
    isFeatured: false,
    image: '/images/projects/itechsoft/1.PNG',
    isNda: true,
  },
  {
    name: 'Open Library Search Page',
    slug: 'open-library-search',
    github: 'https://github.com/samkabir/JS-API-Book-Archive',
    liveUrl: 'https://samkabir-openlibrary-apijs.netlify.app/',
    description: '',
    stacks: ['React JS', 'REST API', 'Material UI', 'Tailwind'],
    isFeatured: false,
    image: '/images/projects/openlibrary/1.PNG',
    isNda: false,
  },
  {
    name: 'FakeStore Using Rest API',
    slug: 'fakestore-rest-api',
    github: 'https://github.com/samkabir/JS-Debugging-Ranga-Store',
    liveUrl: 'https://samkabir-fakestore-api.netlify.app/',
    description: '',
    stacks: ['React JS', 'REST API', 'Context API', 'Material UI', 'Tailwind'],
    isFeatured: false,
    image: '/images/projects/fakestore/1.PNG',
    isNda: false,
  },
  {
    name: 'TalkShow Event Using Context API',
    slug: 'talkshow-context-api',
    github: 'https://github.com/samkabir/React-JS-Talk-Show-Event',
    liveUrl: 'https://samkabir-react-spa-talkshowevent.netlify.app/',
    description: '',
    stacks: ['React JS', 'REST API', 'Context API', 'Material UI', 'Tailwind'],
    isFeatured: false,
    image: '/images/projects/talkshow/1.PNG',
    isNda: false,
  },
  {
    name: 'Static Math Academy',
    slug: 'static-math-academy',
    github: 'https://github.com/samkabir/React-JS-Router-Math-Academy',
    liveUrl: 'https://samkabir-react-mathacademy.netlify.app/',
    description: '',
    stacks: ['React JS', 'Material UI', 'tailwind', 'React Router'],
    isFeatured: false,
    image: '/images/projects/mathacademy/1.PNG',
    isNda: false,
  },
  {
    name: 'Honda CBR BootStrap',
    slug: 'honda-cbr-bootstrap',
    github: 'https://github.com/samkabir/Simple-Honda-CBR-Bootstrap',
    liveUrl: 'https://samkabir.github.io/Simple-Honda-CBR-Bootstrap/',
    description: '',
    stacks: ['PSD to HTML', 'Bootstrap', 'Responsive'],
    isFeatured: false,
    image: '/images/projects/honda/1.PNG',
    isNda: false,
  },
  {
    name: 'Responsive Football Static Page',
    slug: 'responsive-football',
    github: 'https://github.com/samkabir/Responsive-Football',
    liveUrl: 'https://samkabir.github.io/Responsive-Football/index.html',
    description: '',
    stacks: ['PSD to HTML', 'Bootstrap', 'Responsive'],
    isFeatured: false,
    image: '/images/projects/football/1.PNG',
    isNda: false,
  },
];

// NDA projects to import as drafts (confirm with user before uncommenting)
const ndaProjectsData = [
  {
    name: 'CasinoBlogs',
    slug: 'casino-blogs',
    github: 'https://github.com/samkabir/CasinoFive',
    liveUrl: 'https://casino-five-one.vercel.app/',
    description: 'This is a Live Project that has been deployed. *Due to NDA, github repo has been made private, but can be made public upon request.',
    stacks: ['Next JS', 'Material UI', 'Tailwind', 'React Router'],
    isFeatured: false,
    image: '/images/projects/CasinoBlogs/2.webp',
    isNda: true,
    status: 'DRAFT',
  },
  {
    name: 'Gambling Coin',
    slug: 'gambling-coin',
    github: 'https://github.com/samkabir/Simple-React-App',
    liveUrl: 'https://gamblingcoin.vercel.app/',
    description: 'This is a Live Project that has been deployed. *Due to NDA, github repo has been made private, but can be made public upon request.',
    stacks: ['Next JS', 'Material UI', 'Tailwind', 'React Router'],
    isFeatured: false,
    image: '/images/projects/gamblingcoin/1.PNG',
    isNda: true,
    status: 'DRAFT',
  },
  {
    name: 'Casino Hubs',
    slug: 'casino-hubs',
    github: 'https://github.com/samkabir/Casinothree',
    liveUrl: 'https://www.casinohubs.online/',
    description: 'This is a Live Project that has been deployed. *Due to NDA, github repo has been made private, but can be made public upon request.',
    stacks: ['Next JS', 'Material UI', 'Tailwind', 'React Router'],
    isFeatured: false,
    image: '/images/projects/casinohubs/1.PNG',
    isNda: true,
    status: 'DRAFT',
  },
];

async function seed() {
  try {
    const args = process.argv.slice(2);
    const shouldReset = args.includes('--reset');

    console.log('🌱 Starting seed...');

    // Profile (singleton)
    console.log('📝 Seeding Profile...');
    await prisma.profile.upsert({
      where: { id: 'singleton' },
      update: {},
      create: {
        id: 'singleton',
        fullName: 'Samiul Kabir',
        greeting: 'Hi, This is',
        headline: 'I Forge Web Designs for the Digital space.',
        bio: 'To secure a challenging position as a Frontend Engineer where I can utilize my expertise in building scalable, high-quality web applications, while leveraging my proficiency in React, Next.js, and software development to contribute to innovative and impactful solutions.',
        publicEmail: 'samkabir26@gmail.com',
        contactEmail: 'samkabir26@gmail.com',
        leetcodeUsername: 'Greeed',
        showLeetcode: true,
        footerCredit: 'Designed & Built By Samiul Kabir',
        attributionLabel: 'Web Design Idea',
        attributionUrl: 'https://brittanychiang.com/',
      },
    });

    // SEO Settings (singleton)
    console.log('🔍 Seeding SEO Settings...');
    await prisma.seoSettings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: {
        id: 'singleton',
        siteTitle: 'Samiul Kabir',
        defaultDescription: 'Portfolio Website of Samiul Kabir',
        canonicalUrl: 'https://samkabir.com',
        twitterHandle: '@samkabir',
      },
    });

    // Skills
    console.log('💡 Seeding Skills...');
    for (let i = 0; i < skillsData.length; i++) {
      await prisma.skill.upsert({
        where: { name: skillsData[i] },
        update: { order: i, status: 'PUBLISHED' },
        create: {
          id: cuid(),
          name: skillsData[i],
          order: i,
          status: 'PUBLISHED',
        },
      });
    }

    // Education — no natural key, so skip unless --reset
    console.log('🎓 Seeding Education...');
    const educationData = [
      {
        institution: 'BRAC University',
        degree: "Bachelor's",
        field: 'Computer Science and Engineering',
        note: null,
        startYear: null,
        endYear: null,
      },
      {
        institution: 'Pearson Edexcel Education',
        degree: 'O and A Levels',
        field: null,
        note: null,
        startYear: null,
        endYear: null,
      },
    ];

    const existingEducation = await prisma.education.count();
    if (shouldReset && existingEducation > 0) {
      await prisma.education.deleteMany({});
      console.log('  ↻ Cleared existing education entries (--reset flag)');
    }

    if (existingEducation === 0 || shouldReset) {
      for (let i = 0; i < educationData.length; i++) {
        await prisma.education.create({
          data: {
            id: cuid(),
            ...educationData[i],
            order: i,
            status: 'PUBLISHED',
          },
        });
      }
    } else {
      console.log('  ⊘ Skipping education (rows exist; use --reset to replace)');
    }

    // Experience — no natural key, so skip unless --reset
    const existingExperience = await prisma.experience.count();
    if (shouldReset && existingExperience > 0) {
      await prisma.experience.deleteMany({});
      console.log('  ↻ Cleared existing experiences (--reset flag)');
    }

    if (existingExperience === 0 || shouldReset) {
      console.log('💼 Seeding Full-time Experiences...');
      for (let i = 0; i < experienceData.length; i++) {
        const exp = experienceData[i];
        const timeline = parseTimeline(exp.timeline, `Experience[${i}]: ${exp.job_position}`);
        await prisma.experience.create({
          data: {
            id: cuid(),
            kind: 'FULL_TIME',
            jobPosition: exp.job_position,
            companyName: exp.company_name,
            responsibilities: exp.responsibilities,
            isNda: false,
            startDate: timeline.startDate,
            endDate: timeline.endDate,
            isCurrent: timeline.isCurrent,
            timelineOverride: timeline.timelineOverride,
            order: i,
            status: 'PUBLISHED',
          },
        });
      }

      console.log('🤝 Seeding Contractual Experiences...');
      for (let i = 0; i < contractualExperiencesData.length; i++) {
        const exp = contractualExperiencesData[i];
        const timeline = parseTimeline(exp.timeline, `Contractual[${i}]: ${exp.job_position}`);
        await prisma.experience.create({
          data: {
            id: cuid(),
            kind: 'CONTRACT',
            jobPosition: exp.job_position,
            companyName: exp.company_name,
            responsibilities: exp.responsibilities,
            isNda: true,
            startDate: timeline.startDate,
            endDate: timeline.endDate,
            isCurrent: timeline.isCurrent,
            timelineOverride: timeline.timelineOverride,
            order: i,
            status: 'PUBLISHED',
          },
        });
      }
    } else {
      console.log('  ⊘ Skipping experiences (rows exist; use --reset to replace)');
    }

    // Projects
    console.log('🚀 Seeding Projects...');
    for (let i = 0; i < projectsData.length; i++) {
      const proj = projectsData[i];
      await prisma.project.upsert({
        where: { slug: proj.slug },
        update: { order: i, status: 'PUBLISHED', isFeatured: proj.isFeatured },
        create: {
          id: cuid(),
          slug: proj.slug,
          title: proj.name,
          description: proj.description,
          repoUrl: proj.github,
          liveUrl: proj.liveUrl,
          stacks: proj.stacks,
          isFeatured: proj.isFeatured,
          isNda: proj.isNda,
          order: i,
          status: 'PUBLISHED',
        },
      });
    }

    // Social Links — upsert via findUnique on url (store URL as unique proxy)
    console.log('🔗 Seeding Social Links...');
    const socialLinksData = [
      {
        platform: 'LinkedIn',
        label: 'LinkedIn',
        url: 'https://www.linkedin.com/in/samkabir/',
        iconKey: 'linkedin',
        showInSidebar: true,
        showInContact: true,
      },
      {
        platform: 'GitHub',
        label: 'GitHub',
        url: 'https://github.com/samkabir',
        iconKey: 'github',
        showInSidebar: true,
        showInContact: true,
      },
      {
        platform: 'Facebook',
        label: 'Facebook',
        url: 'https://www.facebook.com/fahim.kabir.5/',
        iconKey: 'facebook',
        showInSidebar: true,
        showInContact: true,
      },
    ];

    for (let i = 0; i < socialLinksData.length; i++) {
      const link = socialLinksData[i];
      const existing = await prisma.socialLink.findFirst({
        where: { url: link.url },
      });

      if (existing) {
        await prisma.socialLink.update({
          where: { id: existing.id },
          data: {
            order: i,
            status: 'PUBLISHED',
            showInSidebar: link.showInSidebar,
            showInContact: link.showInContact,
          },
        });
      } else {
        await prisma.socialLink.create({
          data: {
            id: cuid(),
            ...link,
            order: i,
            status: 'PUBLISHED',
          },
        });
      }
    }

    // Section Copy
    console.log('📄 Seeding Section Copy...');
    const sectionCopyData = [
      {
        key: 'about',
        numberLabel: '00.',
        heading: 'About Me',
        navLabel: 'About',
        anchor: 'about',
        showInNav: true,
        order: 0,
      },
      {
        key: 'skills',
        numberLabel: '00.0',
        heading: 'Skill Stack',
        navLabel: null,
        anchor: null,
        showInNav: false,
        order: 1,
      },
      {
        key: 'experience',
        numberLabel: '01.',
        heading: 'Job Experiences',
        navLabel: 'Experience',
        anchor: 'exp',
        showInNav: true,
        order: 2,
      },
      {
        key: 'contractual',
        numberLabel: '01.0',
        heading: 'Contractual Experiences',
        navLabel: null,
        anchor: null,
        showInNav: false,
        order: 3,
      },
      {
        key: 'projects',
        numberLabel: '10.',
        heading: 'Some Projects I worked on...',
        navLabel: 'Work',
        anchor: 'project',
        showInNav: true,
        order: 4,
      },
      {
        key: 'contact',
        numberLabel: '11.',
        heading: 'Get In Touch',
        subheading: 'Feel free to contact me anytime.',
        navLabel: 'Contact',
        anchor: 'contact',
        showInNav: true,
        order: 5,
      },
    ];

    for (const section of sectionCopyData) {
      await prisma.sectionCopy.upsert({
        where: { key: section.key },
        update: {
          numberLabel: section.numberLabel,
          heading: section.heading,
          navLabel: section.navLabel,
          anchor: section.anchor,
          subheading: section.subheading || null,
          showInNav: section.showInNav,
          order: section.order,
        },
        create: {
          id: cuid(),
          key: section.key,
          numberLabel: section.numberLabel,
          heading: section.heading,
          navLabel: section.navLabel,
          anchor: section.anchor,
          subheading: section.subheading || null,
          showInNav: section.showInNav,
          order: section.order,
        },
      });
    }

    console.log('✨ Seed completed successfully!');
    console.log('📊 Summary:');
    console.log(`  - 1 Profile`);
    console.log(`  - 1 SEO Settings`);
    console.log(`  - ${skillsData.length} Skills`);
    console.log(`  - ${educationData.length} Education entries`);
    console.log(`  - ${experienceData.length} Full-time experiences`);
    console.log(`  - ${contractualExperiencesData.length} Contractual experiences`);
    console.log(`  - ${projectsData.length} Published projects`);
    console.log(`  - ${socialLinksData.length} Social links`);
    console.log(`  - ${sectionCopyData.length} Section copy entries`);
    console.log('\n💡 Note: The 3 NDA projects are available in ndaProjectsData but commented out.');
    console.log('   Run with --import-nda flag or manually import them as DRAFT projects.');
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed();
