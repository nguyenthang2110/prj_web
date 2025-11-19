import React, { useState } from 'react';

const TIME_RANGES = [
  { label: 'Last 5 minutes', value: 'now-5m', to: 'now' },
  { label: 'Last 15 minutes', value: 'now-15m', to: 'now' },
  { label: 'Last 30 minutes', value: 'now-30m', to: 'now' },
  { label: 'Last 1 hour', value: 'now-1h', to: 'now' },
  { label: 'Last 3 hours', value: 'now-3h', to: 'now' },
  { label: 'Last 6 hours', value: 'now-6h', to: 'now' },
  { label: 'Last 12 hours', value: 'now-12h', to: 'now' },
  { label: 'Last 24 hours', value: 'now-24h', to: 'now' }
];

function TimeRangePicker({ value, onChange }) {
  const [showPicker, setShowPicker] = useState(false);

  const getCurrentLabel = () => {
    const range = TIME_RANGES.find(r => r.value === value.from);
    return range ? range.label : 'Custom Range';
  };

  const selectRange = (range) => {
    onChange({ from: range.value, to: range.to });
    setShowPicker(false);
  };

  return (
    <div className="time-range-picker">
      <button 
        className="time-range-btn"
        onClick={() => setShowPicker(!showPicker)}
      >
        🕐 {getCurrentLabel()}
      </button>

      {showPicker && (
        <div className="time-range-dropdown">
          <div className="time-range-header">
            <h4>Time Range</h4>
            <button onClick={() => setShowPicker(false)}>✕</button>
          </div>
          
          <div className="time-range-options">
            <h5>Quick ranges</h5>
            {TIME_RANGES.map(range => (
              <div
                key={range.value}
                className={`time-range-option ${value.from === range.value ? 'active' : ''}`}
                onClick={() => selectRange(range)}
              >
                {range.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default TimeRangePicker;