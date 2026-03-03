import React from 'react';

const Stepper = ({ steps, current, onStepClick }) => (
  <div className="wizard-stepper">
    {steps.map((step, i) => (
      <button
        key={step}
        className={`step ${i === current ? 'active' : ''} ${i < current ? 'done' : ''}`}
        onClick={() => i <= current && onStepClick(i)}
        disabled={i > current}
      >
        <span className="step-num">{i < current ? '✓' : i + 1}</span>
        <span className="step-label">{step}</span>
      </button>
    ))}
  </div>
);

export default Stepper;
