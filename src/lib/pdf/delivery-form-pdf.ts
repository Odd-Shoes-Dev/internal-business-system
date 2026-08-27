export interface DeliveryFormLineData {
  product_name: string;
  unit_of_measure?: string | null;
  quantity_requested: number;
  quantity_delivered_total: number;
  quantity_delivered: number;
  remarks?: string | null;
}

export interface DeliveryFormData {
  delivery_number: string;
  delivery_date: string;
  delivered_by?: string | null;
  received_by?: string | null;
  notes?: string | null;
  requisition_number: string;
  client_name: string;
  delivery_location?: string | null;
  status: 'active' | 'voided';
  lines: DeliveryFormLineData[];
  company?: {
    name?: string;
    logo_url?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    tax_id?: string | null;
    registration_number?: string | null;
    duns_number?: string | null;
  };
}

function esc(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

function formatQty(value: number): string {
  const n = Number(value || 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function printDeliveryForm(data: DeliveryFormData): void {
  const html = generateDeliveryFormHTML(data);
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

export function generateDeliveryFormHTML(data: DeliveryFormData): string {
  const company = data.company || {};

  const rows = data.lines
    .map((line) => {
      const pending = Math.max(0, Number(line.quantity_requested) - Number(line.quantity_delivered_total));
      return `
              <tr>
                <td>${esc(line.product_name)}${line.unit_of_measure ? ` <span style="color:#6b7280;font-size:11px;">(${esc(line.unit_of_measure)})</span>` : ''}</td>
                <td class="text-right">${formatQty(line.quantity_requested)}</td>
                <td class="text-right">${formatQty(line.quantity_delivered)}</td>
                <td class="text-right">${formatQty(pending)}</td>
                <td>${esc(line.remarks)}</td>
              </tr>`;
    })
    .join('');

  return `
    <html>
      <head>
        <title>Delivery Form ${esc(data.delivery_number)} - ${esc(company.name || 'Company')}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #111827;
            background: white;
            padding: 40px;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 30px;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 20px;
          }
          .company-section { display: flex; align-items: center; }
          .logo { width: 200px; height: 200px; margin-right: 20px; border-radius: 8px; object-fit: contain; }
          .company-info h1 { font-size: 24px; font-weight: bold; color: #1e3a5f; margin-bottom: 8px; }
          .company-info .address { font-size: 11px; color: #6b7280; margin-bottom: 3px; line-height: 1.5; }
          .doc-header { text-align: right; }
          .doc-header h2 { font-size: 28px; font-weight: bold; color: #1e3a5f; margin-bottom: 4px; }
          .doc-header .number { font-size: 14px; color: #6b7280; }
          .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            margin-top: 8px;
          }
          .status-active { background: #d1fae5; color: #065f46; }
          .status-voided { background: #fee2e2; color: #991b1b; }
          .doc-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 25px 0;
          }
          .section { border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb; }
          .section h3 { font-size: 12px; font-weight: bold; color: #6b7280; margin-bottom: 10px; text-transform: uppercase; }
          .section p { font-size: 14px; color: #111827; margin-bottom: 4px; }
          .items-table { width: 100%; border-collapse: collapse; margin: 25px 0; }
          .items-table thead { background: #f9fafb; }
          .items-table th {
            text-align: left; padding: 12px; font-size: 12px; font-weight: bold; color: #6b7280;
            text-transform: uppercase; border-bottom: 2px solid #e5e7eb;
          }
          .items-table th.text-right { text-align: right; }
          .items-table td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
          .items-table td.text-right { text-align: right; }
          .signatures { display: flex; gap: 60px; margin: 40px 0 20px; }
          .signature { flex: 1; }
          .signature .sig-line { border-top: 1px solid #111827; margin-top: 50px; padding-top: 8px; font-size: 12px; color: #6b7280; }
          .notes-section { margin: 25px 0; padding: 20px; background: #f9fafb; border-radius: 8px; }
          .notes-section h3 { font-size: 12px; font-weight: bold; color: #6b7280; margin-bottom: 10px; text-transform: uppercase; }
          .notes-section p { font-size: 14px; color: #111827; white-space: pre-wrap; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #6b7280; }
          @media print {
            body { padding: 20px; }
            @page { margin: 0.5in; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-section">
            ${company.logo_url ? `<img src="${esc(company.logo_url)}" alt="${esc(company.name)} Logo" class="logo" />` : ''}
            <div class="company-info">
              <h1>${esc(company.name || 'Company Name')}</h1>
              ${company.address ? `<p class="address">${esc(company.address)}</p>` : ''}
              ${company.phone ? `<p class="address">Tel: ${esc(company.phone)}</p>` : ''}
              ${company.email ? `<p class="address">Email: ${esc(company.email)}</p>` : ''}
              ${[company.tax_id ? `TIN: ${company.tax_id}` : '', company.registration_number ? `Reg. No: ${company.registration_number}` : '', company.duns_number ? `DUNS: ${company.duns_number}` : ''].filter(Boolean).map(s => `<p class="address">${esc(s)}</p>`).join('')}
            </div>
          </div>
          <div class="doc-header">
            <h2>DELIVERY FORM</h2>
            <p class="number">#${esc(data.delivery_number)}</p>
            <p class="number">Requisition ${esc(data.requisition_number)}</p>
            <span class="status-badge status-${data.status}">${data.status === 'voided' ? 'VOIDED' : 'ACTIVE'}</span>
          </div>
        </div>

        <div class="doc-details">
          <div class="section">
            <h3>Delivery To</h3>
            <p><strong>${esc(data.client_name)}</strong></p>
            ${data.delivery_location ? `<p>${esc(data.delivery_location)}</p>` : ''}
          </div>
          <div class="section">
            <h3>Delivery Details</h3>
            <p><strong>Date:</strong> ${esc(data.delivery_date)}</p>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 34%">Item</th>
              <th class="text-right" style="width: 16%">Qty Due</th>
              <th class="text-right" style="width: 16%">Qty Delivered</th>
              <th class="text-right" style="width: 16%">Qty Pending</th>
              <th style="width: 18%">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        ${data.notes ? `
        <div class="notes-section">
          <h3>Notes</h3>
          <p>${esc(data.notes)}</p>
        </div>
        ` : ''}

        <div class="signatures">
          <div class="signature">
            <p class="sig-line">Delivered by: ${esc(data.delivered_by || '')}</p>
          </div>
          <div class="signature">
            <p class="sig-line">Received by: ${esc(data.received_by || '')}</p>
          </div>
        </div>

        <div class="footer">
          <p>This is a computer-generated document.</p>
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
      </body>
    </html>
  `;
}
