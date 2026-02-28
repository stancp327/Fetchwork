import { useCallback } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useToast } from './Toast';

// Toast labels per notification type
const TYPE_TOAST = {
  job_proposal_received: (d) => `📩 New proposal on "${d?.title || 'your job'}"`,
  job_proposal_accepted: ()  => `🎉 Your proposal was accepted!`,
  job_start_requested:   (d) => `🚀 ${d?.title || 'A freelancer'} is ready to start`,
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

const NotificationListener = () => {
  const { addToast } = useToast();

  const handleEvent = useCallback((event, data) => {
    switch (event) {
      case 'message:receive':
        // Only toast if message came from someone else (not own sent message)
        if (data?.message?.sender?.firstName) {
          addToast(`💬 New message from ${data.message.sender.firstName}`, 'info');
        }
        break;

      case 'notification:new': {
        // Notify bell via custom window event (useNotifications listens for this)
        window.dispatchEvent(new CustomEvent('fetchwork:notification', { detail: data }));

        // Show a toast
        const toastFn = TYPE_TOAST[data?.type];
        const text = toastFn ? toastFn(data) : (data?.title || '🔔 New notification');
        const duration = ['payment_received', 'payment_released', 'job_proposal_accepted'].includes(data?.type) ? 6000 : 4000;
        addToast(text, data?.type?.startsWith('payment') || data?.type === 'job_proposal_accepted' ? 'success' : 'info', duration);
        break;
      }

      default:
        break;
    }
  }, [addToast]);

  useSocket({ onEvent: handleEvent });

  return null;
};

export default NotificationListener;
