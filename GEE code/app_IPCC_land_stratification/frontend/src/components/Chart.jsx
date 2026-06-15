/**
 * Chart Component
 * Displays dual-axis chart of monthly temperature and precipitation
 */

import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function Chart({ data, tempKey = 'temperature', precipKey = 'precipitation', title = 'Monthly temperature and precipitation data for specified time band', chartRef }) {
  const labels = data.map((d) => d.month);
  const temperatures = data.map((d) => d[tempKey]);
  const precipitations = data.map((d) => d[precipKey]);

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Temperature (°C)',
        data: temperatures,
        borderColor: '#ff6b6b',
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#ff6b6b',
        yAxisID: 'y',
        tension: 0.1,
      },
      {
        label: 'Precipitation (mm)',
        data: precipitations,
        borderColor: '#4dabf7',
        backgroundColor: 'rgba(77, 171, 247, 0.1)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#4dabf7',
        yAxisID: 'y1',
        tension: 0.1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      title: {
        display: true,
        text: title,
        font: { size: 13, weight: 'bold' },
        color: '#333',
      },
      legend: {
        position: 'right',
        labels: { font: { size: 11 }, usePointStyle: true },
      },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        titleFont: { size: 11 },
        bodyFont: { size: 11 },
        padding: 8,
        displayColors: true,
        borderColor: '#ddd',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { drawBorder: true, color: '#eee' },
        ticks: { font: { size: 10 } },
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Temperature (°C)',
          font: { size: 11, weight: 'bold' },
          color: '#ff6b6b',
        },
        ticks: { font: { size: 10 } },
        grid: { drawBorder: true, color: '#eee' },
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Precipitation (mm)',
          font: { size: 11, weight: 'bold' },
          color: '#4dabf7',
        },
        ticks: { font: { size: 10 } },
        grid: { drawBorder: false },
      },
    },
  };

  return (
    <div className="chart-container">
      <Line ref={chartRef} data={chartData} options={options} />
    </div>
  );
}

export default Chart;
