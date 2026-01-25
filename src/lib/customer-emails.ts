// Customer Email Helper Functions
// Utility functions for handling multiple email addresses per customer

import type { Customer } from '@/types/database';

/**
 * Get all email addresses for a customer
 * @param customer - Customer object
 * @returns Array of non-null email addresses
 */
export function getCustomerEmails(customer: Customer | null | undefined): string[] {
  if (!customer) return [];
  
  const emails: string[] = [];
  
  if (customer.email) emails.push(customer.email);
  if (customer.email_2) emails.push(customer.email_2);
  if (customer.email_3) emails.push(customer.email_3);
  if (customer.email_4) emails.push(customer.email_4);
  
  return emails;
}

/**
 * Get primary email address for a customer
 * @param customer - Customer object
 * @returns Primary email or null
 */
export function getPrimaryEmail(customer: Customer | null | undefined): string | null {
  return customer?.email || null;
}

/**
 * Get all secondary email addresses (excluding primary)
 * @param customer - Customer object
 * @returns Array of secondary email addresses
 */
export function getSecondaryEmails(customer: Customer | null | undefined): string[] {
  if (!customer) return [];
  
  const emails: string[] = [];
  
  if (customer.email_2) emails.push(customer.email_2);
  if (customer.email_3) emails.push(customer.email_3);
  if (customer.email_4) emails.push(customer.email_4);
  
  return emails;
}

/**
 * Format email addresses for display
 * @param customer - Customer object
 * @returns Formatted string of all emails
 */
export function formatCustomerEmails(customer: Customer | null | undefined): string {
  const emails = getCustomerEmails(customer);
  return emails.join(', ') || 'No email';
}

/**
 * Check if customer has multiple email addresses
 * @param customer - Customer object
 * @returns True if customer has more than one email
 */
export function hasMultipleEmails(customer: Customer | null | undefined): boolean {
  return getCustomerEmails(customer).length > 1;
}

/**
 * Get email count for customer
 * @param customer - Customer object
 * @returns Number of email addresses
 */
export function getEmailCount(customer: Customer | null | undefined): number {
  return getCustomerEmails(customer).length;
}
