# BlueOx Business Platform - API Integration Guide

**Version:** 2.0.0  
**Last Updated:** February 6, 2026  
**Base URL:** `https://api.blueox.app`  
**Authentication:** API Key  

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [Integration Examples](#integration-examples)
5. [Error Handling](#error-handling)
6. [Rate Limits](#rate-limits)
7. [Webhooks](#webhooks)
8. [SDKs & Libraries](#sdks--libraries)

---

## 🌟 Overview

The BlueOx Business Platform API allows external systems to integrate with our comprehensive business management platform. Our API supports:

- **Real-time transaction sync** from POS systems, e-commerce platforms, and other business applications
- **Financial data retrieval** for dashboards, reporting, and analytics
- **Customer and inventory synchronization**
- **Automated double-entry bookkeeping** from external transactions

### Who Can Use This API?

- **POS System Developers** - Integrate salon, restaurant, or retail POS systems
- **E-commerce Platform Builders** - Sync online sales with accounting
- **Business Software Vendors** - Connect specialized industry software
- **Enterprise IT Teams** - Build custom integrations for large organizations

---

## 🔐 Authentication

### API Key Authentication

All API requests require authentication using an API key in the Authorization header:

```bash
Authorization: Bearer bmp_your_api_key_here
X-System-ID: your_system_identifier
```

### Getting API Keys

1. **Contact your BlueOx administrator** or sales team
2. **Request API access** for your integration project
3. **Receive credentials** with appropriate permissions
4. **Test in sandbox environment** before going live

### API Key Permissions

| Permission | Description | Example Use |
|------------|-------------|-------------|
| `read:financial_reports` | Access financial summaries and reports | Dashboard widgets |
| `write:transactions` | Create journal entries and transactions | POS sale sync |
| `read:customer_data` | Access customer information | CRM integration |
| `read:inventory` | Access inventory data | Stock level sync |
| `write:inventory` | Update inventory levels | Stock adjustments |

---

## 📡 API Endpoints

### 1. Webhook Endpoint (Primary Integration Method)

**POST** `/api/integrations/salon/webhook`

Send transaction data to BlueOx for automatic accounting entry creation.

#### Headers
```http
Authorization: Bearer bmp_your_api_key
X-System-ID: your_salon_id
Content-Type: application/json
```

#### Request Body
```json
{
  "event": "salon.sale.completed",
  "salon_id": "your_salon_identifier",
  "data": {
    "sale_id": "SALE_2026_001",
    "customer_name": "Sarah Johnson",
    "customer_id": "CUST_12345",
    "amount": 85000.00,
    "tax_amount": 12750.00,
    "payment_method": "mobile_money",
    "currency": "UGX",
    "services": [
      {
        "service_name": "Hair Cut & Style",
        "staff_member": "Maria Santos",
        "amount": 45000.00,
        "commission_amount": 9000.00
      },
      {
        "service_name": "Manicure",
        "staff_member": "Jane Doe", 
        "amount": 25000.00,
        "commission_amount": 5000.00
      }
    ],
    "timestamp": "2026-02-06T14:30:00Z",
    "reference_number": "REF_001"
  }
}
```

#### Response
```json
{
  "success": true,
  "journal_entry_id": "uuid-of-created-journal-entry",
  "amount_recorded": 85000.00,
  "message": "Sale successfully recorded in accounting system"
}
```

#### Supported Events

| Event Type | Description |
|------------|-------------|
| `salon.sale.completed` | Complete sale with services and payment |
| `salon.payment.received` | Payment received separately from sale |
| `salon.refund.issued` | Refund processed for previous sale |

### 2. Financial Summary Endpoint

**GET** `/api/integrations/reports/financial-summary`

Retrieve financial data for external dashboards and reporting.

#### Headers
```http
Authorization: Bearer bmp_your_api_key
X-System-ID: your_system_id
```

#### Query Parameters
```http
GET /api/integrations/reports/financial-summary?start_date=2026-02-01&end_date=2026-02-29
```

#### Response
```json
{
  "success": true,
  "data": {
    "period": {
      "start_date": "2026-02-01",
      "end_date": "2026-02-29"
    },
    "revenue": {
      "total_revenue": 2450000.00,
      "sales_count": 145,
      "average_sale": 16896.55
    },
    "expenses": {
      "total_expenses": 890000.00,
      "expense_count": 67
    },
    "cash": {
      "current_balance": 1250000.00,
      "cash_accounts": [
        {
          "id": "uuid-cash-account",
          "name": "Main Cash Account",
          "balance": 450000.00
        },
        {
          "id": "uuid-bank-account", 
          "name": "Business Bank Account",
          "balance": 800000.00
        }
      ]
    },
    "customers": {
      "total_customers": 234,
      "new_customers": 18,
      "active_customers": 78
    },
    "profitability": {
      "gross_profit": 1560000.00,
      "profit_margin": 63.67
    }
  }
}
```

### 3. API Key Management

**POST** `/api/integrations/api-keys`

Create new API keys for integrations (Admin only).

#### Request
```json
{
  "integration_name": "Hair Studio POS",
  "external_system_id": "hairstudio_001", 
  "permissions": ["write:transactions", "read:financial_reports"],
  "allowed_events": ["salon.sale.completed", "salon.payment.received"],
  "description": "Integration with Hair Studio POS system"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "integration_id": "uuid-here",
    "api_key": "bmp_generated_secure_key_here",
    "integration_name": "Hair Studio POS",
    "external_system_id": "hairstudio_001",
    "permissions": ["write:transactions", "read:financial_reports"],
    "allowed_events": ["salon.sale.completed", "salon.payment.received"]
  },
  "message": "API key created successfully. Store this key securely - it cannot be retrieved again."
}
```

---

## 💡 Integration Examples

### Example 1: Salon POS Integration

```javascript
// salon-pos-system/src/lib/bluox-integration.js
import axios from 'axios';

class BlueOxIntegration {
  constructor(apiKey, systemId, baseUrl = 'https://api.blueox.app') {
    this.apiKey = apiKey;
    this.systemId = systemId;
    this.baseUrl = baseUrl;
  }

  async syncSale(saleData) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/integrations/salon/webhook`,
        {
          event: 'salon.sale.completed',
          salon_id: this.systemId,
          data: {
            sale_id: saleData.id,
            customer_name: saleData.customer.name,
            customer_id: saleData.customer.id,
            amount: saleData.total,
            tax_amount: saleData.tax,
            payment_method: saleData.payment_method,
            currency: 'UGX',
            services: saleData.services,
            timestamp: new Date().toISOString(),
            reference_number: saleData.receipt_number
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'X-System-ID': this.systemId,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Sale synced to BlueOx:', response.data);
      return response.data;
    } catch (error) {
      console.error('BlueOx sync error:', error.response?.data || error.message);
      throw error;
    }
  }

  async getFinancialSummary(startDate, endDate) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/integrations/reports/financial-summary`,
        {
          params: { start_date: startDate, end_date: endDate },
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'X-System-ID': this.systemId
          }
        }
      );

      return response.data.data;
    } catch (error) {
      console.error('Financial summary error:', error.response?.data || error.message);
      throw error;
    }
  }
}

// Usage in your POS system
const blueox = new BlueOxIntegration('your_api_key', 'your_system_id');

// When a sale is completed
async function completeSale(saleData) {
  // Save to local database
  const sale = await saveSaleToLocalDB(saleData);
  
  // Sync to BlueOx accounting
  try {
    await blueox.syncSale(sale);
    console.log('Sale synced to BlueOx successfully');
  } catch (error) {
    console.error('Failed to sync to BlueOx:', error);
    // Handle error - maybe retry later or show warning
  }
  
  return sale;
}
```

### Example 2: Dashboard Integration

```javascript
// dashboard/src/components/FinancialWidget.jsx
import { useState, useEffect } from 'react';
import { BlueOxIntegration } from '../lib/bluox-client';

export default function FinancialWidget() {
  const [financialData, setFinancialData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const blueox = new BlueOxIntegration(process.env.BLUOX_API_KEY, process.env.SYSTEM_ID);
  
  useEffect(() => {
    async function fetchData() {
      try {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        
        const data = await blueox.getFinancialSummary(
          startDate.toISOString().split('T')[0],
          new Date().toISOString().split('T')[0]
        );
        
        setFinancialData(data);
      } catch (error) {
        console.error('Failed to fetch financial data:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, []);
  
  if (loading) return <div>Loading financial data...</div>;
  
  return (
    <div className="financial-widget">
      <h3>Financial Summary</h3>
      <div className="metrics">
        <div className="metric">
          <label>Total Revenue</label>
          <span>{formatCurrency(financialData.revenue.total_revenue)}</span>
        </div>
        <div className="metric">
          <label>Gross Profit</label>
          <span>{formatCurrency(financialData.profitability.gross_profit)}</span>
        </div>
        <div className="metric">  
          <label>Profit Margin</label>
          <span>{financialData.profitability.profit_margin.toFixed(1)}%</span>
        </div>
        <div className="metric">
          <label>Cash Balance</label>
          <span>{formatCurrency(financialData.cash.current_balance)}</span>
        </div>
      </div>
    </div>
  );
}
```

### Example 3: E-commerce Integration

```php
<?php
// ecommerce/includes/bluox-integration.php

class BlueOxIntegration {
    private $apiKey;
    private $systemId;
    private $baseUrl;
    
    public function __construct($apiKey, $systemId, $baseUrl = 'https://api.blueox.app') {
        $this->apiKey = $apiKey;
        $this->systemId = $systemId;
        $this->baseUrl = $baseUrl;
    }
    
    public function syncOrder($order) {
        $data = [
            'event' => 'ecommerce.order.completed',
            'salon_id' => $this->systemId,
            'data' => [
                'sale_id' => $order->id,
                'customer_name' => $order->customer_name,
                'customer_id' => $order->customer_id,
                'amount' => $order->total,
                'tax_amount' => $order->tax_total,
                'payment_method' => $order->payment_method,
                'currency' => $order->currency,
                'services' => $this->formatOrderItems($order->items),
                'timestamp' => date('c'),
                'reference_number' => $order->order_number
            ]
        ];
        
        $headers = [
            'Authorization: Bearer ' . $this->apiKey,
            'X-System-ID: ' . $this->systemId,
            'Content-Type: application/json'
        ];
        
        $curl = curl_init();
        curl_setopt_array($curl, [
            CURLOPT_URL => $this->baseUrl . '/api/integrations/salon/webhook',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($data),
            CURLOPT_HTTPHEADER => $headers
        ]);
        
        $response = curl_exec($curl);
        $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        
        if ($httpCode === 200) {
            return json_decode($response, true);
        } else {
            throw new Exception('BlueOx API Error: ' . $response);
        }
    }
    
    private function formatOrderItems($items) {
        $services = [];
        foreach ($items as $item) {
            $services[] = [
                'service_name' => $item->product_name,
                'staff_member' => 'Online Store',
                'amount' => $item->total,
                'commission_amount' => 0
            ];
        }
        return $services;
    }
}

// Usage in WooCommerce or similar
add_action('woocommerce_order_status_completed', 'sync_order_to_bluox');

function sync_order_to_bluox($order_id) {
    $order = wc_get_order($order_id);
    
    $blueox = new BlueOxIntegration(
        get_option('bluox_api_key'),
        get_option('bluex_system_id')
    );
    
    try {
        $result = $blueox->syncOrder($order);
        $order->add_order_note('Order synced to BlueOx: ' . $result['journal_entry_id']);
    } catch (Exception $e) {
        error_log('BlueOx sync failed: ' . $e->getMessage());
        $order->add_order_note('Failed to sync to BlueOx: ' . $e->getMessage());
    }
}
?>
```

---

## ⚠️ Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "Error description",
  "error_code": "INVALID_API_KEY",
  "details": "Additional error details",
  "timestamp": "2026-02-06T14:30:00Z"
}
```

### Common Error Codes

| Code | Status | Description | Solution |
|------|--------|-------------|----------|
| `INVALID_API_KEY` | 401 | API key is invalid or expired | Check API key and contact admin |
| `INSUFFICIENT_PERMISSIONS` | 403 | API key lacks required permissions | Request additional permissions |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Implement retry with exponential backoff |
| `VALIDATION_ERROR` | 400 | Request data validation failed | Check request format and required fields |
| `ACCOUNT_NOT_FOUND` | 404 | Required GL accounts missing | Ensure accounting setup is complete |
| `JOURNAL_UNBALANCED` | 400 | Journal entry debits ≠ credits | Check transaction amounts |

### Retry Strategy

```javascript
async function syncWithRetry(data, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await blueox.syncSale(data);
    } catch (error) {
      if (error.response?.status === 429) {
        // Rate limited - exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      if (attempt === maxRetries) {
        throw error; // Final attempt failed
      }
    }
  }
}
```

---

## 🚦 Rate Limits

### Default Limits

| Plan | Requests per Minute | Burst Limit |
|------|-------------------|-------------|
| **Starter** | 100 | 200 |
| **Professional** | 500 | 1000 |
| **Enterprise** | 2000 | 5000 |
| **Custom** | Negotiable | Negotiable |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1675700400
```

---

## 🔗 Webhooks (Coming Soon)

BlueOx can send webhooks to notify your system of important events:

- Payment received notifications
- Low inventory alerts  
- Invoice status changes
- Customer data updates

---

## 📚 SDKs & Libraries

### Official SDKs

| Language | Package | Documentation |
|----------|---------|---------------|
| **JavaScript/Node.js** | `@blueox/api-client` | [npm](https://npmjs.com/package/@blueox/api-client) |
| **PHP** | `blueox/api-client` | [Composer](https://packagist.org/packages/blueox/api-client) |
| **Python** | `blueox-api` | [PyPI](https://pypi.org/project/blueox-api/) |
| **C#** | `BlueOx.ApiClient` | [NuGet](https://nuget.org/packages/BlueOx.ApiClient) |

### Community SDKs

| Language | Author | Repository |
|----------|--------|------------|
| **Ruby** | Community | [GitHub](https://github.com/blueox-community/ruby-sdk) |
| **Go** | Community | [GitHub](https://github.com/blueox-community/go-sdk) |
| **Java** | Community | [GitHub](https://github.com/blueox-community/java-sdk) |

---

## 🤝 Support & Community

### Getting Help

- **API Documentation:** [https://docs.api.blueox.app](https://docs.api.blueox.app)
- **Developer Forum:** [https://community.blueox.app](https://community.blueox.app)  
- **Support Email:** [api-support@blueox.app](mailto:api-support@blueox.app)
- **Status Page:** [https://status.blueox.app](https://status.blueox.app)

### Contributing

- **Bug Reports:** [GitHub Issues](https://github.com/blueox/api-feedback)
- **Feature Requests:** [GitHub Discussions](https://github.com/blueox/api-feedback/discussions)
- **Documentation:** [GitHub Wiki](https://github.com/blueox/api-docs)

### Sample Projects

- **Salon POS Integration:** [GitHub](https://github.com/blueox/examples/salon-pos)
- **E-commerce Connector:** [GitHub](https://github.com/blueox/examples/ecommerce)
- **Custom Dashboard:** [GitHub](https://github.com/blueox/examples/dashboard)

---

## 🔄 Changelog

### v2.0.0 (February 6, 2026)
- ✅ Added salon integration webhook endpoint
- ✅ Added financial summary API
- ✅ Added API key management
- ✅ Added comprehensive error handling
- ✅ Added rate limiting

### v1.0.0 (January 15, 2026)
- ✅ Initial API release
- ✅ Basic authentication
- ✅ Core accounting endpoints

---

**© 2026 BlueOx Business Platform. All rights reserved.**