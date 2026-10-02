import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  SocialHeader,
  FeedPage,
  ReelsPage,
  ExplorePage,
  HashtagPage,
  PostDetailPage,
  StoryViewerModal,
  CreateSocialModal,
  CommentsSheet,
  ShareSheet,
  NotificationsPage
} from '../features/social';

export const SocialPage = () => {
  const location = useLocation();
  const path = location.pathname;

  let activeTab = 'feed';
  if (path.startsWith('/social/reels')) activeTab = 'reels';
  else if (path.startsWith('/social/explore') || path.startsWith('/social/search')) activeTab = 'explore';
  else if (path.startsWith('/social/notifications')) activeTab = 'notifications';

  const isHashtagRoute = path.startsWith('/social/hashtag/');
  const isPostDetailRoute = path.startsWith('/social/post/');

  return (
    <div className="min-h-screen bg-[#FFF7ED] flex flex-col">
      {/* Social Tab Header with Feed | Reels | Explore | Activity sub-tabs, Create (+) and DM icon */}
      <SocialHeader activeTab={activeTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-3 sm:p-4">
        {isHashtagRoute ? (
          <HashtagPage />
        ) : isPostDetailRoute ? (
          <PostDetailPage />
        ) : (
          <>
            {activeTab === 'feed' && <FeedPage />}
            {activeTab === 'reels' && <ReelsPage />}
            {activeTab === 'explore' && <ExplorePage />}
            {activeTab === 'notifications' && <NotificationsPage />}
          </>
        )}
      </main>

      {/* Global Modals for Social Engine */}
      <StoryViewerModal />
      <CreateSocialModal />
      <CommentsSheet />
      <ShareSheet />
    </div>
  );
};

export default SocialPage;
