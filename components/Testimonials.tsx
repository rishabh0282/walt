import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Star } from 'lucide-react';
import styles from './Home.module.css';

interface Testimonial {
  author: {
    fullName: string;
    picture: string;
  };
  rating: number;
  description: string;
}

const MAX_TESTIMONIAL_LENGTH = 260;

const clampDescription = (description: string) => {
  if (description.length <= MAX_TESTIMONIAL_LENGTH) {
    return description;
  }
  return `${description.slice(0, MAX_TESTIMONIAL_LENGTH - 1).trim()}…`;
};

const testimonialList: Testimonial[] = [
  {
    author: {
      fullName: "Akshay Kumar",
      picture: "https://cdn.easyfrontend.com/pictures/users/user22.jpg",
    },
    rating: 3.5,
    description:
      "Over third given bring lights divide saying. Fowl, all creeping second saw creature isn't gathered likeness shall fruitful saying let.",
  },
  {
    author: {
      fullName: "Raima Sen",
      picture: "https://cdn.easyfrontend.com/pictures/users/user4.jpg",
    },
    rating: 4,
    description:
      "Tree the whales fifth for their whose. Deep From fruitful spirit creature morning, fowl greater said, it first creepeth after.",
  },
  {
    author: {
      fullName: "Arjun Kapur",
      picture: "https://cdn.easyfrontend.com/pictures/users/user20.jpg",
    },
    rating: 5,
    description:
      "Assumenda non repellendus distinctio nihil dicta sapiente, quibusdam maiores, illum at, aliquid blanditiis eligendi qui.",
  },
  {
    author: {
      fullName: "Sarah Johnson",
      picture: "https://cdn.easyfrontend.com/pictures/users/user22.jpg",
    },
    rating: 4.5,
    description:
      "Walt has completely transformed how I store and access my files. The free storage is amazing, and the pinning feature gives me peace of mind for important documents.",
  },
  {
    author: {
      fullName: "Michael Chen",
      picture: "https://cdn.easyfrontend.com/pictures/users/user4.jpg",
    },
    rating: 5,
    description:
      "Best decentralized storage solution I've used. Fast, secure, and the interface is incredibly intuitive. Highly recommend!",
  },
  {
    author: {
      fullName: "Emily Rodriguez",
      picture: "https://cdn.easyfrontend.com/pictures/users/user20.jpg",
    },
    rating: 4,
    description:
      "Love the pay-as-you-go model for permanent storage. No subscription fees, just pay for what you need. Perfect for my workflow.",
  },
];

const Rating: React.FC<{ rating: number }> = ({ rating }) => {
  return (
    <div className={styles.testimonialRating}>
      {[...Array(5)].map((_, i) => {
        const index = i + 1;
        const isFull = index <= Math.floor(rating);
        const isHalf = rating > i && rating < index + 1;
        
        return (
            <Star 
              key={i} 
              className={`${styles.star} ${isFull || isHalf ? styles.starActive : ''}`}
              fill={isFull || isHalf ? 'currentColor' : 'none'}
              size={20}
            />
        );
      })}
    </div>
  );
};

const TestimonialItem: React.FC<{
  testimonial: Testimonial;
  onHoverChange: (value: boolean) => void;
}> = ({ testimonial, onHoverChange }) => (
  <div
    className={styles.testimonialCard}
    onMouseEnter={() => onHoverChange(true)}
    onMouseLeave={() => onHoverChange(false)}
    onFocus={() => onHoverChange(true)}
    onBlur={() => onHoverChange(false)}
    tabIndex={0}
  >
    <Image
      src={testimonial.author.picture}
      alt={testimonial.author.fullName}
      className={styles.testimonialAvatar}
      width={100}
      height={100}
      unoptimized
    />
    <h4 className={styles.testimonialName}>{testimonial.author.fullName}</h4>
    <Rating rating={testimonial.rating} />
    <p className={styles.testimonialText}>{clampDescription(testimonial.description)}</p>
  </div>
);

const Testimonials: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [perSlide, setPerSlide] = useState(3);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const updatePerSlide = () => {
      if (window.innerWidth > 991) setPerSlide(3);
      else if (window.innerWidth > 767) setPerSlide(2);
      else setPerSlide(1);
    };

    updatePerSlide();
    window.addEventListener('resize', updatePerSlide);
    return () => window.removeEventListener('resize', updatePerSlide);
  }, []);

  const totalSlides = Math.ceil(testimonialList.length / perSlide);

  useEffect(() => {
    setCurrentIndex((prev) => Math.min(prev, Math.max(totalSlides - 1, 0)));
  }, [totalSlides]);

  useEffect(() => {
    if (isPaused || totalSlides <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % totalSlides);
    }, 5000);
    return () => clearInterval(interval);
  }, [isPaused, totalSlides]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const currentTestimonials = testimonialList.slice(
    currentIndex * perSlide,
    (currentIndex + 1) * perSlide
  );

  return (
    <section id="testimonials" className={styles.testimonialsSection}>
      <div className={styles.testimonialsContainer}>
        <div className={styles.testimonialsHeader}>
          <div className={styles.testimonialsHeading}>
            <h2>What Our Users Say</h2>
          </div>
          <div className={styles.testimonialsSubheading}>
            <p>
              Don&apos;t just take our word for it. See what our community has to say
              about their experience with Walt.
            </p>
          </div>
        </div>

        <div className={styles.testimonialsGrid}>
          {currentTestimonials.map((testimonial, i) => (
            <TestimonialItem
              key={i}
              testimonial={testimonial}
              onHoverChange={setIsPaused}
            />
          ))}
        </div>

        <div className={styles.testimonialsControls}>
          {[...Array(totalSlides)].map((_, i) => (
            <button
              key={i}
              className={`${styles.testimonialDot} ${currentIndex === i ? styles.testimonialDotActive : ''}`}
              onClick={() => goToSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;

