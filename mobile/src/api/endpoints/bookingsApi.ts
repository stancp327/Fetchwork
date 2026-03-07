import client from '../client';

// Simple idempotency key (crypto not available in React Native)
const idKey = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export type BookingRole   = 'client' | 'freelancer';
export type BookingStatus = 'upcoming' | 'past' | 'cancelled';

export interface SlotItem {
  startTime: string;
  endTime:   string;
  spotsLeft: number;
  totalSpots?: number;
}

export interface GroupSlot {
  id:                  string;
  date:                string;
  startTime:           string;
  endTime:             string;
  totalCapacity:       number;
  bookedCount?:        number;
  spotsLeft?:          number;
  pricePerPersonCents?: number;
}

export const bookingsApi = {
  getMyBookings: (role: BookingRole, status: BookingStatus) =>
    client.get('/api/bookings/me', { params: { role, status } }).then(r => r.data),

  getById: (id: string) =>
    client.get(`/api/bookings/${id}`).then(r => r.data),

  confirm: (id: string) =>
    client.patch(`/api/bookings/${id}/confirm`, {}, { headers: { 'Idempotency-Key': idKey() } }).then(r => r.data),

  complete: (id: string) =>
    client.patch(`/api/bookings/${id}/complete`, {}, { headers: { 'Idempotency-Key': idKey() } }).then(r => r.data),

  cancel: (id: string, reason?: string) =>
    client.patch(`/api/bookings/${id}/cancel`, { reason }, { headers: { 'Idempotency-Key': idKey() } }).then(r => r.data),

  reschedule: (id: string, data: { newDate: string; newStartTime: string; newEndTime: string; reason?: string }) =>
    client.patch(`/api/bookings/${id}/reschedule`, data, { headers: { 'Idempotency-Key': idKey() } }).then(r => r.data),

  getSlots: (serviceId: string, date: string): Promise<{ slots: SlotItem[] }> =>
    client.get(`/api/bookings/slots/${serviceId}`, { params: { date } }).then(r => r.data),

  getGroupSlots: (serviceId: string, fromDate: string, toDate: string): Promise<{ slots: GroupSlot[] }> =>
    client.get(`/api/bookings/group/slots/${serviceId}`, { params: { fromDate, toDate } }).then(r => r.data),

  bookGroupSeats: (slotId: string, seatCount: number) =>
    client.post(`/api/bookings/group/slots/${slotId}/book`, { seatCount }, { headers: { 'Idempotency-Key': idKey() } }).then(r => r.data),

  joinWaitlist: (slotId: string, seatCount = 1) =>
    client.post(`/api/bookings/group/slots/${slotId}/waitlist`, { seatCount }, { headers: { 'Idempotency-Key': idKey() } }).then(r => r.data),

  leaveWaitlist: (slotId: string) =>
    client.delete(`/api/bookings/group/slots/${slotId}/waitlist`).then(r => r.data),
};
