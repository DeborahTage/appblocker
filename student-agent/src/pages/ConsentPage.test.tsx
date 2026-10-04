import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConsentPage } from './ConsentPage';

vi.mock('../hooks/useTauri', () => ({
  agreeConsent: vi.fn(),
}));

describe('ConsentPage', () => {
  it('shows required disclosures and agree button', () => {
    render(<ConsentPage />);
    expect(
      screen.getByText(/only monitors which application is currently active/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/record your screen/i)).toBeInTheDocument();
    expect(screen.getByText(/record your keyboard/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I Agree' })).toBeInTheDocument();
  });
});
