import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SpeedControls } from '../editor/SpeedControls';

describe('SpeedControls', () => {
  const defaultProps = {
    value: 1,
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders speed controls with correct initial value', () => {
    render(<SpeedControls {...defaultProps} />);
    
    expect(screen.getByText('Speed Multiplier')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    expect(screen.getByText('1× = normal speed, 100× = maximum compression')).toBeInTheDocument();
  });

  it('renders all preset buttons', () => {
    render(<SpeedControls {...defaultProps} />);
    
    expect(screen.getByRole('button', { name: '1×' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2×' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '4×' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '8×' })).toBeInTheDocument();
  });

  it('highlights active preset button', () => {
    render(<SpeedControls {...defaultProps} value={4} />);
    
    const activeButton = screen.getByRole('button', { name: '4×' });
    const inactiveButton = screen.getByRole('button', { name: '2×' });
    
    // Active button should have default variant (primary styling)
    expect(activeButton).toHaveClass('shadow-card');
    
    // Inactive buttons should have outline variant
    expect(inactiveButton).not.toHaveClass('shadow-card');
  });

  it('handles preset button clicks', () => {
    render(<SpeedControls {...defaultProps} />);
    
    const preset2xButton = screen.getByRole('button', { name: '2×' });
    fireEvent.click(preset2xButton);
    
    expect(defaultProps.onChange).toHaveBeenCalledWith(2);
  });

  it('handles custom input changes', () => {
    render(<SpeedControls {...defaultProps} />);
    
    const input = screen.getByDisplayValue('1');
    fireEvent.change(input, { target: { value: '3.5' } });
    
    expect(defaultProps.onChange).toHaveBeenCalledWith(3.5);
  });

  it('validates input range (minimum)', () => {
    render(<SpeedControls {...defaultProps} />);
    
    const input = screen.getByDisplayValue('1');
    fireEvent.change(input, { target: { value: '0.5' } });
    
    // Should not call onChange for values below 1
    expect(defaultProps.onChange).not.toHaveBeenCalled();
  });

  it('validates input range (maximum)', () => {
    render(<SpeedControls {...defaultProps} />);
    
    const input = screen.getByDisplayValue('1');
    fireEvent.change(input, { target: { value: '150' } });
    
    // Should not call onChange for values above 100
    expect(defaultProps.onChange).not.toHaveBeenCalled();
  });

  it('accepts valid decimal values', () => {
    render(<SpeedControls {...defaultProps} />);
    
    const input = screen.getByDisplayValue('1');
    fireEvent.change(input, { target: { value: '2.5' } });
    
    expect(defaultProps.onChange).toHaveBeenCalledWith(2.5);
  });

  it('ignores invalid input values', () => {
    render(<SpeedControls {...defaultProps} />);
    
    const input = screen.getByDisplayValue('1');
    fireEvent.change(input, { target: { value: 'abc' } });
    
    // Should not call onChange for non-numeric values
    expect(defaultProps.onChange).not.toHaveBeenCalled();
  });

  it('displays correct input attributes', () => {
    render(<SpeedControls {...defaultProps} />);
    
    const input = screen.getByDisplayValue('1');
    
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveAttribute('min', '1');
    expect(input).toHaveAttribute('max', '100');
    expect(input).toHaveAttribute('step', '0.5');
  });

  it('has proper styling classes', () => {
    render(<SpeedControls {...defaultProps} />);
    
    const input = screen.getByDisplayValue('1');
    expect(input).toHaveClass('text-center');
    
    // Check that preset buttons have flex-1 class for equal width
    const presetButtons = screen.getAllByRole('button').filter(btn => 
      btn.textContent?.includes('×')
    );
    
    presetButtons.forEach(button => {
      expect(button).toHaveClass('flex-1', 'text-xs');
    });
  });

  it('displays gauge icon in label', () => {
    render(<SpeedControls {...defaultProps} />);
    
    const label = screen.getByText('Speed Multiplier');
    expect(label).toHaveClass('flex', 'items-center', 'gap-2');
  });

  it('handles edge case values correctly', () => {
    render(<SpeedControls {...defaultProps} />);
    
    const input = screen.getByDisplayValue('1');
    
    // Test exact boundary values
    fireEvent.change(input, { target: { value: '1' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith(1);
    
    fireEvent.change(input, { target: { value: '100' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith(100);
  });

  it('updates display value when prop changes', () => {
    const { rerender } = render(<SpeedControls {...defaultProps} value={1} />);
    
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    
    rerender(<SpeedControls {...defaultProps} value={8} />);
    
    expect(screen.getByDisplayValue('8')).toBeInTheDocument();
    
    // Check that the corresponding preset button is highlighted
    const activeButton = screen.getByRole('button', { name: '8×' });
    expect(activeButton).toHaveClass('shadow-card');
  });

  it('handles non-preset values correctly', () => {
    render(<SpeedControls {...defaultProps} value={3.5} />);
    
    // Input should show the custom value
    expect(screen.getByDisplayValue('3.5')).toBeInTheDocument();
    
    // No preset button should be highlighted
    const presetButtons = screen.getAllByRole('button').filter(btn => 
      btn.textContent?.includes('×')
    );
    
    presetButtons.forEach(button => {
      expect(button).not.toHaveClass('shadow-card');
    });
  });

  it('maintains input focus during typing', () => {
    render(<SpeedControls {...defaultProps} />);
    
    const input = screen.getByDisplayValue('1');
    input.focus();
    
    expect(document.activeElement).toBe(input);
    
    fireEvent.change(input, { target: { value: '2' } });
    
    // Input should still be focused after change
    expect(document.activeElement).toBe(input);
  });
});