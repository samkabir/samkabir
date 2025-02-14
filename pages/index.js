import Head from 'next/head'
import Image from 'next/image'
import { Inter } from '@next/font/google'
import styles from '@/styles/Home.module.css'
import Header from '@/components/Header/header'
import SocialMediaLinks from '@/components/SocialMediaLinks/SocialMediaLinks'
import AboutMe from '@/components/AboutMe/AboutMe'
import Experience from '@/components/Experience/Experience'
import DemoProjects from '@/components/DemoProjects/DemoProjects'
import Contact from '@/components/Contact/Contact'
import MainComponent from '@/components/Home/MainComponent'
import { Box } from '@mui/material'
import Footer from '@/components/Footer/Footer'
import { useEffect, useState } from 'react'
import Loading from '@/components/Loading/Loading'
import ContractualExperiences from '@/components/ContractualExperiences/ContractualExperiences'




const inter = Inter({ subsets: ['latin'] })

export default function Home() {
  // For Animation
  // https://github.com/michalsnik/aos#animations

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);
  return (
    <>
      <Head>
        <title>Samiul Kabir</title>
        <meta name="description" content="Portfolio Website of Samiul Kabir" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/images/Logo.png" />
      </Head>

      {
        loading ?
          <Loading />
          :
          <main>
            <Header />
            <SocialMediaLinks />
            <Box className='px-4 md:px-20 py-8 cursor-default'>
              <MainComponent />
              <Box className='px-4 md:px-20'>
                <AboutMe />
                <Experience />
                <ContractualExperiences />
                <DemoProjects />
                <Contact />
              </Box>
            </Box>
            <Footer />
          </main>
      }
    </>
  )
}
