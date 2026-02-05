import { useParams } from 'react-router-dom';
import { ChatContainer } from '@/components/Chat';

export default function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  return <ChatContainer sessionId={sessionId} />;
}
