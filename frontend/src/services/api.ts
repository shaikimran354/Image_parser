const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

export interface InvoiceItem {
  description: string;
  quantity: string;
  unit_price: string;
  amount: string;
  [key: string]: any;
}

export interface ConfidenceDetails {
  llm_confidence?: number;
  math_confidence?: number;
  text_match_confidence?: number;
  field_matches?: Record<string, boolean>;
}

export interface InvoiceData {
  invoice_number: string;
  invoice_date: string;
  vendor_name: string;
  vendor_address: string;
  bill_to_name?: string;
  bill_to_address?: string;
  bill_to_phone?: string;
  ship_to_name?: string;
  ship_to_address?: string;
  ship_to_phone?: string;
  gst_number: string;
  phone: string;
  email: string;
  subtotal: string;
  tax: string;
  discount: string;
  grand_total: string;
  currency: string;
  payment_terms: string;
  po_number?: string;
  due_date?: string;
  shipping_charges?: string;
  amount_paid?: string;
  balance_due?: string;
  items: InvoiceItem[];
  confidence_details?: ConfidenceDetails;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Allows custom fields/keys added dynamically
}

export interface UploadResponse {
  id: string;
  data: InvoiceData;
  processing_time?: number;
}

export interface CustomSchema {
  [key: string]: any;
  vendor: { key: string; label: string }[];
  customer: { key: string; label: string }[];
  invoice: { key: string; label: string }[];
  amount: { key: string; label: string }[];
  deletedStandardFields?: string[];
  deletedItemColumns?: string[];
}

/**
 * Utility function to trigger browser file download from Blob.
 */
function downloadFile(blob: Blob, fallbackName: string, headers: Headers) {
  let filename = fallbackName;
  const disposition = headers.get('content-disposition');
  if (disposition && disposition.includes('attachment')) {
    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
    const matches = filenameRegex.exec(disposition);
    if (matches !== null && matches[1]) {
      filename = matches[1].replace(/['"]/g, '');
    }
  }

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export const apiService = {
  /**
   * Pipeline 1: Upload Digital PDF
   */
  async uploadDigital(file: File, model?: string): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const url = model ? `${API_BASE_URL}/upload/digital?model=${model}` : `${API_BASE_URL}/upload/digital`;

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ detail: 'Unknown error occurred.' }));
      throw new Error(errData.detail || 'Failed to upload digital invoice.');
    }

    return response.json();
  },

  /**
   * Pipeline 2: Upload Scanned/Noisy PDF
   */
  async uploadScanned(file: File, model?: string): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const url = model ? `${API_BASE_URL}/upload/scanned?model=${model}` : `${API_BASE_URL}/upload/scanned`;

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ detail: 'Unknown error occurred.' }));
      throw new Error(errData.detail || 'Failed to upload scanned invoice.');
    }

    return response.json();
  },

  /**
   * Pipeline 3: Upload Handwritten PDF (Multimodal Vision)
   */
  async uploadHandwritten(file: File, model?: string): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const url = model ? `${API_BASE_URL}/upload/handwritten?model=${model}` : `${API_BASE_URL}/upload/handwritten`;

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ detail: 'Unknown error occurred.' }));
      throw new Error(errData.detail || 'Failed to upload handwritten invoice.');
    }

    return response.json();
  },

  /**
   * Fetch structured invoice by ID
   */
  async getResult(invoiceId: string): Promise<InvoiceData> {
    const response = await fetch(`${API_BASE_URL}/result/${invoiceId}`);
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ detail: 'Result not found.' }));
      throw new Error(errData.detail || 'Failed to fetch invoice details.');
    }

    return response.json();
  },

  /**
   * Fetch rendered PDF page image URL paths
   */
  async getPdfPages(invoiceId: string): Promise<{ pages: string[] }> {
    const response = await fetch(`${API_BASE_URL}/pdf/${invoiceId}/pages`);
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ detail: 'Failed to fetch pages.' }));
      throw new Error(errData.detail || 'Failed to retrieve PDF page list.');
    }

    return response.json();
  },


  /**
   * Fetch custom schema
   */
  async getCustomSchema(): Promise<CustomSchema> {
    const response = await fetch(`${API_BASE_URL}/schema/custom`);
    if (!response.ok) {
      return { vendor: [], customer: [], invoice: [], amount: [] };
    }
    return response.json();
  },

  /**
   * Save custom schema
   */
  async saveCustomSchema(schema: CustomSchema): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/schema/custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schema),
    });
    if (!response.ok) {
      throw new Error('Failed to save custom schema.');
    }
  },

  /**
   * Export details to JSON file
   */
  async exportJson(data: InvoiceData): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/export/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to generate JSON file.');
    }

    const blob = await response.blob();
    downloadFile(blob, 'invoice.json', response.headers);
  },

  /**
   * Export items to CSV file
   */
  async exportCsv(data: InvoiceData): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/export/csv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to generate CSV file.');
    }

    const blob = await response.blob();
    downloadFile(blob, 'invoice_items.csv', response.headers);
  },

  /**
   * Export full spreadsheet to Excel (.xlsx)
   */
  async exportExcel(data: InvoiceData): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/export/excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to generate Excel file.');
    }

    const blob = await response.blob();
    downloadFile(blob, 'invoice.xlsx', response.headers);
  },

  /**
   * Update the backend model settings in .env
   */
  async updateModelSettings(model: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/settings/model?model=${model}`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Failed to update model settings.');
    }
  }
};
