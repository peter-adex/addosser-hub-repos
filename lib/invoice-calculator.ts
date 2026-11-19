export interface LineItem {
  id:          string;
  description: string;
  quantity:    number;
  unitCost:    number;
  totalCost:   number;
}

export interface InvoiceBreakdown {
  subtotal:       number;
  vatRate:        number;
  vatAmount:      number;
  whtRate:        number;
  whtAmount:      number;
  totalWithVat:   number;
  amountPayable:  number;
}

export function computeLineTotal(qty: number, unitCost: number): number {
  return Math.round(qty * unitCost * 100) / 100;
}

export function computeInvoiceBreakdown(
  items:   LineItem[],
  vatRate: number = 0.075,
  whtRate: number = 0.02,
): InvoiceBreakdown {
  const subtotal  = items.reduce((sum, item) => sum + item.totalCost, 0);
  const vatAmount = Math.round(subtotal * vatRate * 100) / 100;
  const whtAmount = Math.round(subtotal * whtRate * 100) / 100;

  return {
    subtotal,
    vatRate,
    vatAmount,
    whtRate,
    whtAmount,
    totalWithVat:  Math.round((subtotal + vatAmount) * 100) / 100,
    amountPayable: Math.round((subtotal + vatAmount - whtAmount) * 100) / 100,
  };
}

export function newLineItemId(): string {
  return `li_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createBlankLineItem(): LineItem {
  return { id: newLineItemId(), description: "", quantity: 1, unitCost: 0, totalCost: 0 };
}
