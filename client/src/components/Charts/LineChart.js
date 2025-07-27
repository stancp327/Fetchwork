import React from 'react';
import { Line } from 'react-chartjs-2';
import BaseChart from './BaseChart';

const LineChart = ({ data, title, color = '#3b82f6', fillColor = 'rgba(59, 130, 246, 0.1)' }) => {
  const chartData = {
    labels: data.map(item => new Date(item._id).toLocaleDateString()),
    datasets: [
      {
        label: title,
        data: data.map(item => item.count || item.volume || 0),
        borderColor: color,
        backgroundColor: fillColor,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: color,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: title,
        font: {
          size: 16,
          weight: 'bold',
        },
        color: '#374151',
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: color,
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#6b7280',
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          color: '#6b7280',
        },
      },
    },
  };

  return (
    <BaseChart>
      <Line data={chartData} options={options} />
    </BaseChart>
  );
};

export default LineChart;
