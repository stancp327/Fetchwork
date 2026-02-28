import { useCallback, useRef, useEffect } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useToast } from './Toast';
import { useAuth } from '../../context/AuthContext';

// Toast text per notification type
const TYPE_TOAST = {
  job_proposal_received: (d) => `📩 New proposal on "${d?.title || 'your job'}"`,
  job_proposal_accepted: ()  => `🎉 Your proposal was accepted!`,
  job_start_requested:   (d) => `🚀 "${d?.title || 'A job'}" — freelancer is ready to start`,
  job_started:           (d) => `✅ Job "${d?.title || ''}" is now in progress`,
  job_completed:         (d) => `✅ Job "${d?.title || ''}" marked as complete`,
  job_cancelled:         (d) => `❌ Job "${d?.title || ''}" was cancelled`,
  booking_confirmed:     ()  => `📅 New booking confirmed`,
  booking_cancelled:     ()  => `📅 A booking was cancelled`,
  new_order:             ()  => `📦 New service order received`,
  payment_received:      (d) => `💰 Payment received${d?.message ? ': ' + d.message.slice(0, 60) : ''}`,
  payment_released:      ()  => `💸 Payment released to your account`,
  payment_failed:        ()  => `⚠️ A payment failed — check billing`,
  escrow_funded:         ()  => `🔒 Secure Payment funded`,
  system:                (d) => d?.title || `📢 System update`,
  system_announcement:   (d) => d?.title || `📢 Announcement`,
  account_warning:       ()  => `⚠️ Account notice`,
};

const SUCCESS_TYPES = new Set([
  'payment_received', 'payment_released', 'job_proposal_accepted',
  'job_started', 'new_order', 'booking_confirmed', 'escrow_funded',
]);

const NotificationListener = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  // Ref so user changes never cause handleEvent to recreate (which would
  // trigger a socket reconnect via useSocket's onEvent dep)
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const handleEvent = useCallback((event, data) => {
    const onMessagesPage = window.location.pathname.startsWith('/messages');

    switch (event) {
      case 'message:receive': {
        const msg = data?.message;
        if (!msg) break;
        const senderId = msg.sender?._id || msg.sender;
        const currentUserId = userRef.current?._id || userRef.current?.id || userRef.current?.userId;
        // Skip own sent messages
        if (!senderId || String(senderId) === String(currentUserId)) break;

        // Always update unread badge
        window.dispatchEvent(new CustomEvent('fetchwork:unread-message'));

        // Toast only if not already on messages page
        if (!onMessagesPage) {
          addToast(`💬 New message from ${msg.sender?.firstName || 'someone'}`, 'info', 4000);
        }
        break;
      }

      case 'notification:new': {
        // Let useNotifications update bell count immediately
        window.dispatchEvent(new CustomEvent('fetchwork:notification', { detail: data }));

        // Suppress toast if it's a message-type notification and user is on /messages
        if (data?.type === 'new_message' && onMessagesPage) break;

        const toastFn = TYPE_TOAST[data?.type];
        const text = toastFn ? toastFn(data) : (data?.title || '🔔 New notification');
        const variant = SUCCESS_TYPES.has(data?.type) ? 'success' : 'info';
        const duration = SUCCESS_TYPES.has(data?.type) ? 6000 : 4000;
        addToast(text, variant, duration);
        break;
      }

      default:
        break;
    }
  // addToast is stable from useToast; userRef is a ref (not a dep)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addToast]);

  useSocket({ onEvent: handleEvent });

  return null;
};

export default NotificationListener;
