import React from 'react';

const SERVICE_TYPES = [
  {
    serviceType: 'one_time',
    scheduleType: null,
    icon: '📦',
    label: 'One-Time Delivery',
    desc: 'Logo, website, video, or any finished deliverable.',
  },
  {
    serviceType: 'recurring',
    scheduleType: 'DYNAMIC_PRIVATE',
    icon: '📅',
    label: 'Bookable Sessions',
    desc: 'Tutoring, coaching, consulting — clients book from your available time slots.',
  },
  {
    serviceType: 'class',
    scheduleType: 'FIXED_RECURRING',
    icon: '🔁',
    label: 'Recurring Class or Group',
    desc: 'Yoga, cooking class, lessons — set a schedule, clients sign up for sessions.',
  },
  {
    serviceType: 'class',
    scheduleType: 'FIXED_ONE_TIME',
    icon: '📌',
    label: 'One-Time Event',
    desc: 'A workshop, bootcamp, seminar, or class on one specific date.',
  },
  {
    serviceType: 'one_time',
    scheduleType: 'REQUEST_BASED',
    icon: '💬',
    label: 'Custom / Request-Based',
    desc: 'Clients message first — you agree on scope, timing, and price.',
  },
];

const ServiceTypeSelector = ({ value, scheduleType: currentSchedule, onChange }) => {
  const isSelected = (opt) => {
    if (opt.scheduleType) return currentSchedule === opt.scheduleType;
    // Deliverable: serviceType matches AND no scheduleType set
    return value === opt.serviceType && !currentSchedule;
  };

  const handleSelect = (opt) => {
    onChange('serviceType', opt.serviceType);
    onChange('scheduleType', opt.scheduleType || '');
    // Auto-enable booking for scheduling modes that need it
    if (opt.scheduleType && opt.scheduleType !== 'REQUEST_BASED') {
      onChange('bookingEnabled', true);
    } else {
      onChange('bookingEnabled', false);
    }
    // Default capacity per scheduling mode
    if (opt.scheduleType === 'FIXED_RECURRING') {
      onChange('capacityType', 'GROUP');
      onChange('maxCapacity', 10);
      onChange('bookingMaxPerSlot', 10);
    } else if (opt.scheduleType === 'FIXED_ONE_TIME') {
      onChange('capacityType', 'GROUP');
      onChange('maxCapacity', 20);
      onChange('bookingMaxPerSlot', 20);
    } else if (opt.scheduleType === 'DYNAMIC_PRIVATE') {
      onChange('capacityType', 'ONE_ON_ONE');
      onChange('maxCapacity', 1);
    }
  };

  return (
    <div className="service-type-selector">
      <label className="wiz-field-label-standalone">What kind of service is this? *</label>
      <div className="service-type-cards">
        {SERVICE_TYPES.map((opt, i) => (
          <button
            key={opt.scheduleType || opt.serviceType}
            type="button"
            className={`service-type-card ${isSelected(opt) ? 'selected' : ''}`}
            onClick={() => handleSelect(opt)}
          >
            <span className="svc-type-icon">{opt.icon}</span>
            <div>
              <strong>{opt.label}</strong>
              <p>{opt.desc}</p>
            </div>
            <span className="svc-type-check">{isSelected(opt) ? '✓' : ''}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ServiceTypeSelector;
