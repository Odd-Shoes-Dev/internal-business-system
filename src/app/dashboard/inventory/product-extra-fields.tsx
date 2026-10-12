'use client';

// Barcode, shelf location and purchase-unit fields, shared by the new and edit product forms.

export interface ProductExtraValues {
  barcode: string;
  shelf_location: string;
  purchase_unit: string;
  units_per_purchase_unit: number;
}

export const EMPTY_PRODUCT_EXTRAS: ProductExtraValues = {
  barcode: '',
  shelf_location: '',
  purchase_unit: '',
  units_per_purchase_unit: 1,
};

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]';

export default function ProductExtraFields({
  values,
  onChange,
  isService,
  stockUnit,
}: {
  values: ProductExtraValues;
  onChange: (patch: Partial<ProductExtraValues>) => void;
  isService: boolean;
  stockUnit: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="font-semibold text-gray-900 mb-4">{isService ? 'Identification' : 'Identification & Purchasing'}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
          <input
            className={inputClass}
            value={values.barcode}
            onChange={(e) => onChange({ barcode: e.target.value })}
            placeholder="Scan or type the barcode"
          />
          <p className="text-xs text-gray-500 mt-1">Used to find the item when scanned at the till</p>
        </div>

        {!isService && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shelf location</label>
            <input
              className={inputClass}
              value={values.shelf_location}
              onChange={(e) => onChange({ shelf_location: e.target.value })}
              placeholder="e.g. Aisle 3, Shelf B"
            />
          </div>
        )}

        {!isService && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bought in (purchase unit)</label>
              <input
                className={inputClass}
                value={values.purchase_unit}
                onChange={(e) => onChange({ purchase_unit: e.target.value })}
                placeholder="e.g. carton, crate, sack (leave empty if the same)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {stockUnit || 'Units'} per {values.purchase_unit || 'purchase unit'}
              </label>
              <input
                type="number"
                min="0.0001"
                step="any"
                className={inputClass}
                value={values.units_per_purchase_unit}
                onChange={(e) => onChange({ units_per_purchase_unit: Number(e.target.value) || 1 })}
              />
              {values.purchase_unit && values.units_per_purchase_unit > 1 && (
                <p className="text-xs text-gray-500 mt-1">
                  Receiving 2 {values.purchase_unit}s adds {2 * values.units_per_purchase_unit} {stockUnit || 'units'} to stock
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
