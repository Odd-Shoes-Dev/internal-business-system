export interface RequisitionLineData {
  product_name: string;
  unit_of_measure?: string | null;
  quantity_requested: number;
  quantity_delivered: number;
  remarks?: string | null;
}

export interface RequisitionDeliveryData {
  delivery_number: string;
  delivery_date: string;
  status: string;
}

export interface RequisitionPrintData {
  requisition_number: string;
  client_name: string;
  delivery_location?: string | null;
  request_date: string;
  status: string;
  notes?: string | null;
  created_by_name?: string | null;
  created_at: string;
  lines: RequisitionLineData[];
  deliveries: RequisitionDeliveryData[];
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

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  partial: 'Partial',
  completed: 'Completed',
  closed: 'Closed',
};

export function printRequisition(data: RequisitionPrintData): void {
  const html = generateRequisitionHTML(data);
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

export function generateRequisitionHTML(data: RequisitionPrintData): string {
  const company = data.company || {};

  const rows = data.lines
    .map((line) => {
      const pending = Math.max(0, Number(line.quantity_requested) - Number(line.quantity_delivered));
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

  const deliveryRows = data.deliveries
    .map((d) => `
              <tr>
                <td>${esc(d.delivery_number)}</td>
                <td>${esc(d.delivery_date)}</td>
                <td>${esc(d.status === 'voided' ? 'Voided' : 'Active')}</td>
              </tr>`)
    .join('');

  return `
    <html>
      <head>
        <title>Requisition ${esc(data.requisition_number)} - ${esc(company.name || 'Company')}</title>
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
          .status-open { background: #f3f4f6; color: #374151; }
          .status-partial { background: #fef3c7; color: #92400e; }
          .status-completed { background: #d1fae5; color: #065f46; }
          .status-closed { background: #fee2e2; color: #991b1b; }
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
          .section-heading { font-size: 12px; font-weight: bold; color: #6b7280; margin: 25px 0 10px; text-transform: uppercase; }
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
            <h2>STOCK REQUISITION</h2>
            <p class="number">#${esc(data.requisition_number)}</p>
            <span class="status-badge status-${data.status}">${esc((STATUS_LABELS[data.status] || data.status).toUpperCase())}</span>
          </div>
        </div>

        <div class="doc-details">
          <div class="section">
            <h3>Client / Delivery To</h3>
            <p><strong>${esc(data.client_name)}</strong></p>
            ${data.delivery_location ? `<p>${esc(data.delivery_location)}</p>` : ''}
          </div>
          <div class="section">
            <h3>Request Details</h3>
            <p><strong>Request Date:</strong> ${esc(data.request_date)}</p>
            <p><strong>Requested by:</strong> ${esc(data.created_by_name || 'Unknown')}</p>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 34%">Item</th>
              <th class="text-right" style="width: 16%">Qty Requested</th>
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

        ${data.deliveries.length > 0 ? `
        <p class="section-heading">Delivery Forms Issued Against This Requisition</p>
        <table class="items-table">
          <thead>
            <tr>
              <th>Delivery No.</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${deliveryRows}
          </tbody>
        </table>
        ` : ''}

        <div class="footer">
          <p>This is a computer-generated document.</p>
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
      </body>
    </html>
  `;
}
