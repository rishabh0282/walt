import React from 'react';
import { CometCard } from './ui/comet-card';
import styles from './Home.module.css';

const HeroShield: React.FC = () => {
  return (
    <div className={styles.heroShieldWrapper} aria-hidden="true">
      <CometCard className={styles.heroShieldCard}>
        <div className={styles.heroShieldBody}>
          <svg
            className={styles.heroShieldOutline}
            viewBox="0 0 512 512"
            role="presentation"
            focusable="false"
          >
            <path
              d="M463.1,112.37C373.68,96.33,336.71,84.45,256,48,175.29,84.45,138.32,96.33,48.9,112.37,32.7,369.13,240.58,457.79,256,464,271.42,457.79,479.3,369.13,463.1,112.37Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="28"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className={styles.heroShieldHalo}></div>
          <svg
            className={styles.heroShieldLock}
            viewBox="0 0 64 64"
            role="presentation"
            focusable="false"
          >
            <path
              d="M20 28v-8a12 12 0 0124 0v8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              stroke="currentColor"
              fill="none"
            />
            <rect
              x="16"
              y="28"
              width="32"
              height="28"
              rx="8"
              strokeWidth="2.5"
              stroke="currentColor"
              fill="none"
            />
            <circle cx="32" cy="42" r="5" strokeWidth="2.5" stroke="currentColor" fill="none" />
            <line x1="32" y1="47" x2="32" y2="54" strokeWidth="2.5" strokeLinecap="round" stroke="currentColor" />
          </svg>
        </div>
      </CometCard>
    </div>
  );
};

export default HeroShield;
