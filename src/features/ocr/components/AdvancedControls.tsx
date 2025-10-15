import type { ChangeEvent, FC } from 'react';
import type { ProcessingParams } from '../types';

interface AdvancedControlsProps {
  params: ProcessingParams;
  onParamChange: (key: keyof ProcessingParams, value: number | boolean | string) => void;
}

const Slider: FC<{ label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; formatValue?: (value: number) => string; }> = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatValue
}) => (
  <div className="control-group">
    <label>
      {label}: {formatValue ? formatValue(value) : value.toFixed(1)}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(parseFloat(event.target.value))}
      />
    </label>
  </div>
);

const Checkbox: FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void; }> = ({
  label,
  checked,
  onChange
}) => (
  <div className="control-group">
    <label className="checkbox-label">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.checked)}
      />
      {label}
    </label>
  </div>
);

export const AdvancedControls: FC<AdvancedControlsProps> = ({
  params,
  onParamChange
}) => {
  return (
    <div className="advanced-controls">
      <h3>Advanced Processing</h3>

      {/* First row: 4 sliders */}
      <div className="controls-row-4">
        <Slider
          label="Contrast"
          value={params.contrast}
          min={0.5}
          max={2.0}
          step={0.1}
          onChange={(value) => onParamChange('contrast', value)}
        />

        <Slider
          label="Brightness"
          value={params.brightness}
          min={-0.5}
          max={0.5}
          step={0.1}
          onChange={(value) => onParamChange('brightness', value)}
        />

        <Slider
          label="Sharpness"
          value={params.sharpness}
          min={0.5}
          max={2.0}
          step={0.1}
          onChange={(value) => onParamChange('sharpness', value)}
        />

        <Slider
          label="Gaussian Blur"
          value={params.gaussianBlur}
          min={0}
          max={5.0}
          step={0.5}
          onChange={(value) => onParamChange('gaussianBlur', value)}
        />
      </div>

      {/* Second row: Morphology dropdown + 4 checkboxes */}
      <div className="controls-row-mixed">
        <div className="control-group">
          <label>
            Morphology:
            <select
              value={params.morphology}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => onParamChange('morphology', event.target.value)}
            >
              <option value="none">None</option>
              <option value="erode">Erode (Thin)</option>
              <option value="dilate">Dilate (Thicken)</option>
            </select>
          </label>
        </div>

        <Checkbox
          label="📐 Deskew (Hough)"
          checked={params.correctSkew}
          onChange={(checked) => onParamChange('correctSkew', checked)}
        />

        <Checkbox
          label="CLAHE"
          checked={params.useClahe}
          onChange={(checked) => onParamChange('useClahe', checked)}
        />

        <Checkbox
          label="Bilateral Filter"
          checked={params.bilateralFilter}
          onChange={(checked) => onParamChange('bilateralFilter', checked)}
        />

        <Checkbox
          label="Adaptive Threshold"
          checked={params.useAdaptiveThreshold}
          onChange={(checked) => onParamChange('useAdaptiveThreshold', checked)}
        />
      </div>
    </div>
  );
};
