import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const BaseChart = ({ children, className = '', style = {} }) => {
  return (
    <div className={`chart-container ${className}`} style={{ position: 'relative', height: '400px', ...style }}>
      {children}
    </div>
  );
};

export default BaseChart;
