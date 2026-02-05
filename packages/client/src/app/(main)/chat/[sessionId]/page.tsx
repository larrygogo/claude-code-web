'use client';

import { ChatContainer } from '@/components/Chat';

interface ChatSessionPageProps {
  params: {
    sessionId: string;
  };
}

export default function ChatSessionPage({ params }: ChatSessionPageProps) {
  return <ChatContainer sessionId={params.sessionId} />;
}
