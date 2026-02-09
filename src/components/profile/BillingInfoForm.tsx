import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface BillingInfo {
  company: string | null;
  vat: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  country: string | null;
  postal_code: string | null;
}

// Common countries for selection
const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'IT', label: 'Italy' },
  { value: 'ES', label: 'Spain' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'BE', label: 'Belgium' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'AT', label: 'Austria' },
  { value: 'SE', label: 'Sweden' },
  { value: 'NO', label: 'Norway' },
  { value: 'DK', label: 'Denmark' },
  { value: 'FI', label: 'Finland' },
  { value: 'IE', label: 'Ireland' },
  { value: 'PT', label: 'Portugal' },
  { value: 'PL', label: 'Poland' },
  { value: 'CZ', label: 'Czech Republic' },
  { value: 'JP', label: 'Japan' },
  { value: 'KR', label: 'South Korea' },
  { value: 'SG', label: 'Singapore' },
  { value: 'HK', label: 'Hong Kong' },
  { value: 'IN', label: 'India' },
  { value: 'BR', label: 'Brazil' },
  { value: 'MX', label: 'Mexico' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'NZ', label: 'New Zealand' },
];

interface BillingInfoFormProps {
  value: BillingInfo;
  onChange: (value: BillingInfo) => void;
  disabled?: boolean;
  readOnly?: boolean;
  showFullDetails?: boolean; // Only admin can see full details
}

export function BillingInfoForm({ 
  value, 
  onChange, 
  disabled, 
  readOnly,
  showFullDetails = false 
}: BillingInfoFormProps) {
  const handleChange = (field: keyof BillingInfo, newValue: string) => {
    onChange({ ...value, [field]: newValue || null });
  };

  // Read-only view for non-admins (only city and country)
  if (readOnly && !showFullDetails) {
    return (
      <div className="space-y-2">
        <Label>Location</Label>
        <p className="text-sm">
          {value.city && value.country
            ? `${value.city}, ${COUNTRIES.find(c => c.value === value.country)?.label || value.country}`
            : value.city || 
              (value.country ? COUNTRIES.find(c => c.value === value.country)?.label : 'Not specified')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="company">Company Name</Label>
        <Input
          id="company"
          value={value.company || ''}
          onChange={(e) => handleChange('company', e.target.value)}
          placeholder="Company name (optional)"
          disabled={disabled || readOnly}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="vat">VAT Number</Label>
        <Input
          id="vat"
          value={value.vat || ''}
          onChange={(e) => handleChange('vat', e.target.value)}
          placeholder="VAT number (optional)"
          disabled={disabled || readOnly}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address_line1">Address Line 1</Label>
        <Input
          id="address_line1"
          value={value.address_line1 || ''}
          onChange={(e) => handleChange('address_line1', e.target.value)}
          placeholder="Street address"
          disabled={disabled || readOnly}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address_line2">Address Line 2</Label>
        <Input
          id="address_line2"
          value={value.address_line2 || ''}
          onChange={(e) => handleChange('address_line2', e.target.value)}
          placeholder="Apartment, suite, etc. (optional)"
          disabled={disabled || readOnly}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={value.city || ''}
            onChange={(e) => handleChange('city', e.target.value)}
            placeholder="City"
            disabled={disabled || readOnly}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="postal_code">Postal Code</Label>
          <Input
            id="postal_code"
            value={value.postal_code || ''}
            onChange={(e) => handleChange('postal_code', e.target.value)}
            placeholder="Postal code"
            disabled={disabled || readOnly}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="country">Country</Label>
        <Select
          value={value.country || ''}
          onValueChange={(v) => handleChange('country', v)}
          disabled={disabled || readOnly}
        >
          <SelectTrigger id="country">
            <SelectValue placeholder="Select a country" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((country) => (
              <SelectItem key={country.value} value={country.value}>
                {country.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
