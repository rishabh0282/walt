import React from 'react';
import { NextPage } from 'next';
import HomePageHtml from '../components/HomePageHtml'; 
import Layout from '../components/Layout';
import OpenGraph from '../components/OpenGraph';

const Home: NextPage = () => {
  return (
    <>
      <OpenGraph
        title="Walt - Decentralized Storage"
        description="A decentralized, open-source file storage platform built on IPFS. Self-hostable, private, and affordable. Upload, share, and manage your files with true data ownership."
        url="/"
      />
      <Layout>
        <main>
          {/* Include the HomePageHtml component for your website content */}
          <HomePageHtml />
        </main>
      </Layout>
    </>
  );
};
    
export default Home;
