export interface MessageSender {
  _id: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
  availabilityStatus?: string;
}

export interface Message {
  _id: string;
  content: string;
  sender: MessageSender;
  conversation: string;
  read: boolean;
  createdAt: string;
  attachments?: Array<{ url: string; name: string; type: string }>;
}

export interface Conversation {
  _id: string;
  participants: MessageSender[];
  lastMessage?: Message;
  unreadCount?: number;
  job?: { _id: string; title: string };
  service?: { _id: string; title: string };
  serviceOrderId?: string;
  updatedAt: string;
}
