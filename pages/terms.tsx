import React from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/Terms.module.css';

const Terms: NextPage = () => {
  return (
    <>
      <Head>
        <title>Terms & Conditions - Walt</title>
        <meta name="description" content="Terms and Conditions for Walt IPFS Drive" />
      </Head>
      <div className={styles.container}>
        <div className={styles.content}>
          <Link href="/" className={styles.backLink}>
            ← Back to Home
          </Link>
          
          <h1 className={styles.title}>Terms & Conditions</h1>
          <p className={styles.lastUpdated}>Last updated on 18-11-2025 16:58:34</p>

          <div className={styles.section}>
            <p>
              These Terms and Conditions, along with privacy policy or other terms ("Terms") constitute a binding
              agreement by and between <strong>Aayushman Singh</strong>, ( "Website Owner" or "we" or "us" or "our") and you
              ("you" or "your") and relate to your use of our website, goods (as applicable) or services (as applicable)
              (collectively, "Services").
            </p>
            <p>
              By using our website and availing the Services, you agree that you have read and accepted these Terms
              (including the Privacy Policy). We reserve the right to modify these Terms at any time and without
              assigning any reason. It is your responsibility to periodically review these Terms to stay informed of
              updates.
            </p>
            <p>
              The use of this website or availing of our Services is subject to the following terms of use:
            </p>
          </div>

          <div className={styles.section}>
            <p>
              To access and use the Services, you agree to provide true, accurate and complete information to us
              during and after registration, and you shall be responsible for all acts done through the use of your
              registered account.
            </p>
          </div>

          <div className={styles.section}>
            <p>
              Neither we nor any third parties provide any warranty or guarantee as to the accuracy, timeliness,
              performance, completeness or suitability of the information and materials offered on this website
              or through the Services, for any specific purpose. You acknowledge that such information and
              materials may contain inaccuracies or errors and we expressly exclude liability for any such
              inaccuracies or errors to the fullest extent permitted by law.
            </p>
          </div>

          <div className={styles.section}>
            <p>
              Your use of our Services and the website is solely at your own risk and discretion. You are
              required to independently assess and ensure that the Services meet your requirements.
            </p>
          </div>

          <div className={styles.section}>
            <p>
              The contents of the Website and the Services are proprietary to Us and you will not have any
              authority to claim any intellectual property rights, title, or interest in its contents.
            </p>
          </div>

          <div className={styles.section}>
            <p>
              You acknowledge that unauthorized use of the Website or the Services may lead to action against
              you as per these Terms or applicable laws.
            </p>
          </div>

          <div className={styles.section}>
            <p>
              You agree to pay us the charges associated with availing the Services.
            </p>
          </div>

          <div className={styles.section}>
            <p>
              You agree not to use the website and/ or Services for any purpose that is unlawful, illegal or
              forbidden by these Terms, or Indian or local laws that might apply to you.
            </p>
          </div>

          <div className={styles.section}>
            <p>
              You agree and acknowledge that website and the Services may contain links to other third party
              websites. On accessing these links, you will be governed by the terms of use, privacy policy and
              such other policies of such third party websites.
            </p>
          </div>

          <div className={styles.section}>
            <p>
              You understand that upon initiating a transaction for availing the Services you are entering into a
              legally binding and enforceable contract with the us for the Services.
            </p>
          </div>

          <div className={styles.section}>
            <p>
              You shall be entitled to claim a refund of the payment made by you in case we are not able to
              provide the Service. The timelines for such return and refund will be according to the specific
              Service you have availed or within the time period provided in our policies (as applicable). In case
              you do not raise a refund claim within the stipulated time, than this would make you ineligible for
              a refund.
            </p>
          </div>

          <div className={styles.section}>
            <p>
              Notwithstanding anything contained in these Terms, the parties shall not be liable for any failure to
              perform an obligation under these Terms if performance is prevented or delayed by a force majeure
              event.
            </p>
          </div>

          <div className={styles.section}>
            <p>
              These Terms and any dispute or claim relating to it, or its enforceability, shall be governed by and
              construed in accordance with the laws of India.
            </p>
          </div>

          <div className={styles.section}>
            <p>
              All disputes arising out of or in connection with these Terms shall be subject to the exclusive
              jurisdiction of the courts in <strong>Crossing Republik, Uttar Pradesh</strong>.
            </p>
          </div>

          <div className={styles.section}>
            <p>
              All concerns or communications relating to these Terms must be communicated to us using the
              contact information provided on this website.
            </p>
            <p>
              <strong>Email:</strong> <a href="mailto:aayushman2702@gmail.com">aayushman2702@gmail.com</a><br />
              <strong>Phone:</strong> <a href="tel:+919650593099">+91 96505 93099</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Terms;

