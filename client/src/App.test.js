import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders FetchWork heading', () => {
  render(<App />);
  const headingElement = screen.getByText(/FetchWork/i);
  expect(headingElement).toBeInTheDocument();
});
