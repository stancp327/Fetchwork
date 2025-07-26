import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders FetchWork heading', () => {
  render(<App />);
  const headingElements = screen.getAllByText(/FetchWork/i);
  expect(headingElements.length).toBeGreaterThan(0);
});
