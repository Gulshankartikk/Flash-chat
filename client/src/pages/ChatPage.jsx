import React, { useEffect } from 'react';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { ChatWindow } from '../components/chat/ChatWindow';
import { useChatStore } from '../store/useChatStore';

export const ChatPage = () => {
  const { fetchChats, initSocketEvents } = useChatStore();

  useEffect(() => {
    fetchChats();
    initSocketEvents();
  }, [fetchChats, initSocketEvents]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-slate-900 font-sans">
      <ChatSidebar />
      <ChatWindow />
    </div>
  );
};
