import { motion } from 'framer-motion';
import { Hero } from '../components/landing/Hero';
import { StatCards } from '../components/landing/StatCards';
import { HowItWorks } from '../components/landing/HowItWorks';
import { WhyUs } from '../components/landing/WhyUs';
import { FeaturedProjects } from '../components/landing/FeaturedProjects';
import { LandPlotCta } from '../components/landing/LandPlotCta';

/**
 * Home page — lightweight landing: hero → stats → how it works → why us →
 * featured projects. The interactive calculator lives on /kalkulyator.
 */
export function HomePage() {
  return (
    <div>
      <Hero />

      <motion.div
        className="mt-8 md:mt-10"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <StatCards />
      </motion.div>

      <HowItWorks />
      <LandPlotCta />
      <WhyUs />
      <FeaturedProjects />
    </div>
  );
}
