import React from 'react';
import { Pie } from 'react-chartjs-2';
import BaseChart from './BaseChart';

const PieChart = ({ data, title }) => {
  const colors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
  ];

  const chartData = {
    labels: data.map(item => item._id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())),
    datasets: [
      {
        data: data.map(item => item.count),
        backgroundColor: colors.slice(0, data.length),
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverBorderWidth: 3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          padding: 20,
          usePointStyle: true,
          font: {
            size: 12,
          },
        },
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
        callbacks: {
          label: function(context) {
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((context.parsed / total) * 100).toFixed(1);
            return `${context.label}: ${context.parsed} (${percentage}%)`;
          }
        }
      },
    },
  };

  return (
    <BaseChart style={{ height: '350px' }}>
      <Pie data={chartData} options={options} />
    </BaseChart>
  );
};

export default PieChart;
