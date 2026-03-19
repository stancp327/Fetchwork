import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../../utils/api';

const pad2 = (n) => String(n).padStart(2, '0');

const nextQuarterLocal = () => {
  const d = new Date();
  d.setSeconds(0, 0);
  const mins = d.getMinutes();
  const next = Math.ceil(mins / 15) * 15;
  d.setMinutes(next);
  if (d <= new Date()) d.setMinutes(d.getMinutes() + 15);
  return d;
};

export default function useScheduling({ selectedConvo, setMessages }) {
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleType, setScheduleType] = useState('consultation');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleDuration, setScheduleDuration] = useState(30);
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [editingApptId, setEditingApptId] = useState(null);
  const [appointmentsById, setAppointmentsById] = useState({});
  const [actingApptId, setActingApptId] = useState(null);

  const fetchAppointments = useCallback(async (conversationId) => {
    if (!conversationId) return;
    try {
      const data = await apiRequest(`/api/appointments?conversationId=${conversationId}&limit=200`);
      const list = data.appointments || [];
      const map = {};
      list.forEach(a => { map[a.id] = a; });
      setAppointmentsById(map);
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    if (selectedConvo?._id) fetchAppointments(selectedConvo._id);
  }, [selectedConvo?._id, fetchAppointments]);

  // Init schedule modal defaults
  useEffect(() => {
    if (!showScheduleModal) return;

    setScheduleError('');
    setScheduleSaving(false);

    const editing = editingApptId ? appointmentsById[editingApptId] : null;
    if (editing) {
      const start = new Date(editing.startAtUtc);
      const localDate = `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`;
      const localTime = `${pad2(start.getHours())}:${pad2(start.getMinutes())}`;
      const mins = Math.round((new Date(editing.endAtUtc).getTime() - new Date(editing.startAtUtc).getTime()) / 60000);

      setScheduleType(editing.appointmentType || 'consultation');
      setScheduleDate(localDate);
      setScheduleTime(localTime);
      setScheduleDuration(mins || 30);
      setScheduleNotes(editing.notes || '');
      return;
    }

    const d = nextQuarterLocal();
    const isoDate = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const isoTime = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

    setScheduleDate(prev => prev || isoDate);
    setScheduleTime(prev => prev || isoTime);
    setScheduleDuration(prev => prev || 30);
    setScheduleNotes('');

    if (selectedConvo?.service) setScheduleType('service');
    else if (selectedConvo?.job) setScheduleType('job');
    else setScheduleType('consultation');
  }, [showScheduleModal, editingApptId, appointmentsById, selectedConvo]);

  const handleScheduleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!selectedConvo?._id) return;

    setScheduleSaving(true);
    setScheduleError('');
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const startLocal = new Date(`${scheduleDate}T${scheduleTime}:00`);
      if (Number.isNaN(startLocal.getTime())) throw new Error('Invalid date/time');
      if (startLocal <= new Date()) throw new Error('Please choose a future date and time');

      const payload = {
        appointmentType: scheduleType,
        startAtUtc: startLocal.toISOString(),
        durationMinutes: Number(scheduleDuration),
        timezone: tz,
        notes: scheduleNotes,
      };

      let appt;
      if (editingApptId) {
        const resp = await apiRequest(`/api/appointments/${editingApptId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        appt = resp.appointment;
      } else {
        const resp = await apiRequest('/api/appointments', {
          method: 'POST',
          body: JSON.stringify({
            conversationId: selectedConvo._id,
            ...payload,
            jobId: selectedConvo?.job?._id || selectedConvo?.job || undefined,
            serviceId: selectedConvo?.service?._id || selectedConvo?.service || undefined,
          }),
        });
        appt = resp.appointment;
      }

      // Update appointments locally
      setAppointmentsById(prev => ({ ...prev, [appt.id]: appt }));

      const startStr = new Date(appt.startAtUtc).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      const mins = Math.round((new Date(appt.endAtUtc).getTime() - new Date(appt.startAtUtc).getTime()) / 60000);

      const msgRes = await apiRequest(`/api/messages/conversations/${selectedConvo._id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content: `${editingApptId ? '✏️ Appointment update proposed' : '📅 Appointment proposed'} [appt:${appt.id}]: ${startStr} (${mins} min) — ${appt.appointmentType}${scheduleNotes ? `\nNotes: ${scheduleNotes}` : ''}`
        })
      });

      // Update messages locally from the sent message
      if (msgRes?.data) {
        setMessages(prev => [...prev, msgRes.data]);
      }

      setShowScheduleModal(false);
      setEditingApptId(null);
      // Socket echo handles convo list update
    } catch (err) {
      setScheduleError(err?.message || 'Failed to schedule');
    } finally {
      setScheduleSaving(false);
    }
  }, [selectedConvo, scheduleDate, scheduleTime, scheduleType, scheduleDuration, scheduleNotes, editingApptId, setMessages]);

  const handleApptApprove = useCallback(async (apptId) => {
    if (!selectedConvo?._id) return;
    setActingApptId(apptId);
    try {
      await apiRequest(`/api/appointments/${apptId}/approve`, { method: 'POST' });
      // Update locally
      setAppointmentsById(prev => prev[apptId] ? { ...prev, [apptId]: { ...prev[apptId], status: 'confirmed' } } : prev);
      const msgRes = await apiRequest(`/api/messages/conversations/${selectedConvo._id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: `✅ Appointment confirmed [appt:${apptId}]` })
      });
      if (msgRes?.data) {
        setMessages(prev => [...prev, msgRes.data]);
      }
    } catch (e) {
      alert(e?.message || 'Failed to approve appointment');
    } finally {
      setActingApptId(null);
    }
  }, [selectedConvo, setMessages]);

  const handleApptDecline = useCallback(async (apptId) => {
    if (!selectedConvo?._id) return;
    setActingApptId(apptId);
    try {
      await apiRequest(`/api/appointments/${apptId}/cancel`, { method: 'POST' });
      setAppointmentsById(prev => prev[apptId] ? { ...prev, [apptId]: { ...prev[apptId], status: 'cancelled' } } : prev);
      const msgRes = await apiRequest(`/api/messages/conversations/${selectedConvo._id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: `❌ Appointment declined [appt:${apptId}]` })
      });
      if (msgRes?.data) {
        setMessages(prev => [...prev, msgRes.data]);
      }
    } catch (e) {
      alert(e?.message || 'Failed to decline appointment');
    } finally {
      setActingApptId(null);
    }
  }, [selectedConvo, setMessages]);

  return {
    showScheduleModal,
    setShowScheduleModal,
    scheduleType,
    setScheduleType,
    scheduleDate,
    setScheduleDate,
    scheduleTime,
    setScheduleTime,
    scheduleDuration,
    setScheduleDuration,
    scheduleNotes,
    setScheduleNotes,
    scheduleSaving,
    scheduleError,
    editingApptId,
    setEditingApptId,
    appointmentsById,
    actingApptId,
    handleScheduleSubmit,
    handleApptApprove,
    handleApptDecline,
  };
}
