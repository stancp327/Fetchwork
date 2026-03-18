import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../../utils/api';

const getEntityId = (v) => (v && typeof v === 'object' ? (v._id || v.id || v.userId || v.toString?.()) : v);

export default function usePayments({ selectedConvo, userId, setMessages }) {
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDescription, setPayDescription] = useState('');
  const [payType, setPayType] = useState('service_rendered');
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState('');
  const [payRequestsById, setPayRequestsById] = useState({});
  const [offersById, setOffersById] = useState({});
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerModalOpts, setOfferModalOpts] = useState({});
  const [actingPrId, setActingPrId] = useState(null);

  const fetchPaymentRequests = useCallback(async (conversationId) => {
    if (!conversationId) return;
    try {
      const data = await apiRequest(`/api/payment-requests?conversationId=${conversationId}`);
      const map = {};
      (data.paymentRequests || []).forEach(pr => { map[pr._id] = pr; });
      setPayRequestsById(map);
    } catch {
      // non-blocking
    }
  }, []);

  const fetchOffer = useCallback(async (offerId) => {
    if (!offerId || offersById[offerId]) return;
    try {
      const data = await apiRequest(`/api/offers/${offerId}`);
      setOffersById(prev => ({ ...prev, [offerId]: data.offer || data }));
    } catch { /* non-blocking */ }
  // offersById intentionally excluded — we only want to fetch once
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedConvo?._id) fetchPaymentRequests(selectedConvo._id);
  }, [selectedConvo?._id, fetchPaymentRequests]);

  const handlePaySubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!selectedConvo?._id) return;
    setPaySaving(true);
    setPayError('');
    try {
      const resp = await apiRequest('/api/payment-requests', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: selectedConvo._id,
          amount: parseFloat(payAmount),
          description: payDescription,
          type: payType,
          jobId: selectedConvo?.job?._id || selectedConvo?.job || undefined,
          serviceId: selectedConvo?.service?._id || selectedConvo?.service || undefined,
        }),
      });
      const pr = resp.paymentRequest;
      // Update payRequestsById locally
      setPayRequestsById(prev => ({ ...prev, [pr._id]: pr }));

      const msgRes = await apiRequest(`/api/messages/conversations/${selectedConvo._id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content: `💳 Payment requested [pr:${pr._id}]: $${parseFloat(payAmount).toFixed(2)} — ${payType === 'service_rendered' ? 'Service rendered' : 'Additional funds'}${payDescription ? `\n${payDescription}` : ''}`,
        }),
      });
      // Update messages locally
      if (msgRes?.data) {
        setMessages(prev => [...prev, msgRes.data]);
      }
      setShowPayModal(false);
      // Socket echo handles convo list update
    } catch (err) {
      setPayError(err?.message || 'Failed to create payment request');
    } finally {
      setPaySaving(false);
    }
  }, [selectedConvo, payAmount, payDescription, payType, setMessages]);

  const handlePayCancel = useCallback(async (prId) => {
    if (!selectedConvo?._id) return;
    setActingPrId(prId);
    try {
      await apiRequest(`/api/payment-requests/${prId}/cancel`, { method: 'POST' });
      // Update locally
      setPayRequestsById(prev => prev[prId] ? { ...prev, [prId]: { ...prev[prId], status: 'cancelled' } } : prev);
      const msgRes = await apiRequest(`/api/messages/conversations/${selectedConvo._id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: `❌ Payment request cancelled [pr:${prId}]` }),
      });
      if (msgRes?.data) {
        setMessages(prev => [...prev, msgRes.data]);
      }
    } catch (err) { alert(err?.message || 'Failed to cancel'); }
    finally { setActingPrId(null); }
  }, [selectedConvo, setMessages]);

  const handlePayAction = useCallback(async (prId, amount) => {
    setActingPrId(prId);
    try {
      const { clientSecret } = await apiRequest(`/api/payment-requests/${prId}/pay`, { method: 'POST' });
      if (clientSecret) {
        const piId = clientSecret.split('_secret_')[0];
        const confirmUrl = `https://checkout.stripe.com/pay/${piId}?client_secret=${encodeURIComponent(clientSecret)}`;
        window.open(confirmUrl, '_blank');
      }
    } catch (err) { alert(err?.message || 'Failed to initiate payment'); }
    finally { setActingPrId(null); }
  }, []);

  const handleOfferAccept = useCallback(async (offerId) => {
    if (!selectedConvo?._id) return;
    try {
      await apiRequest(`/api/offers/${offerId}/accept`, { method: 'POST' });
      setOffersById(prev => ({ ...prev, [offerId]: { ...prev[offerId], status: 'accepted' } }));
      const msgRes = await apiRequest(`/api/messages/conversations/${selectedConvo._id}/messages`, {
        method: 'POST', body: JSON.stringify({ content: '✅ Offer accepted!' })
      });
      if (msgRes?.data) setMessages(prev => [...prev, msgRes.data]);
    } catch (e) { alert(e?.message || 'Failed to accept offer'); }
  }, [selectedConvo, setMessages]);

  const handleOfferDecline = useCallback(async (offerId) => {
    if (!selectedConvo?._id) return;
    try {
      await apiRequest(`/api/offers/${offerId}/decline`, { method: 'POST' });
      setOffersById(prev => ({ ...prev, [offerId]: { ...prev[offerId], status: 'declined' } }));
      const msgRes = await apiRequest(`/api/messages/conversations/${selectedConvo._id}/messages`, {
        method: 'POST', body: JSON.stringify({ content: '❌ Offer declined.' })
      });
      if (msgRes?.data) setMessages(prev => [...prev, msgRes.data]);
    } catch (e) { alert(e?.message || 'Failed to decline offer'); }
  }, [selectedConvo, setMessages]);

  const handleOfferWithdraw = useCallback(async (offerId) => {
    try {
      await apiRequest(`/api/offers/${offerId}/withdraw`, { method: 'POST' });
      setOffersById(prev => ({ ...prev, [offerId]: { ...prev[offerId], status: 'withdrawn' } }));
    } catch (e) { alert(e?.message || 'Failed to withdraw'); }
  }, []);

  return {
    showPayModal,
    setShowPayModal,
    payAmount,
    setPayAmount,
    payDescription,
    setPayDescription,
    payType,
    setPayType,
    paySaving,
    payError,
    payRequestsById,
    offersById,
    setOffersById,
    showOfferModal,
    setShowOfferModal,
    offerModalOpts,
    setOfferModalOpts,
    actingPrId,
    handlePaySubmit,
    handlePayCancel,
    handlePayAction,
    handleOfferAccept,
    handleOfferDecline,
    handleOfferWithdraw,
    fetchOffer,
    setPayError,
  };
}
